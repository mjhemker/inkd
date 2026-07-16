/**
 * Query-key builders for the Daily Drop surface. Kept in its own file (like
 * queryKeysFeed.ts) so the append-only key modules stay untouched. Every daily-
 * drop query shares the `["dailyDrop", ...]` prefix so reactions can invalidate
 * both today's card and the history strip at once.
 */
export const dailyDropQueryKeys = {
  all: () => ["dailyDrop"] as const,
  today: (userId: string | null, date: string) =>
    ["dailyDrop", "today", userId ?? "anon", date] as const,
  history: (userId: string | null) => ["dailyDrop", "history", userId ?? "anon"] as const,
} as const;
