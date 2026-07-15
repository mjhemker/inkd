/**
 * Dual-role model helpers. Every INKD user is a client; some are also artists
 * (they have an `artist_profiles` row). These helpers read/flip that state.
 *
 * All operations are RLS-scoped to the current authed user — no service role.
 */
import { z } from "zod";

import type { InkdSupabaseClient } from "../supabase/client";
import { getUser } from "./core";
import type {
  Profile,
  ProfileUpdate,
  ArtistProfile,
  ArtistProfileUpdate,
} from "../types/rows";

/** Fetch the current user's profile row (or null if unauthenticated / missing). */
export async function getCurrentProfile(
  client: InkdSupabaseClient,
): Promise<Profile | null> {
  const user = await getUser(client);
  if (!user) return null;
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Idempotently ensure a `profiles` row exists for the current user and patch
 * any provided fields. The `handle_new_user` DB trigger normally creates the
 * row at sign-up; this is the app-side bootstrap/backfill (e.g. to set handle).
 */
const ensureProfileSchema = z
  .object({
    handle: z.string().trim().min(2).max(30).optional(),
    display_name: z.string().trim().min(1).max(80).optional(),
    avatar_url: z.string().url().optional(),
    bio: z.string().max(2000).optional(),
    phone: z.string().max(40).optional(),
    city: z.string().max(120).optional(),
  })
  .partial();

export async function ensureProfile(
  client: InkdSupabaseClient,
  patch: z.input<typeof ensureProfileSchema> = {},
): Promise<Profile> {
  const user = await getUser(client);
  if (!user) throw new Error("ensureProfile: no authenticated user");
  const fields = ensureProfileSchema.parse(patch) as ProfileUpdate;
  const { data, error } = await client
    .from("profiles")
    .upsert(
      { id: user.id, email: user.email ?? null, ...fields },
      { onConflict: "id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** True when the current user has an artist profile. */
export async function isArtist(client: InkdSupabaseClient): Promise<boolean> {
  const user = await getUser(client);
  if (!user) return false;
  const { count, error } = await client
    .from("artist_profiles")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id);
  if (error) throw error;
  return (count ?? 0) > 0;
}

/** Fetch the current user's artist profile, or null if they are client-only. */
export async function getCurrentArtistProfile(
  client: InkdSupabaseClient,
): Promise<ArtistProfile | null> {
  const user = await getUser(client);
  if (!user) return null;
  const { data, error } = await client
    .from("artist_profiles")
    .select("*")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

const becomeArtistSchema = z
  .object({
    tagline: z.string().max(160).optional(),
    bio: z.string().max(4000).optional(),
    classification: z
      .enum(["shop_owner", "shop_resident", "private_suite", "independent"])
      .optional(),
    instagram_handle: z.string().max(60).optional(),
  })
  .partial();

/**
 * Promote the current client to an artist: sets `profiles.is_artist` and creates
 * the `artist_profiles` row with `onboarding_step = 0`. Idempotent — returns the
 * existing artist profile if one already exists.
 */
export async function becomeArtist(
  client: InkdSupabaseClient,
  input: z.input<typeof becomeArtistSchema> = {},
): Promise<ArtistProfile> {
  const user = await getUser(client);
  if (!user) throw new Error("becomeArtist: no authenticated user");

  const existing = await getCurrentArtistProfile(client);
  if (existing) return existing;

  // Make sure a profile row exists before flipping is_artist.
  await ensureProfile(client);

  const fields = becomeArtistSchema.parse(input);
  const { data, error } = await client
    .from("artist_profiles")
    .insert({ profile_id: user.id, onboarding_step: 0, ...fields })
    .select("*")
    .single();
  if (error) throw error;

  const { error: flagError } = await client
    .from("profiles")
    .update({ is_artist: true })
    .eq("id", user.id);
  if (flagError) throw flagError;

  return data;
}

/** Advance / set the artist onboarding step (SPEC §3 progress bar). */
export async function setOnboardingStep(
  client: InkdSupabaseClient,
  artistId: string,
  step: number,
  opts: { completed?: boolean } = {},
): Promise<ArtistProfile> {
  const patch: ArtistProfileUpdate = { onboarding_step: step };
  if (opts.completed) patch.onboarding_completed_at = new Date().toISOString();
  const { data, error } = await client
    .from("artist_profiles")
    .update(patch)
    .eq("id", artistId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
