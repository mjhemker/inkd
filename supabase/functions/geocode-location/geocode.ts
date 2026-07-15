// Pure geocoding helpers — NO IO, NO Deno/Supabase deps, so they run offline
// under Node's type-stripping test runner (see geocode.test.ts). The edge
// function (index.ts) imports these and supplies the network + DB.

/** The minimal studio_locations shape we geocode from. */
export interface GeocodableLocation {
  address_line1: string | null;
  address_line2?: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country?: string | null;
}

/** A parsed Nominatim search result (only the fields we use). */
export interface NominatimResult {
  lat: string;
  lon: string;
  display_name?: string;
  importance?: number;
}

export interface GeocodeHit {
  lat: number;
  lng: number;
  displayName: string | null;
}

export const NOMINATIM_USER_AGENT = "INKD-pilot/1.0 (getinkd.co)";
export const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";
/** Nominatim usage policy: at most 1 request/second. */
export const NOMINATIM_MIN_INTERVAL_MS = 1100;

/**
 * Compose a single-line address query from a location row. Skips empty parts;
 * returns "" when there is nothing to geocode.
 */
export function buildAddressQuery(loc: GeocodableLocation): string {
  const parts = [
    loc.address_line1,
    loc.address_line2,
    loc.city,
    loc.state,
    loc.postal_code,
    loc.country ?? "US",
  ]
    .map((p) => (p ?? "").trim())
    .filter((p) => p.length > 0);
  return parts.join(", ");
}

/**
 * Normalize an address into a stable cache key: lowercased, punctuation
 * collapsed to single spaces, trimmed. "200 W. Pratt St., Baltimore, MD 21201"
 * and "200 w pratt st baltimore md 21201" hit the same cache row.
 */
export function normalizeCacheKey(query: string): string {
  return query
    .toLowerCase()
    .replace(/[.,#/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Build the Nominatim search URL for a query (JSON, US-biased, top result). */
export function buildNominatimUrl(query: string): string {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "0",
    limit: "1",
    countrycodes: "us",
  });
  return `${NOMINATIM_BASE}?${params.toString()}`;
}

/**
 * Parse a Nominatim JSON response (array) into a single hit, or null when the
 * response is empty / malformed / out of valid lat-lng range.
 */
export function parseNominatimResults(payload: unknown): GeocodeHit | null {
  if (!Array.isArray(payload) || payload.length === 0) return null;
  const first = payload[0] as NominatimResult;
  if (first == null || first.lat == null || first.lon == null) return null;
  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return {
    lat,
    lng,
    displayName: typeof first.display_name === "string" ? first.display_name : null,
  };
}
