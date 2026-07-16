/**
 * Data access: AI visual-similarity search (the "match my inspiration" wave)
 * and read access to AI image tags.
 *
 * Backed by the `similar_works` Postgres RPC (SECURITY DEFINER, cosine-KNN over
 * PUBLIC tagged images — migration 20260717070000) and the `tag-image` edge
 * function's `inline` mode (classify a query image, return tags + embedding
 * WITHOUT persisting). The match-inspiration flow is: upload/point at a query
 * image → `tagInspirationImage()` → feed its embedding to `findSimilarWorks()`.
 *
 * NOTE: `image_tags` / `similar_works` aren't in the generated `Database` type
 * yet (types regenerate post-merge, per docs/agents-runtime.md's convention).
 * So this module carries its own row types and calls `rpc` / `functions.invoke`
 * through a narrow structural cast — the same "reconcile in TS" pattern
 * `discover.ts` uses. When database.ts is regenerated these keep working
 * unchanged; the cast simply becomes redundant.
 */
import { z } from "zod";

import type { InkdSupabaseClient } from "../supabase/client";

// ---------------------------------------------------------------------------
// Domain types (mirror the DB enums + similar_works RETURNS TABLE).
// ---------------------------------------------------------------------------
export type ImageSubjectType = "portfolio_piece" | "post" | "flash_item";
export type ImageColorType = "color" | "black_grey" | "both" | "unknown";
export type ImageSizeEstimate = "small" | "medium" | "large" | "unknown";

/** One ranked neighbor from `similar_works`. `similarity` is 1 - cosine_distance. */
export interface SimilarWork {
  subject_type: ImageSubjectType;
  subject_id: string;
  artist_id: string | null;
  image_url: string | null;
  styles: string[];
  color_type: ImageColorType;
  similarity: number;
}

/** A style tag + confidence, as produced by the vision classifier. */
export interface StyleTag {
  slug: string;
  confidence: number;
}

/** The structured tags for one image (tag-image `inline` output / image_tags row). */
export interface ImageTagResult {
  styles: StyleTag[];
  placement: string[];
  color_type: ImageColorType;
  size_estimate: ImageSizeEstimate;
  subject_matter: string[];
  description: string;
}

/** tag-image `inline` mode response: tags + the query embedding to search with. */
export interface InlineTagResponse {
  ok: boolean;
  mode: "inline";
  tags: ImageTagResult;
  embedding: number[];
  model_version: string;
}

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------
export const similarWorksParamsSchema = z.object({
  /** L2-normalized query embedding (vector(256)); the tag-image output. */
  embedding: z.array(z.number()).min(1),
  limit: z.number().int().positive().max(100).optional(),
  /** Exclude one artist's own works (e.g. when searching from their profile). */
  excludeArtistId: z.string().uuid().optional(),
  /** Optionally require overlap with these canonical style slugs. */
  styleSlugs: z.array(z.string().min(1)).max(20).optional(),
});
export type SimilarWorksParams = z.input<typeof similarWorksParamsSchema>;

/** Structural view of just the client methods we call on not-yet-typed surfaces. */
type UntypedRpc = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
  functions: {
    invoke: (
      fn: string,
      opts: { body: unknown },
    ) => PromiseLike<{ data: unknown; error: unknown }>;
  };
};

/** Format a JS embedding as the pgvector literal `similar_works` expects. */
export function toPgVectorLiteral(embedding: number[]): string {
  return "[" + embedding.map((x) => (Number.isFinite(x) ? x : 0)).join(",") + "]";
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
/**
 * Find the most visually/stylistically similar PUBLIC artist works to a query
 * embedding. Runs under the caller's session; the RPC's publicness filter means
 * anon and authenticated see the same public results.
 */
export async function findSimilarWorks(
  client: InkdSupabaseClient,
  params: SimilarWorksParams,
): Promise<SimilarWork[]> {
  const p = similarWorksParamsSchema.parse(params);
  const { data, error } = await (client as unknown as UntypedRpc).rpc("similar_works", {
    p_embedding: toPgVectorLiteral(p.embedding),
    p_limit: p.limit ?? 20,
    p_exclude_artist: p.excludeArtistId ?? undefined,
    p_style_slugs: p.styleSlugs && p.styleSlugs.length > 0 ? p.styleSlugs : undefined,
  });
  if (error) throw error;
  return (data as SimilarWork[] | null) ?? [];
}

/**
 * Classify a query image via the `tag-image` edge function (inline mode — no
 * persistence) and return its tags + embedding. Feed the embedding straight to
 * `findSimilarWorks`. Requires an authorized caller (the function is bearer-
 * gated); intended to be invoked server-side or via an authenticated proxy.
 */
export async function tagInspirationImage(
  client: InkdSupabaseClient,
  imageUrl: string,
): Promise<InlineTagResponse> {
  const { data, error } = await (client as unknown as UntypedRpc).functions.invoke(
    "tag-image",
    { body: { mode: "inline", image_url: imageUrl } },
  );
  if (error) throw error;
  return data as InlineTagResponse;
}

/** One-shot convenience: tag a query image, then rank similar public works. */
export async function matchMyInspiration(
  client: InkdSupabaseClient,
  imageUrl: string,
  opts: { limit?: number; excludeArtistId?: string; styleSlugs?: string[] } = {},
): Promise<{ tags: ImageTagResult; results: SimilarWork[] }> {
  const inline = await tagInspirationImage(client, imageUrl);
  const results = await findSimilarWorks(client, {
    embedding: inline.embedding,
    limit: opts.limit,
    excludeArtistId: opts.excludeArtistId,
    styleSlugs: opts.styleSlugs,
  });
  return { tags: inline.tags, results };
}
