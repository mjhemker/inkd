/** Data access: services (preset + custom bookable services). */
import { z } from "zod";

import type { InkdSupabaseClient } from "../supabase/client";
import type { Service, ServiceInsert, ServiceUpdate } from "../types/rows";
import { unwrap, unwrapList, unwrapMaybe } from "./helpers";

/** All services for an artist (owner view — includes non-public). */
export async function listServices(
  client: InkdSupabaseClient,
  artistId: string,
): Promise<Service[]> {
  return unwrapList(
    await client
      .from("services")
      .select("*")
      .eq("artist_id", artistId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  );
}

/** Public services only (client-facing menu). RLS also enforces this. */
export async function listPublicServices(
  client: InkdSupabaseClient,
  artistId: string,
): Promise<Service[]> {
  return unwrapList(
    await client
      .from("services")
      .select("*")
      .eq("artist_id", artistId)
      .eq("is_public", true)
      .order("sort_order", { ascending: true }),
  );
}

export async function getService(
  client: InkdSupabaseClient,
  id: string,
): Promise<Service | null> {
  return unwrapMaybe(
    await client.from("services").select("*").eq("id", id).maybeSingle(),
  );
}

const serviceFields = z.object({
  location_id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  duration_minutes: z.number().int().positive().max(24 * 60).nullable().optional(),
  price_type: z
    .enum(["fixed", "hourly", "starting_at", "quote"])
    .optional(),
  price_cents: z.number().int().nonnegative().nullable().optional(),
  deposit_type: z.enum(["none", "fixed", "percent"]).optional(),
  deposit_amount_cents: z.number().int().nonnegative().nullable().optional(),
  deposit_percent: z.number().min(0).max(100).nullable().optional(),
  break_time_minutes: z.number().int().nonnegative().optional(),
  lead_time_hours: z.number().int().nonnegative().optional(),
  is_public: z.boolean().optional(),
  video_conferencing: z.boolean().optional(),
  add_ons: z.array(z.record(z.unknown())).optional(),
  calendar_ref: z.string().max(200).nullable().optional(),
  is_preset: z.boolean().optional(),
  preset_key: z.string().max(60).nullable().optional(),
  sort_order: z.number().int().optional(),
});

export async function createService(
  client: InkdSupabaseClient,
  artistId: string,
  input: z.input<typeof serviceFields>,
): Promise<Service> {
  const fields = serviceFields.parse(input);
  const insert: ServiceInsert = {
    artist_id: artistId,
    ...fields,
    add_ons: fields.add_ons as ServiceInsert["add_ons"],
  };
  return unwrap(
    await client.from("services").insert(insert).select("*").single(),
  );
}

const serviceUpdateFields = serviceFields.partial();

export async function updateService(
  client: InkdSupabaseClient,
  id: string,
  patch: z.input<typeof serviceUpdateFields>,
): Promise<Service> {
  const fields = serviceUpdateFields.parse(patch) as ServiceUpdate;
  return unwrap(
    await client
      .from("services")
      .update(fields)
      .eq("id", id)
      .select("*")
      .single(),
  );
}

export async function deleteService(
  client: InkdSupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await client.from("services").delete().eq("id", id);
  if (error) throw error;
}
