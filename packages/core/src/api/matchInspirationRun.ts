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
  classifyMatchOutcome,
  describeInspiration,
  enrichMatchArtists,
  groupSimilarWorks,
  hasAnyDiscoverFilter,
  requestInspirationTags,
  type InspirationSummary,
  type MatchArtistGroup,
  type MatchOutcome,
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

  const rows = await findSimilarWorks(client, {
    embedding: inline.embedding,
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
  const groups = groupSimilarWorks(filtered, artists, {
    inspirationStyleSlugs: summary.styles.map((s) => s.slug),
    inspirationColorLabel: summary.colorLabel,
    maxWorksPerArtist: opts.maxWorksPerArtist,
  });

  return {
    summary,
    groups,
    outcome: classifyMatchOutcome(summary, groups),
    embedding: inline.embedding,
    modelVersion: inline.model_version,
  };
}
