/**
 * Data access: local discovery. Thin, zod-validated wrapper over the
 * `search_artists` Postgres RPC (SECURITY INVOKER — runs under the caller's
 * RLS, no service role). This is the backend for SPEC §4: "local map + filters
 * that actually work — style × city × price band × availability".
 *
 * The RPC returns one card per published, handled artist, computed over public
 * locations/services/styles/flash + booking_policies, with earthdistance
 * distance (km) and pg_trgm text ranking. Also exports the shared vocabulary
 * (city quick-picks, price bands, radius options) + URL (de)serialization so
 * the web filter state is shareable and the mobile screen reuses the same
 * shapes.
 */
import { z } from "zod";

import type { InkdSupabaseClient } from "../supabase/client";
import type { Database } from "../types/database";
import type { UsState } from "../types/rows";

/**
 * A single discovery result row (mirrors `search_artists` RETURNS TABLE).
 *
 * `distance_km` is overridden to `number | null`: the RPC computes it only when
 * a center (`p_lat`/`p_lng`) is supplied and returns SQL NULL otherwise, but
 * the Supabase type generator can't express nullability of SET-RETURNING
 * function columns and emits it as non-null. Every consumer already guards
 * `distance_km != null`, so we reconcile the type to the real runtime shape
 * here instead of hand-editing the regenerated database.ts.
 */
export type ArtistCard = Omit<
  Database["public"]["Functions"]["search_artists"]["Returns"][number],
  "distance_km"
> & { distance_km: number | null };

// ---------------------------------------------------------------------------
// Params — the app speaks camelCase; the RPC speaks p_snake_case.
// ---------------------------------------------------------------------------
/** The pilot states. Mirrors the `us_state` DB enum (see UsState in types). */
export const usStateSchema = z.enum(["MD", "PA"]);

export const discoverParamsSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  radiusKm: z.number().positive().max(500).optional(),
  styles: z.array(z.string().min(1)).max(20).optional(),
  priceMin: z.number().int().nonnegative().optional(),
  priceMax: z.number().int().nonnegative().optional(),
  booksOpen: z.boolean().optional(),
  state: usStateSchema.optional(),
  query: z.string().trim().max(120).optional(),
  limit: z.number().int().positive().max(200).optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type DiscoverParams = z.input<typeof discoverParamsSchema>;

/** City quick-picks (the pilot metros). Coordinates are the metro centroids. */
export const DISCOVER_CITIES = [
  { slug: "baltimore", label: "Baltimore", state: "MD", lat: 39.2904, lng: -76.6122 },
  { slug: "philadelphia", label: "Philadelphia", state: "PA", lat: 39.9526, lng: -75.1652 },
] as const satisfies readonly {
  slug: string;
  label: string;
  state: UsState;
  lat: number;
  lng: number;
}[];
export type DiscoverCitySlug = (typeof DISCOVER_CITIES)[number]["slug"];

/** Price bands operate on an artist's cheapest public priced service (cents). */
export const PRICE_BANDS = [
  { slug: "budget", label: "Under $200", min: undefined, max: 20000 },
  { slug: "mid", label: "$200–$500", min: 20000, max: 50000 },
  { slug: "premium", label: "$500+", min: 50000, max: undefined },
] as const satisfies readonly {
  slug: string;
  label: string;
  min: number | undefined;
  max: number | undefined;
}[];
export type PriceBandSlug = (typeof PRICE_BANDS)[number]["slug"];

/** Distance radius presets (km) offered in the filter bar. */
export const RADIUS_OPTIONS_KM = [5, 10, 25, 50, 100] as const;
export const DEFAULT_RADIUS_KM = 25;

