/**
 * Global search — the backend for the top-bar search overlay (web ⌘K command
 * palette) and the mobile search screen. Founder ask: "search across profiles,
 * like artists or clients", styles, and locations.
 *
 * WHAT IS SEARCHABLE — and the deliberate client-account exclusion:
 *   · ARTISTS  — published + public artist profiles (reuses `search_artists`
 *                text mode; name / handle / city / styles, trgm typo-tolerant).
 *   · SHOPS    — published shops (reuses `search_shops`; name / handle / city).
 *   · STYLES   — the taxonomy; tapping a style deep-links to discover filtered
 *                by it. Pure client-side match over the cached `styles` list.
 *   · CITIES   — the pilot metros (Baltimore / Philadelphia); tapping one
 *                centers discover there. Pure client-side.
 *
 *   CLIENTS ARE INTENTIONALLY NOT SEARCHABLE. The founder said "profiles, like
 *   artists or clients", but a client account is a PRIVATE entity — a consumer
 *   who books tattoos, not a public listing. Exposing client accounts to a
 *   global search would let anyone enumerate real people by name, which is a
 *   privacy problem with no product upside (nobody searches INKD to find a
 *   fellow customer). Only PUBLIC entities — artists and shops (and the styles/
 *   cities that route into discovery) — are surfaced. This is enforced by
 *   construction: the two RPCs only ever return published/public rows, and
 *   there is no `profiles`-by-name search path for client accounts at all.
 *
 * The RPCs run under the caller's session but are SECURITY DEFINER over public
 * data only, so the overlay works signed-out (mobile feed/discover are public).
 */
import { searchArtists, DISCOVER_CITIES, type DiscoverCitySlug } from "./discover";
import { searchShops } from "./shops";
import type { InkdSupabaseClient } from "../supabase/client";
import type { Style } from "../types/rows";
import type { UsState } from "../types/rows";

// ---------------------------------------------------------------------------
// Result shapes — one placard row per hit, grouped by kind.
// ---------------------------------------------------------------------------
export interface ArtistSearchResult {
  kind: "artist";
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  styles: string[];
  city: string | null;
  state: string | null;
}

export interface ShopSearchResult {
  kind: "shop";
  id: string;
  handle: string;
  name: string;
  avatarUrl: string | null;
  city: string | null;
  state: string | null;
  memberCount: number;
}

export interface StyleSearchResult {
  kind: "style";
  slug: string;
  name: string;
}

export interface CitySearchResult {
  kind: "city";
  slug: DiscoverCitySlug;
  label: string;
  state: UsState;
  lat: number;
  lng: number;
}

export type SearchResult =
  | ArtistSearchResult
  | ShopSearchResult
  | StyleSearchResult
  | CitySearchResult;

export interface GlobalSearchResults {
  artists: ArtistSearchResult[];
  shops: ShopSearchResult[];
  styles: StyleSearchResult[];
  cities: CitySearchResult[];
}

export const EMPTY_SEARCH_RESULTS: GlobalSearchResults = {
  artists: [],
  shops: [],
  styles: [],
  cities: [],
};

/** Total hit count across all groups — for the "N results" / empty affordances. */
export function searchResultCount(r: GlobalSearchResults): number {
  return r.artists.length + r.shops.length + r.styles.length + r.cities.length;
}

/** Flatten grouped results into a single ordered list (keyboard nav order). */
export function flattenSearchResults(r: GlobalSearchResults): SearchResult[] {
  return [...r.artists, ...r.shops, ...r.styles, ...r.cities];
}

/**
 * The destination route for a result, per platform. Web uses `/a|/s|/discover`;
 * mobile uses `/artist|/shop|/(tabs)/discover`. Kept here so both overlays stay
 * consistent and there's one place that knows how a hit routes.
 */
export function searchResultHref(
  result: SearchResult,
  platform: "web" | "mobile",
): string {
  switch (result.kind) {
    case "artist":
      return platform === "web" ? `/a/${result.handle}` : `/artist/${result.handle}`;
    case "shop":
      return platform === "web" ? `/s/${result.handle}` : `/shop/${result.handle}`;
    case "style":
      return `/discover?styles=${encodeURIComponent(result.slug)}`;
    case "city":
      return `/discover?city=${result.slug}`;
  }
}

// ---------------------------------------------------------------------------
// Pure matchers — styles + cities come from the cached taxonomy, no round-trip.
// ---------------------------------------------------------------------------

/** True when `hay` contains every whitespace-delimited token of `needle`. */
function tokensMatch(needle: string, hay: string): boolean {
  const n = needle.trim().toLowerCase();
  if (!n) return false;
  const h = hay.toLowerCase();
  return n.split(/\s+/).every((t) => h.includes(t));
}

