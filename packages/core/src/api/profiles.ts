/** Data access: profiles (public discovery reads + own-profile writes). */
import { z } from "zod";

import type { InkdSupabaseClient } from "../supabase/client";
import type { Profile, ProfileUpdate } from "../types/rows";
import { unwrap, unwrapMaybe } from "./helpers";

/** A profile by id. Returns null if not found / not visible under RLS. */
export async function getProfileById(
  client: InkdSupabaseClient,
  id: string,
): Promise<Profile | null> {
  return unwrapMaybe(
    await client.from("profiles").select("*").eq("id", id).maybeSingle(),
  );
}

/** A profile by handle (case-insensitive). Used for public artist pages. */
export async function getProfileByHandle(
  client: InkdSupabaseClient,
  handle: string,
): Promise<Profile | null> {
  return unwrapMaybe(
    await client
      .from("profiles")
      .select("*")
      .ilike("handle", handle)
      .maybeSingle(),
  );
}

const updateProfileSchema = z
  .object({
    handle: z.string().trim().min(2).max(30),
    display_name: z.string().trim().min(1).max(80),
    avatar_url: z.string().url().nullable(),
    bio: z.string().max(2000).nullable(),
    phone: z.string().max(40).nullable(),
    city: z.string().max(120).nullable(),
    state: z.enum(["MD", "PA"]).nullable(),
    is_public: z.boolean(),
  })
  .partial();

/** Patch the given profile row (RLS restricts this to the owner). */
export async function updateProfile(
  client: InkdSupabaseClient,
  id: string,
  patch: z.input<typeof updateProfileSchema>,
): Promise<Profile> {
  const fields = updateProfileSchema.parse(patch) as ProfileUpdate;
  return unwrap(
    await client
      .from("profiles")
      .update(fields)
      .eq("id", id)
      .select("*")
      .single(),
  );
}

/** Check whether a handle is free (case-insensitive). */
export async function isHandleAvailable(
  client: InkdSupabaseClient,
  handle: string,
): Promise<boolean> {
  const { count, error } = await client
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .ilike("handle", handle);
  if (error) throw error;
  return (count ?? 0) === 0;
}
