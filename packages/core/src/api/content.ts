/** Data access: posts, portfolio_pieces, flash_sheets, flash_items (SPEC §3/§4). */
import { z } from "zod";

import type { InkdSupabaseClient } from "../supabase/client";
import type {
  Post,
  PostInsert,
  PortfolioPiece,
  PortfolioPieceInsert,
  FlashSheet,
  FlashSheetInsert,
  FlashItem,
  FlashItemInsert,
} from "../types/rows";
import { unwrap, unwrapList, clampLimit } from "./helpers";

// --- posts ------------------------------------------------------------------
export async function listArtistPosts(
  client: InkdSupabaseClient,
  artistId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<Post[]> {
  const offset = opts.offset ?? 0;
  return unwrapList(
    await client
      .from("posts")
      .select("*")
      .eq("artist_id", artistId)
      .order("created_at", { ascending: false })
      .range(offset, offset + clampLimit(opts.limit) - 1),
  );
}

/** Public discovery feed across all artists, newest first. */
export async function listPublicFeed(
  client: InkdSupabaseClient,
  opts: { limit?: number; offset?: number } = {},
): Promise<Post[]> {
  const offset = opts.offset ?? 0;
  return unwrapList(
    await client
      .from("posts")
      .select("*")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .range(offset, offset + clampLimit(opts.limit, 30) - 1),
  );
}

const postFields = z.object({
  caption: z.string().max(4000).nullable().optional(),
  media: z.array(z.record(z.unknown())).optional(),
  cover_url: z.string().url().nullable().optional(),
  source: z.enum(["inkd", "instagram", "manual_upload"]).optional(),
  instagram_id: z.string().max(120).nullable().optional(),
  instagram_permalink: z.string().url().nullable().optional(),
  is_public: z.boolean().optional(),
});

export async function createPost(
  client: InkdSupabaseClient,
  artistId: string,
  input: z.input<typeof postFields>,
): Promise<Post> {
  const fields = postFields.parse(input);
  const insert: PostInsert = {
    artist_id: artistId,
    ...fields,
    media: fields.media as PostInsert["media"],
  };
  return unwrap(await client.from("posts").insert(insert).select("*").single());
}

export async function deletePost(
  client: InkdSupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await client.from("posts").delete().eq("id", id);
  if (error) throw error;
}

// --- portfolio_pieces -------------------------------------------------------
export async function listPortfolioPieces(
  client: InkdSupabaseClient,
  artistId: string,
): Promise<PortfolioPiece[]> {
  return unwrapList(
    await client
      .from("portfolio_pieces")
      .select("*")
      .eq("artist_id", artistId)
      .order("sort_order", { ascending: true }),
  );
}

const portfolioFields = z.object({
  post_id: z.string().uuid().nullable().optional(),
  title: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  placement: z.string().max(120).nullable().optional(),
  style_tags: z.array(z.string()).optional(),
  is_healed: z.boolean().nullable().optional(),
  is_public: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

export async function createPortfolioPiece(
  client: InkdSupabaseClient,
  artistId: string,
  input: z.input<typeof portfolioFields>,
): Promise<PortfolioPiece> {
  const fields = portfolioFields.parse(input);
  const insert: PortfolioPieceInsert = { artist_id: artistId, ...fields };
  return unwrap(
    await client
      .from("portfolio_pieces")
      .insert(insert)
      .select("*")
      .single(),
  );
}

export async function deletePortfolioPiece(
  client: InkdSupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await client
    .from("portfolio_pieces")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// --- flash sheets + items ---------------------------------------------------
export async function listFlashSheets(
  client: InkdSupabaseClient,
  artistId: string,
): Promise<FlashSheet[]> {
  return unwrapList(
    await client
      .from("flash_sheets")
      .select("*")
      .eq("artist_id", artistId)
      .order("created_at", { ascending: false }),
  );
}

export async function listFlashItems(
  client: InkdSupabaseClient,
  flashSheetId: string,
): Promise<FlashItem[]> {
  return unwrapList(
    await client
      .from("flash_items")
      .select("*")
      .eq("flash_sheet_id", flashSheetId)
      .order("sort_order", { ascending: true }),
  );
}

const flashSheetFields = z.object({
  title: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  cover_url: z.string().url().nullable().optional(),
  is_public: z.boolean().optional(),
});

export async function createFlashSheet(
  client: InkdSupabaseClient,
  artistId: string,
  input: z.input<typeof flashSheetFields>,
): Promise<FlashSheet> {
  const fields = flashSheetFields.parse(input);
  const insert: FlashSheetInsert = { artist_id: artistId, ...fields };
  return unwrap(
    await client.from("flash_sheets").insert(insert).select("*").single(),
  );
}

const flashItemFields = z.object({
  flash_sheet_id: z.string().uuid(),
  title: z.string().max(200).nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  price_cents: z.number().int().nonnegative().nullable().optional(),
  is_repeatable: z.boolean().optional(),
  is_available: z.boolean().optional(),
  placement_suggestion: z.string().max(120).nullable().optional(),
  size_inches: z.number().nonnegative().nullable().optional(),
  sort_order: z.number().int().optional(),
});

export async function createFlashItem(
  client: InkdSupabaseClient,
  artistId: string,
  input: z.input<typeof flashItemFields>,
): Promise<FlashItem> {
  const fields = flashItemFields.parse(input);
  const insert: FlashItemInsert = { artist_id: artistId, ...fields };
  return unwrap(
    await client.from("flash_items").insert(insert).select("*").single(),
  );
}