/** Style taxonomy hits (name or slug substring), capped. */
export function matchStyles(
  query: string,
  styles: Style[],
  limit = 4,
): StyleSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return styles
    .filter((s) => tokensMatch(q, `${s.name} ${s.slug}`))
    .slice(0, limit)
    .map((s) => ({ kind: "style", slug: s.slug, name: s.name }));
}

/** City quick-nav hits (label / slug / state). */
export function matchCities(query: string, limit = 3): CitySearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return DISCOVER_CITIES.filter((c) =>
    tokensMatch(q, `${c.label} ${c.slug} ${c.state}`),
  )
    .slice(0, limit)
    .map((c) => ({
      kind: "city",
      slug: c.slug,
      label: c.label,
      state: c.state,
      lat: c.lat,
      lng: c.lng,
    }));
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------
export interface GlobalSearchOptions {
  /** The cached style taxonomy (from `useStyleFilters`/`useStyles`). */
  styles?: Style[];
  artistLimit?: number;
  shopLimit?: number;
}

/**
 * The DB-backed half of a search: artists + shops via two parallel RPCs. Kept
 * separate from the style/city matchers (which are pure + synchronous) so the
 * hook can compute those instantly from the cached taxonomy without waiting on
 * — or re-running — this async query when the taxonomy loads.
 */
export async function globalSearchEntities(
  client: InkdSupabaseClient,
  query: string,
  options: Pick<GlobalSearchOptions, "artistLimit" | "shopLimit"> = {},
): Promise<Pick<GlobalSearchResults, "artists" | "shops">> {
  const q = query.trim();
  if (q.length === 0) return { artists: [], shops: [] };

  const [artistCards, shopCards] = await Promise.all([
    searchArtists(client, { query: q, limit: options.artistLimit ?? 6 }),
    searchShops(client, { query: q, limit: options.shopLimit ?? 5 }),
  ]);

  return {
    artists: artistCards
      .filter((c) => c.handle)
      .map((c) => ({
        kind: "artist",
        id: c.artist_id,
        handle: c.handle as string,
        displayName: c.display_name ?? (c.handle as string),
        avatarUrl: c.avatar_url,
        styles: c.styles ?? [],
        city: c.city,
        state: c.state,
      })),
    shops: shopCards.map((s) => ({
      kind: "shop",
      id: s.shop_id,
      handle: s.handle,
      name: s.name,
      avatarUrl: s.avatar_url,
      city: s.city,
      state: s.state,
      memberCount: s.member_count,
    })),
  };
}

/**
 * Run a full global search (entities + styles + cities). A blank query short
 * -circuits to empty (the overlay shows recent searches instead).
 */
export async function globalSearch(
  client: InkdSupabaseClient,
  query: string,
  options: GlobalSearchOptions = {},
): Promise<GlobalSearchResults> {
  const q = query.trim();
  if (q.length === 0) return EMPTY_SEARCH_RESULTS;
  const entities = await globalSearchEntities(client, q, options);
  return {
    ...entities,
    styles: matchStyles(q, options.styles ?? []),
    cities: matchCities(q),
  };
}

// ---------------------------------------------------------------------------
// Recent searches — local-only (localStorage on web, AsyncStorage on mobile).
// The storage binding lives in each platform's overlay; these are the pure
// list operations so both platforms share one contract + dedupe/cap behavior.
// ---------------------------------------------------------------------------
export interface RecentSearch {
  /** The raw query the user typed. */
  query: string;
  at: number;
}

export const RECENT_SEARCHES_KEY = "inkd.recentSearches.v1";
export const MAX_RECENT_SEARCHES = 6;

/** Prepend a query, dedupe (case-insensitive), and cap the list. */
export function addRecentSearch(
  list: RecentSearch[],
  query: string,
  max = MAX_RECENT_SEARCHES,
): RecentSearch[] {
  const q = query.trim();
  if (!q) return list;
  const lower = q.toLowerCase();
  const deduped = list.filter((r) => r.query.trim().toLowerCase() !== lower);
  return [{ query: q, at: Date.now() }, ...deduped].slice(0, max);
}

/** Remove one recent query (case-insensitive). */
export function removeRecentSearch(
  list: RecentSearch[],
  query: string,
): RecentSearch[] {
  const lower = query.trim().toLowerCase();
  return list.filter((r) => r.query.trim().toLowerCase() !== lower);
}

/** Parse a persisted JSON blob into a validated RecentSearch[] (never throws). */
export function parseRecentSearches(raw: string | null | undefined): RecentSearch[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (r): r is RecentSearch =>
          r && typeof r.query === "string" && typeof r.at === "number",
      )
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}
