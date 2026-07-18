/**
 * Feed filter panel state (SPEC §4 — the feed's "filters that actually work").
 *
 * The panel exposes multi-select styles (plus a free-text "Other" style query
 * for anything outside the taxonomy), location (city quick-picks + near-me), a
 * dual-thumb price range, and a books-open toggle — the same vocabulary as
 * discover, so `FeedFilterState` extends `DiscoverFilterState` rather than
 * inventing a parallel shape. What differs is APPLICATION: in the feed,
 * `styles`/`styleQuery` filter posts (by post_styles tags, or by a text match
 * against style names/captions for "Other"), while location/price/books
 * resolve to eligible artist ids via `feed_filter_artist_ids`.
 *
 * This module is the bridge between that UI state and (a) the feed query
 * inputs and (b) the inline active-filter chips. URL (de)serialization wraps
 * discover's `discoverFilterToQuery` / `queryToDiscoverFilter` and adds the
 * one feed-only param (`styleOther`) so feed filters stay shareable/
 * back-button-safe on web.
 */
import {
  EMPTY_FILTER_STATE,
  PRICE_SLIDER_MIN_USD,
  PRICE_SLIDER_MAX_USD,
  isPriceNarrowed,
  usdToCents,
  DISCOVER_CITIES,
  discoverFilterToQuery,
  queryToDiscoverFilter,
  type DiscoverFilterState,
} from "./discover";
import type { FeedArtistFilters } from "./feed";
import type { Style } from "../types/rows";

/**
 * The feed panel binds to the same shape discover uses, plus one feed-only
 * addition: `styleQuery`, the free-text value typed under the Styles list's
 * "Other" option (for a style that isn't in the taxonomy). It's optional so
 * every existing `DiscoverFilterState` value still satisfies this type.
 */
export interface FeedFilterState extends DiscoverFilterState {
  /** Free-text "Other" style query — matched against style names / captions. */
  styleQuery?: string;
}

export const EMPTY_FEED_FILTER: FeedFilterState = EMPTY_FILTER_STATE;

/** True when the panel differs from the empty/default state (drives the badge). */
export function hasActiveFeedFilters(f: FeedFilterState): boolean {
  return (
    f.styles.length > 0 ||
    isPriceNarrowed(f.priceMinUsd, f.priceMaxUsd) ||
    f.booksOpen ||
    f.city != null ||
    (f.lat != null && f.lng != null) ||
    f.state != null ||
    hasStyleQuery(f)
  );
}

/** How many distinct filters are active — for the "Filters · N" pill. */
export function activeFeedFilterCount(f: FeedFilterState): number {
  let n = 0;
  n += f.styles.length;
  if (isPriceNarrowed(f.priceMinUsd, f.priceMaxUsd)) n += 1;
  if (f.booksOpen) n += 1;
  if (f.city != null || (f.lat != null && f.lng != null)) n += 1;
  if (hasStyleQuery(f)) n += 1;
  return n;
}

/** True when the "Other" free-text style query has a non-blank value. */
export function hasStyleQuery(f: FeedFilterState): boolean {
  return (f.styleQuery ?? "").trim().length > 0;
}

/**
 * Map the panel state to the feed query's ARTIST-level filters (cents, not
 * dollars; only send a price bound when the slider is narrowed). Styles are
 * excluded here — they filter at the post level.
 */
export function feedArtistFilterParams(f: FeedFilterState): FeedArtistFilters {
  const hasCenter = f.lat != null && f.lng != null;
  const minUsd = f.priceMinUsd ?? PRICE_SLIDER_MIN_USD;
  const maxUsd = f.priceMaxUsd ?? PRICE_SLIDER_MAX_USD;
  return {
    lat: hasCenter ? f.lat : undefined,
    lng: hasCenter ? f.lng : undefined,
    radiusKm: hasCenter ? f.radiusKm : undefined,
    priceMinCents: minUsd > PRICE_SLIDER_MIN_USD ? usdToCents(minUsd) : undefined,
    priceMaxCents: maxUsd < PRICE_SLIDER_MAX_USD ? usdToCents(maxUsd) : undefined,
    booksOpen: f.booksOpen ? true : undefined,
    state: f.state,
  };
}

