/**
 * Feed filter panel state (SPEC §4 — the feed's "filters that actually work").
 *
 * The panel exposes multi-select styles, location (city quick-picks + near-me),
 * a dual-thumb price range, and a books-open toggle — the same vocabulary as
 * discover, so we REUSE `DiscoverFilterState` rather than inventing a parallel
 * shape. What differs is APPLICATION: in the feed, `styles` filters posts by
 * their post_styles tags (to stay in sync with the style chip row), while
 * location/price/books resolve to eligible artist ids via `feed_filter_artist_ids`.
 *
 * This module is the bridge between that UI state and (a) the feed query inputs
 * and (b) the inline active-filter chips. URL (de)serialization is inherited
 * from discover's `discoverFilterToQuery` / `queryToDiscoverFilter` so feed
 * filters are shareable/back-button-safe on web with zero new code.
 */
import {
  EMPTY_FILTER_STATE,
  PRICE_SLIDER_MIN_USD,
  PRICE_SLIDER_MAX_USD,
  isPriceNarrowed,
  usdToCents,
  DISCOVER_CITIES,
  type DiscoverFilterState,
} from "./discover";
import type { FeedArtistFilters } from "./feed";
import type { Style } from "../types/rows";

/** The feed panel binds to the same shape discover uses. */
export type FeedFilterState = DiscoverFilterState;

export const EMPTY_FEED_FILTER: FeedFilterState = EMPTY_FILTER_STATE;

/** True when the panel differs from the empty/default state (drives the badge). */
export function hasActiveFeedFilters(f: FeedFilterState): boolean {
  return (
    f.styles.length > 0 ||
    isPriceNarrowed(f.priceMinUsd, f.priceMaxUsd) ||
    f.booksOpen ||
    f.city != null ||
    (f.lat != null && f.lng != null) ||
    f.state != null
  );
}

/** How many distinct filters are active — for the "Filters · N" pill. */
export function activeFeedFilterCount(f: FeedFilterState): number {
  let n = 0;
  n += f.styles.length;
  if (isPriceNarrowed(f.priceMinUsd, f.priceMaxUsd)) n += 1;
  if (f.booksOpen) n += 1;
  if (f.city != null || (f.lat != null && f.lng != null)) n += 1;
  return n;
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
export type FeedChipKind = "style" | "city" | "price" | "books";

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
    case "city":
      return { ...f, city: undefined, lat: undefined, lng: undefined, state: undefined, radiusKm: undefined };
    case "price":
      return { ...f, priceMinUsd: undefined, priceMaxUsd: undefined };
    case "books":
      return { ...f, booksOpen: false };
  }
}
