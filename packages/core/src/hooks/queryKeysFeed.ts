/**
 * Query-key builders for the discovery feed surface. Kept in its own file
 * (companion to `./queryKeys.ts` / `./queryKeysExtras.ts`) so those append-only
 * modules stay untouched. Every feed query shares the `["feed", ...]` prefix so
 * the social mutations can optimistically patch all of them at once.
 */
import type { FeedArtistFilters, FeedScope } from "../api/feed";

export const feedQueryKeys = {
  all: () => ["feed"] as const,
  list: (
    scope: FeedScope,
    styleSlug: string | null,
    viewerId: string | null,
    /** Extra filter dimensions (panel multi-styles + artist-level filters). */
    filters?: { styleSlugs?: string[]; artistFilters?: FeedArtistFilters },
  ) =>
    [
      "feed",
      scope,
      styleSlug ?? "all",
      viewerId ?? "anon",
      // A stable string of the panel filters; "none" keeps the default feed
      // key identical to before this change (cache continuity).
      filters?.styleSlugs?.length || filters?.artistFilters
        ? JSON.stringify({
            s: [...(filters.styleSlugs ?? [])].sort(),
            a: filters.artistFilters ?? null,
          })
        : "none",
    ] as const,
} as const;
