/**
 * End-to-end "match my inspiration" orchestration (post-upload). Kept separate
 * from matchInspiration.ts so that file stays pure (type-only relative imports)
 * and unit-testable under `node --test`; this file wires in the two runtime
 * data-access calls — `requestInspirationTags` (the bearer proxy),
 * `findSimilarWorks` (the KNN RPC) — plus an optional intersection with
 * `searchArtists` so discover filters (location/price/books-open) narrow the
 * matched artists ("artists near me who match this vibe").
 *
 * Web + mobile both call `matchInspirationFromUrl` after their platform upload.
 */
import type { InkdSupabaseClient } from "../supabase/client";
import { searchArtists, type DiscoverParams } from "./discover";
import { findSimilarWorks } from "./similarWorks";
import {
  buildAffinityFallbackGroups,
  classifyMatchOutcome,
  describeInspiration,
  enrichMatchArtists,
  groupSimilarWorks,
  hasAnyDiscoverFilter,
  MAX_WORKS_PER_ARTIST,
  requestInspirationTags,
  type FallbackArtist,
  type InspirationSummary,
  type MatchArtistGroup,
  type MatchOutcome,
  type MatchWork,
} from "./matchInspiration";

export interface MatchInspirationResult {
  summary: InspirationSummary;
  groups: MatchArtistGroup[];
  outcome: MatchOutcome;
  /** The query embedding, exposed so a caller can re-run with tweaked filters. */
  embedding: number[];
  modelVersion: string;
}

export interface MatchInspirationOptions {
  /** Proxy endpoint. Web: "/api/match-inspiration"; mobile: absolute URL. */
  endpoint: string;
  accessToken?: string;
  limit?: number;
  excludeArtistId?: string;
  /** Restrict neighbors to these style slugs (e.g. a refine chip selection). */
  styleSlugs?: string[];
  /**
   * Optional discovery filters (location/price/books-open). When present the
   * matched artists are intersected with `search_artists`, so "artists near me
   * who match this vibe" works. Reuses the exact discover param shape.
   */
  discoverFilters?: DiscoverParams;
  maxWorksPerArtist?: number;
}

/**
 * Given an already-uploaded (signed) inspiration image URL, produce the full
 * grouped, ranked, outcome-classified result. This is the shared brain of the
 * feature — web + mobile both call it after their platform-specific upload.
 */
export async function matchInspirationFromUrl(
  client: InkdSupabaseClient,
  imageUrl: string,
  opts: MatchInspirationOptions,
): Promise<MatchInspirationResult> {
  const inline = await requestInspirationTags({
    endpoint: opts.endpoint,
    imageUrl,
    accessToken: opts.accessToken,
  });
  const summary = describeInspiration(inline.tags);

  // No readable aesthetic (or an untaggable image → all-zero/empty embedding):
  // don't pretend to search. Short-circuit to the graceful path.
  const hasEmbedding =
    Array.isArray(inline.embedding) && inline.embedding.some((x) => x !== 0);
  if (!summary.hasClearStyle || !hasEmbedding) {
    return {
      summary,
      groups: [],
      outcome: "no_style",
      embedding: inline.embedding ?? [],
      modelVersion: inline.model_version,
    };
  }

  const { groups, outcome } = await rankMatchesWithOutcome(
    client,
    inline.embedding,
    summary,
    opts,
  );
  return {
    summary,
    groups,
    outcome,
    embedding: inline.embedding,
    modelVersion: inline.model_version,
  };
}

export interface RankedMatch {
  groups: MatchArtistGroup[];
  outcome: MatchOutcome;
}

/**
 * Rank matches for a query embedding AND decide the outcome, with the
 * always-return-something guarantee: when the visual-similarity search finds NO
 * artists at all (`no_match`), fall back to the closest artists by style
 * affinity (or the top local artists) so the user is never left at a dead end.
 * Fallback groups are flagged `isAffinityFallback` and carry the outcome
 * `"fallback"` so the UI can frame them honestly ("No close matches yet — here's
 * who's nearby") instead of pretending they're similarity hits. Used by both the
 * first run and the re-search path (refine chips / discover filters).
 */
export async function rankMatchesWithOutcome(
  client: InkdSupabaseClient,
  embedding: number[],
  summary: InspirationSummary,
  opts: Omit<MatchInspirationOptions, "endpoint" | "accessToken"> = {},
): Promise<RankedMatch> {
  const groups = await rankMatchesForEmbedding(client, embedding, summary, opts);
  const outcome = classifyMatchOutcome(summary, groups);
  if (outcome === "no_match") {
    const fallback = await fetchAffinityFallbackGroups(client, summary, opts);
    if (fallback.length > 0) return { groups: fallback, outcome: "fallback" };
  }
  return { groups, outcome };
}

