// POST /functions/v1/geocode-location
//
// CONTRACT:
//   POST { location_id }  ->  { geocoded: true, lat, lng, cached }  |
//                              { geocoded: false }   (no match / egress blocked)
//
// Called (best-effort, non-blocking) after an artist saves a studio location
// (onboarding + settings, web + mobile — see core `useStudioLocationMutations`).
// Resolves the typed address to lat/lng via Nominatim (OpenStreetMap), caching
// every lookup in `geocode_cache` to honor the usage policy (<=1 req/s) and
// avoid re-hitting the service for the same address. Writes the coordinates
// back onto the studio_locations row with the service role.
//
// Auth: verify_jwt is enabled — only an authenticated user can trigger a
// lookup, and we additionally check the location belongs to the caller before
// spending a geocode request on it.
import { handlePreflight } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { errors, errorResponse, jsonResponse, AppError } from "../_shared/errors.ts";
import {
  buildAddressQuery,
  normalizeCacheKey,
  buildNominatimUrl,
  parseNominatimResults,
  NOMINATIM_USER_AGENT,
  NOMINATIM_MIN_INTERVAL_MS,
  type GeocodeHit,
} from "./geocode.ts";

// Warm-isolate throttle: best-effort spacing between live Nominatim calls. The
// durable dedupe is the geocode_cache table; this only smooths bursts within a
// single warm function instance.
let lastLiveCallAt = 0;

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    if (req.method !== "POST") throw errors.badRequest("Use POST");

    const user = await requireUser(req);
    const body = await safeJson(req);
    const locationId = str(body?.location_id);
    if (!locationId) throw errors.badRequest("location_id is required");

    const admin = getAdminClient();

    // Load the location + verify the caller owns the artist it belongs to.
    const { data: loc, error: locErr } = await admin
      .from("studio_locations")
      .select(
        "id, artist_id, address_line1, address_line2, city, state, postal_code, country, lat, lng, artist_profiles!inner(profile_id)",
      )
      .eq("id", locationId)
      .maybeSingle();
    if (locErr) throw errors.server(locErr.message);
    if (!loc) throw errors.notFound("Location not found");

    const ownerId = (loc as { artist_profiles?: { profile_id?: string } })
      .artist_profiles?.profile_id;
    if (ownerId !== user.id) throw errors.forbidden("Not your location");

    const query = buildAddressQuery(loc);
    const cacheKey = normalizeCacheKey(query);
    if (!cacheKey || cacheKey === "us") {
      throw errors.badRequest("Location has no address to geocode");
    }

    // 1) Cache lookup.
    let hit: GeocodeHit | null = null;
    let cached = false;
    const { data: cacheRow } = await admin
      .from("geocode_cache")
      .select("lat, lng, display_name")
      .eq("query", cacheKey)
      .maybeSingle();

    if (cacheRow && cacheRow.lat != null && cacheRow.lng != null) {
      hit = { lat: cacheRow.lat, lng: cacheRow.lng, displayName: cacheRow.display_name };
      cached = true;
    } else {
      // 2) Live lookup (rate-limited, cached).
      hit = await liveGeocode(query);
      // Cache the outcome either way — a null result is worth remembering too,
      // but we only persist coordinates when we have them (lat/lng nullable).
      await admin
        .from("geocode_cache")
        .upsert(
          {
            query: cacheKey,
            lat: hit?.lat ?? null,
            lng: hit?.lng ?? null,
            display_name: hit?.displayName ?? null,
            provider: "nominatim",
          },
          { onConflict: "query" },
        )
        .then(() => undefined, () => undefined);
    }

    if (!hit) return jsonResponse({ geocoded: false });

    // 3) Write coordinates back onto the location.
    const { error: updErr } = await admin
      .from("studio_locations")
      .update({ lat: hit.lat, lng: hit.lng })
      .eq("id", locationId);
    if (updErr) throw errors.server(updErr.message);

    return jsonResponse({ geocoded: true, lat: hit.lat, lng: hit.lng, cached });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return errorResponse(errors.server(message));
  }
});

/** Perform a throttled live Nominatim lookup. Returns null on any failure. */
async function liveGeocode(query: string): Promise<GeocodeHit | null> {
  const since = Date.now() - lastLiveCallAt;
  if (since < NOMINATIM_MIN_INTERVAL_MS) {
    await sleep(NOMINATIM_MIN_INTERVAL_MS - since);
  }
  lastLiveCallAt = Date.now();
  try {
    const res = await fetch(buildNominatimUrl(query), {
      headers: {
        "User-Agent": NOMINATIM_USER_AGENT,
        "Accept": "application/json",
      },
    });
    if (!res.ok) return null;
    const payload = await res.json();
    return parseNominatimResults(payload);
  } catch {
    // Egress blocked / network error / bad JSON — degrade gracefully.
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}