// ---------------------------------------------------------------------------
// Active-filter chips — the inline "what's applied" row with clear-all.
// ---------------------------------------------------------------------------
export type FeedChipKind = "style" | "styleQuery" | "city" | "price" | "books";

export interface FeedFilterChip {
  /** Stable key for React + the clear handler. */
  key: string;
  kind: FeedChipKind;
  label: string;
  /** For a style chip, the slug to remove; otherwise undefined. */
  styleSlug?: string;
}

/** Format a whole-dollar price band into a compact chip label. */
function priceChipLabel(minUsd?: number, maxUsd?: number): string {
  const lo = minUsd != null && minUsd > PRICE_SLIDER_MIN_USD ? `$${minUsd}` : null;
  const hi = maxUsd != null && maxUsd < PRICE_SLIDER_MAX_USD ? `$${maxUsd}` : null;
  if (lo && hi) return `${lo}–${hi}`;
  if (lo) return `${lo}+`;
  if (hi) return `Up to ${hi}`;
  return "Any price";
}

/**
 * Describe the active filters as chips (styles first, then city, price, books).
 * `styleName` resolves a slug to its display name via the taxonomy.
 */
export function describeFeedFilters(
  f: FeedFilterState,
  styles: Style[],
): FeedFilterChip[] {
  const nameBySlug = new Map(styles.map((s) => [s.slug, s.name]));
  const chips: FeedFilterChip[] = [];

  for (const slug of f.styles) {
    chips.push({
      key: `style:${slug}`,
      kind: "style",
      label: nameBySlug.get(slug) ?? slug,
      styleSlug: slug,
    });
  }

  if (hasStyleQuery(f)) {
    chips.push({
      key: "styleQuery",
      kind: "styleQuery",
      label: `Other: "${f.styleQuery!.trim()}"`,
    });
  }

  if (f.city != null || (f.lat != null && f.lng != null)) {
    const city = DISCOVER_CITIES.find((c) => c.slug === f.city);
    chips.push({
      key: "city",
      kind: "city",
      label: city ? city.label : "Near me",
    });
  }

  if (isPriceNarrowed(f.priceMinUsd, f.priceMaxUsd)) {
    chips.push({
      key: "price",
      kind: "price",
      label: priceChipLabel(f.priceMinUsd, f.priceMaxUsd),
    });
  }

  if (f.booksOpen) {
    chips.push({ key: "books", kind: "books", label: "Open books" });
  }

  return chips;
}

/** Remove one chip from the filter state (returns a new state). */
export function clearFeedFilterChip(
  f: FeedFilterState,
  chip: FeedFilterChip,
): FeedFilterState {
  switch (chip.kind) {
    case "style":
      return { ...f, styles: f.styles.filter((s) => s !== chip.styleSlug) };
    case "styleQuery":
      return { ...f, styleQuery: undefined };
    case "city":
      return { ...f, city: undefined, lat: undefined, lng: undefined, state: undefined, radiusKm: undefined };
    case "price":
      return { ...f, priceMinUsd: undefined, priceMaxUsd: undefined };
    case "books":
      return { ...f, booksOpen: false };
  }
}

// ---------------------------------------------------------------------------
// URL (de)serialization — feed-only wrapper around discover's (de)serializers.
// Adds one param, `styleOther`, for the "Other" free-text style query so it's
// shareable/back-button-safe like every other feed filter.
// ---------------------------------------------------------------------------
const STYLE_QUERY_PARAM = "styleOther";

/** Serialize the feed filter selection into a query string. */
export function feedFilterToQuery(f: FeedFilterState): string {
  const sp = new URLSearchParams(discoverFilterToQuery(f));
  if (hasStyleQuery(f)) sp.set(STYLE_QUERY_PARAM, f.styleQuery!.trim());
  return sp.toString();
}

/** Rehydrate the feed filter selection from a query string. */
export function queryToFeedFilter(get: (key: string) => string | null): FeedFilterState {
  const base = queryToDiscoverFilter(get);
  const styleQuery = get(STYLE_QUERY_PARAM)?.trim() || undefined;
  return { ...base, styleQuery };
}