// ---------------------------------------------------------------------------
// Miles — the presentation boundary. Storage, queries, and the search_artists
// RPC all speak km/meters; every user-facing surface speaks miles. Convert
// here so the two never drift.
// ---------------------------------------------------------------------------
export const KM_PER_MILE = 1.609344;
export function kmToMiles(km: number): number {
  return km / KM_PER_MILE;
}
export function milesToKm(mi: number): number {
  return mi * KM_PER_MILE;
}
/** Format a stored distance (km) as a user-facing miles string, e.g. "2.4 mi". */
export function formatDistanceMiles(km: number): string {
  return `${kmToMiles(km).toFixed(1)} mi`;
}
/** Distance radius presets (miles) offered in the filter bar. */
export const RADIUS_OPTIONS_MI = [3, 10, 25, 50] as const;
export const DEFAULT_RADIUS_MI = 25;
/** True if a stored km radius corresponds to a given mile preset (float-safe). */
export function radiusMatchesMiles(radiusKm: number | undefined, mi: number): boolean {
  if (radiusKm == null) return false;
  return Math.abs(radiusKm - milesToKm(mi)) < 0.01;
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------
/** Run a discovery search. Undefined filters are omitted (sent as SQL NULL). */
export async function searchArtists(
  client: InkdSupabaseClient,
  params: DiscoverParams = {},
): Promise<ArtistCard[]> {
  const p = discoverParamsSchema.parse(params);
  const { data, error } = await client.rpc("search_artists", {
    p_lat: p.lat ?? undefined,
    p_lng: p.lng ?? undefined,
    p_radius_km: p.radiusKm ?? undefined,
    p_style_slugs: p.styles && p.styles.length > 0 ? p.styles : undefined,
    p_price_min: p.priceMin ?? undefined,
    p_price_max: p.priceMax ?? undefined,
    p_books_open: p.booksOpen ?? undefined,
    p_state: p.state ?? undefined,
    p_query: p.query && p.query.length > 0 ? p.query : undefined,
    p_limit: p.limit ?? 60,
    p_offset: p.offset ?? 0,
  });
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// URL (de)serialization — makes web filter state shareable. Kept here (pure,
// zod-validated) so both the reader and writer share one contract.
//   ?city=baltimore | ?lat=..&lng=..  ·  radius(km)  ·  styles=a,b  ·
//   price=budget|mid|premium (or priceMin/priceMax) · open=1 · state=MD|PA · q=..
// ---------------------------------------------------------------------------
export function priceBandBySlug(slug: string | null | undefined) {
  return PRICE_BANDS.find((b) => b.slug === slug);
}
export function cityBySlug(slug: string | null | undefined) {
  return DISCOVER_CITIES.find((c) => c.slug === slug);
}

/**
 * Parse a URL param into a finite number, or `undefined` when absent/blank/bad.
 *
 * Critically NOT `Number(get(k))`: `Number(null)` is `0` and `Number("")` is
 * `0`, both of which `Number.isFinite` accepts — so a missing `lat`/`lng` would
 * silently become the coordinate 0. That shipped once as the "null island" bug:
 * first load (empty URL) built a (0, 0) search center with the default radius,
 * and `search_artists` returned zero artists off the coast of Africa. Treat an
 * absent value as absent.
 */
function numParam(v: string | null | undefined): number | undefined {
  if (v == null || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Parse a `URLSearchParams`-like getter into validated `DiscoverParams`. */
export function parseDiscoverSearchParams(
  get: (key: string) => string | null,
): DiscoverParams {
  const num = numParam;

  const city = cityBySlug(get("city"));
  const lat = city ? city.lat : num(get("lat"));
  const lng = city ? city.lng : num(get("lng"));

  const band = priceBandBySlug(get("price"));
  const priceMin = band ? band.min : num(get("priceMin"));
  const priceMax = band ? band.max : num(get("priceMax"));

  const stylesRaw = get("styles");
  const styles = stylesRaw
    ? stylesRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  const stateParsed = usStateSchema.safeParse(get("state") ?? undefined);
  const q = get("q")?.trim() || undefined;

  const candidate: DiscoverParams = {
    lat,
    lng,
    radiusKm: lat != null && lng != null ? num(get("radius")) ?? DEFAULT_RADIUS_KM : undefined,
    styles: styles && styles.length ? styles : undefined,
    priceMin,
    priceMax,
    booksOpen: get("open") === "1" ? true : undefined,
    state: stateParsed.success ? stateParsed.data : undefined,
    query: q,
  };
  // Validate + drop anything malformed; never throw on a bad URL.
  const parsed = discoverParamsSchema.safeParse(candidate);
  return parsed.success ? parsed.data : {};
}

/**
 * The high-level UI filter selection (what the filter bar binds to). Distinct
 * from the raw RPC params: it remembers *which* city / price band / view were
 * chosen so the URL stays human and shareable.
 */
export interface DiscoverFilterState {
  city?: DiscoverCitySlug;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  styles: string[];
  priceBand?: PriceBandSlug;
  booksOpen: boolean;
  state?: UsState;
  query: string;
}

export const EMPTY_FILTER_STATE: DiscoverFilterState = {
  styles: [],
  booksOpen: false,
  query: "",
};

/** Serialize the filter selection into a query string (stable key order). */
export function discoverFilterToQuery(f: DiscoverFilterState): string {
  const sp = new URLSearchParams();
  if (f.city) sp.set("city", f.city);
  else if (f.lat != null && f.lng != null) {
    sp.set("lat", String(f.lat));
    sp.set("lng", String(f.lng));
  }
  if ((f.city || (f.lat != null && f.lng != null)) && f.radiusKm) {
    sp.set("radius", String(f.radiusKm));
  }
  if (f.styles.length) sp.set("styles", f.styles.join(","));
  if (f.priceBand) sp.set("price", f.priceBand);
  if (f.booksOpen) sp.set("open", "1");
  if (f.state && !f.city) sp.set("state", f.state);
  if (f.query.trim()) sp.set("q", f.query.trim());
  return sp.toString();
}

/** Rehydrate the filter selection from a query string. */
export function queryToDiscoverFilter(get: (key: string) => string | null): DiscoverFilterState {
  const city = cityBySlug(get("city"));
  const band = priceBandBySlug(get("price"));
  const stylesRaw = get("styles");
  const stateParsed = usStateSchema.safeParse(get("state") ?? undefined);
  const radius = numParam(get("radius"));
  const latRaw = numParam(get("lat"));
  const lngRaw = numParam(get("lng"));
  return {
    city: city?.slug,
    lat: city ? city.lat : latRaw,
    lng: city ? city.lng : lngRaw,
    radiusKm: radius != null && radius > 0 ? radius : undefined,
    styles: stylesRaw ? stylesRaw.split(",").map((s) => s.trim()).filter(Boolean) : [],
    priceBand: band?.slug,
    booksOpen: get("open") === "1",
    state: !city && stateParsed.success ? stateParsed.data : undefined,
    query: get("q")?.trim() ?? "",
  };
}

/** Collapse a filter selection into the RPC params the query hook consumes. */
export function discoverFilterToParams(f: DiscoverFilterState): DiscoverParams {
  const band = f.priceBand ? priceBandBySlug(f.priceBand) : undefined;
  const hasCenter = f.lat != null && f.lng != null;
  return discoverParamsSchema.parse({
    lat: hasCenter ? f.lat : undefined,
    lng: hasCenter ? f.lng : undefined,
    radiusKm: hasCenter ? f.radiusKm ?? DEFAULT_RADIUS_KM : undefined,
    styles: f.styles.length ? f.styles : undefined,
    priceMin: band?.min,
    priceMax: band?.max,
    booksOpen: f.booksOpen ? true : undefined,
    state: f.state,
    query: f.query.trim() || undefined,
  });
}

/** Format cents as a compact "from $X" price mark (or a quote fallback). */
export function formatMinPrice(cents: number | null | undefined): string | null {
  if (cents == null || cents <= 0) return null;
  const dollars = cents / 100;
  const rounded = Number.isInteger(dollars) ? dollars.toString() : dollars.toFixed(0);
  return `$${rounded}`;
}
