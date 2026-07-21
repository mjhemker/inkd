/**
 * Style chip ordering + a small recently-used list (SPEC round 6, item 4).
 *
 * The feed filter panel (web) and sheet (mobile) show only the first handful of
 * style chips, then a "View more" expander for the rest. Which handful? These
 * pure helpers decide, so web + mobile rank identically and the logic is unit-
 * testable without a DOM:
 *
 *   (a) currently-selected styles first (never hidden behind "View more"),
 *   (b) then the viewer's preferred styles — for an artist, the styles on their
 *       own profile — and their recently-used styles (most-recent first),
 *   (c) then the taxonomy's own popularity/sort order as the fallback.
 *
 * The recently-used list is local-only (localStorage on web, AsyncStorage on
 * mobile). As with `recentSearches`, only the pure list ops live here; each
 * platform binds the storage.
 */
import type { Style } from "../types/rows";

/** How many style chips show before the "View more" expander. */
export const STYLE_CHIP_COLLAPSED_COUNT = 6;

export const RECENT_STYLES_KEY = "inkd.recentStyles.v1";
export const MAX_RECENT_STYLES = 12;

export interface StyleRankInput {
  /** Currently-selected style slugs (kept first, in selection order). */
  selected?: readonly string[];
  /** Preferred slugs (e.g. an artist's own profile styles) — ranked high. */
  preferred?: readonly string[];
  /** Recently-used slugs, most-recent first. */
  recent?: readonly string[];
}

// Rank bands: lower sorts first. Bands are spaced so no in-band index can spill
// into the next band (index is bounded by the taxonomy size, well under 1e6).
const BAND = 1_000_000;

/**
 * Rank the style taxonomy for chip display. Returns a NEW array (stable — ties
 * keep the taxonomy's incoming order) ordered selected → preferred → recent →
 * rest. A slug that appears in several inputs takes its strongest (lowest) band.
 */
export function rankStyles(styles: Style[], input: StyleRankInput = {}): Style[] {
  const selected = indexMap(input.selected);
  const preferred = indexMap(input.preferred);
  const recent = indexMap(input.recent);

  const rankOf = (slug: string): number => {
    if (selected.has(slug)) return 0 * BAND + selected.get(slug)!;
    if (preferred.has(slug)) return 1 * BAND + preferred.get(slug)!;
    if (recent.has(slug)) return 2 * BAND + recent.get(slug)!;
    return 3 * BAND;
  };

  return styles
    .map((style, i) => ({ style, i, rank: rankOf(style.slug) }))
    // Stable: break rank ties by the taxonomy's own incoming index.
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((e) => e.style);
}

/**
 * How many chips to show while collapsed. Never fewer than the selected count,
 * so a selected chip is never hidden behind "View more".
 */
export function collapsedStyleCount(
  selectedCount: number,
  base = STYLE_CHIP_COLLAPSED_COUNT,
): number {
  return Math.max(base, selectedCount);
}

/** Build a slug → index lookup from an ordered list (first wins on dupes). */
function indexMap(list: readonly string[] | undefined): Map<string, number> {
  const m = new Map<string, number>();
  if (!list) return m;
  for (let i = 0; i < list.length; i++) {
    const slug = list[i];
    if (slug && !m.has(slug)) m.set(slug, i);
  }
  return m;
}

// ---------------------------------------------------------------------------
// Recently-used styles — pure list ops (platform binds the storage).
// ---------------------------------------------------------------------------

/**
 * Record one or more just-used slugs at the front of the recency list, dedupe
 * (last-touched wins its position), and cap. `slugs` may be passed newest-last
 * (e.g. the whole current selection); it's reversed so the final entry ends up
 * most-recent.
 */
export function addRecentStyles(
  list: readonly string[],
  slugs: readonly string[],
  max = MAX_RECENT_STYLES,
): string[] {
  let next = [...list];
  for (const raw of slugs) {
    const slug = raw.trim();
    if (!slug) continue;
    next = [slug, ...next.filter((s) => s !== slug)];
  }
  return next.slice(0, max);
}

/** Parse a persisted JSON blob into a validated slug list (never throws). */
export function parseRecentStyles(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .slice(0, MAX_RECENT_STYLES);
  } catch {
    return [];
  }
}