const FALLBACK_ARTIST_LIMIT = 12;

/**
 * The "closest artists by style" fallback pool. Searches artists by the
 * inspiration's detected style slugs (intersected with any active discover
 * filters); if that's empty, widens to the top local artists. Each becomes a
 * `MatchArtistGroup` flagged `isAffinityFallback` (no similarity meter), with a
 * few of the artist's public pieces as a preview strip.
 */
export async function fetchAffinityFallbackGroups(
  client: InkdSupabaseClient,
  summary: InspirationSummary,
  opts: Omit<MatchInspirationOptions, "endpoint" | "accessToken"> = {},
): Promise<MatchArtistGroup[]> {
  const detectedSlugs = summary.styles.map((s) => s.slug);
  const base: DiscoverParams = { ...(opts.discoverFilters ?? {}), limit: FALLBACK_ARTIST_LIMIT };

  let cards = await searchArtists(client, {
    ...base,
    styles: detectedSlugs.length > 0 ? detectedSlugs : undefined,
  });
  // No style-matched artist (or the image had no readable style): widen to the
  // top artists in the same discovery scope so we still show "who's nearby".
  if (cards.length === 0) cards = await searchArtists(client, base);
  if (opts.excludeArtistId) cards = cards.filter((c) => c.artist_id !== opts.excludeArtistId);
  if (cards.length === 0) return [];

  const worksByArtist = await fetchArtistPreviewWorks(client, cards.map((c) => c.artist_id));

  const artists: FallbackArtist[] = cards.map((c) => ({
    artistId: c.artist_id,
    handle: c.handle ?? null,
    displayName: c.display_name ?? "INKD artist",
    avatarUrl: c.avatar_url ?? null,
    styles: c.styles ?? [],
  }));
  return buildAffinityFallbackGroups(artists, worksByArtist, {
    detectedSlugs,
    colorLabel: summary.colorLabel,
    excludeArtistId: opts.excludeArtistId,
  });
}

/** A few public pieces per artist for the fallback preview strip (best-effort). */
async function fetchArtistPreviewWorks(
  client: InkdSupabaseClient,
  artistIds: string[],
): Promise<Map<string, MatchWork[]>> {
  const map = new Map<string, MatchWork[]>();
  if (artistIds.length === 0) return map;
  const { data, error } = await client
    .from("posts")
    .select("id, artist_id, cover_url, like_count")
    .in("artist_id", artistIds)
    .eq("is_public", true)
    .order("like_count", { ascending: false });
  if (error) return map;
  for (const row of (data ?? []) as {
    id: string;
    artist_id: string | null;
    cover_url: string | null;
  }[]) {
    if (!row.artist_id) continue;
    const arr = map.get(row.artist_id) ?? [];
    if (arr.length >= MAX_WORKS_PER_ARTIST) continue;
    arr.push({
      subjectType: "post",
      subjectId: row.id,
      imageUrl: row.cover_url ?? null,
      styles: [],
      colorType: "unknown",
      similarity: 0,
      similarityPercent: 0,
    });
    map.set(row.artist_id, arr);
  }
  return map;
}

/**
 * Rank + group matches for an ALREADY-computed query embedding (no tag step).
 * Reused when the client re-runs with tweaked discover filters or refine chips
 * — the inspiration image was tagged once; only the neighbor search re-runs.
 */
export async function rankMatchesForEmbedding(
  client: InkdSupabaseClient,
  embedding: number[],
  summary: InspirationSummary,
  opts: Omit<MatchInspirationOptions, "endpoint" | "accessToken"> = {},
): Promise<MatchArtistGroup[]> {
  const rows = await findSimilarWorks(client, {
    embedding,
    limit: opts.limit,
    excludeArtistId: opts.excludeArtistId,
    styleSlugs: opts.styleSlugs,
  });

  // Optional local filtering: intersect matched artists with a discover search.
  let filtered = rows;
  if (opts.discoverFilters && hasAnyDiscoverFilter(opts.discoverFilters)) {
    const cards = await searchArtists(client, { ...opts.discoverFilters, limit: 200 });
    const allowed = new Set(cards.map((c) => c.artist_id));
    filtered = rows.filter((r) => r.artist_id && allowed.has(r.artist_id));
  }

  const artistIds = filtered.map((r) => r.artist_id).filter(Boolean) as string[];
  const artists = await enrichMatchArtists(client, artistIds);
  return groupSimilarWorks(filtered, artists, {
    inspirationStyleSlugs: summary.styles.map((s) => s.slug),
    inspirationColorLabel: summary.colorLabel,
    maxWorksPerArtist: opts.maxWorksPerArtist,
  });
}
