/**
 * Query-key builders for the discovery feed surface. Kept in its own file
 * (companion to `./queryKeys.ts` / `./queryKeysExtras.ts`) so those append-only
 * modules stay untouched. Every feed query shares the `["feed", ...]` prefix so
 * the social mutations can optimistically patch all of them at once.
 */
import type { FeedScope } from "../api/feed";

export const feedQueryKeys = {
  all: () => ["feed"] as const,
  list: (scope: FeedScope, styleSlug: string | null, viewerId: string | null) =>
    ["feed", scope, styleSlug ?? "all", viewerId ?? "anon"] as const,
} as const;
