/** Data access: artist_profiles + artist_styles + public artist discovery. */
import { z } from "zod";

import type { InkdSupabaseClient } from "../supabase/client";
import type {
  ArtistProfile,
  ArtistProfileUpdate,
  Style,
} from "../types/rows";
import { unwrap, unwrapList, clampLimit, unwrapMaybe } from "./helpers";

export async function getArtistProfileById(
  client: InkdSupabaseClient,
  id: string,
): Promise<ArtistProfile | null> {
  return unwrapMaybe(
    await client.from("artist_profiles").select("*").eq("id", id).maybeSingle(),
  );
}

export async function getArtistProfileByProfileId(
  client: InkdSupabaseClient,
  profileId: string,
): Promise<ArtistProfile | null> {
  return unwrapMaybe(
    await client
      .from("artist_profiles")
      .select("*")
      .eq("profile_id", profileId)
      .maybeSingle(),
  );
}

const listArtistsSchema = z.object({
  classification: z
    .enum(["shop_owner", "shop_resident", "private_suite", "independent"])
    .optional(),
  styleSlug: z.string().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

/** Published artists for discovery (RLS already hides unpublished ones). */
export async function listPublishedArtists(
  client: InkdSupabaseClient,
  params: z.input<typeof listArtistsSchema> = {},
): Promise<ArtistProfile[]> {
  const { classification, limit, offset } = listArtistsSchema.parse(params);
  let query = client
    .from("artist_profiles")
    .select("*")
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .range(offset ?? 0, (offset ?? 0) + clampLimit(limit, 30) - 1);
  if (classification) query = query.eq("classification", classification);
  return unwrapList(await query);
}

const updateArtistSchema = z
  .object({
    bio: z.string().max(4000).nullable(),
    tagline: z.string().max(160).nullable(),
    styles: z.array(z.string()).max(20),
    classification: z.enum([
      "shop_owner",
      "shop_resident",
      "private_suite",
      "independent",
    ]),
    travel_fly_out: z.boolean(),
    travel_house_calls: z.boolean(),
    travel_at_home: z.boolean(),
    accepts_new_clients: z.boolean(),
    years_experience: z.number().int().min(0).max(80).nullable(),
    instagram_handle: z.string().max(60).nullable(),
    is_published: z.boolean(),
  })
  .partial();

export async function updateArtistProfile(
  client: InkdSupabaseClient,
  id: string,
  patch: z.input<typeof updateArtistSchema>,
): Promise<ArtistProfile> {
  const fields = updateArtistSchema.parse(patch) as ArtistProfileUpdate;
  return unwrap(
    await client
      .from("artist_profiles")
      .update(fields)
      .eq("id", id)
      .select("*")
      .single(),
  );
}

/** The canonical style taxonomy (public read). */
export async function listStyles(
  client: InkdSupabaseClient,
): Promise<Style[]> {
  return unwrapList(
    await client
      .from("styles")
      .select("*")
      .order("sort_order", { ascending: true }),
  );
}

/** Styles tagged on an artist (via the normalized join). */
export async function listArtistStyles(
  client: InkdSupabaseClient,
  artistId: string,
): Promise<Style[]> {
  const rows = unwrapList(
    await client
      .from("artist_styles")
      .select("style_id, styles(*)")
      .eq("artist_id", artistId),
  ) as { styles: Style | null }[];
  return rows.map((r) => r.styles).filter((s): s is Style => s != null);
}

export async function addArtistStyle(
  client: InkdSupabaseClient,
  artistId: string,
  styleId: string,
): Promise<void> {
  const { error } = await client
    .from("artist_styles")
    .insert({ artist_id: artistId, style_id: styleId });
  if (error) throw error;
}

export async function removeArtistStyle(
  client: InkdSupabaseClient,
  artistId: string,
  styleId: string,
): Promise<void> {
  const { error } = await client
    .from("artist_styles")
    .delete()
    .eq("artist_id", artistId)
    .eq("style_id", styleId);
  if (error) throw error;
}
