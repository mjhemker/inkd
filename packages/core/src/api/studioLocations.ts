/** Data access: studio_locations (many per artist, geocoded). */
import { z } from "zod";

import type { InkdSupabaseClient } from "../supabase/client";
import type {
  StudioLocation,
  StudioLocationInsert,
  StudioLocationUpdate,
} from "../types/rows";
import { unwrap, unwrapList } from "./helpers";

export async function listStudioLocations(
  client: InkdSupabaseClient,
  artistId: string,
): Promise<StudioLocation[]> {
  return unwrapList(
    await client
      .from("studio_locations")
      .select("*")
      .eq("artist_id", artistId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true }),
  );
}

const locationFields = z.object({
  name: z.string().max(120).nullable().optional(),
  address_line1: z.string().max(200).nullable().optional(),
  address_line2: z.string().max(200).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  state: z.enum(["MD", "PA"]).nullable().optional(),
  postal_code: z.string().max(20).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  is_primary: z.boolean().optional(),
  is_public: z.boolean().optional(),
  phone: z.string().max(40).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function createStudioLocation(
  client: InkdSupabaseClient,
  artistId: string,
  input: z.input<typeof locationFields>,
): Promise<StudioLocation> {
  const fields = locationFields.parse(input);
  const insert: StudioLocationInsert = { artist_id: artistId, ...fields };
  return unwrap(
    await client.from("studio_locations").insert(insert).select("*").single(),
  );
}

export async function updateStudioLocation(
  client: InkdSupabaseClient,
  id: string,
  patch: z.input<typeof locationFields>,
): Promise<StudioLocation> {
  const fields = locationFields.parse(patch) as StudioLocationUpdate;
  return unwrap(
    await client
      .from("studio_locations")
      .update(fields)
      .eq("id", id)
      .select("*")
      .single(),
  );
}

export async function deleteStudioLocation(
  client: InkdSupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await client
    .from("studio_locations")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
