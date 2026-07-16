/** Data access: availability_rules, availability_blocks, booking_policies. */
import { z } from "zod";

import { diffAvailabilityRules, mergeWeeklyBlocks, type WeeklyBlock } from "../booking/weeklyHours";
import type { InkdSupabaseClient } from "../supabase/client";
import type {
  AvailabilityRule,
  AvailabilityRuleInsert,
  AvailabilityRuleUpdate,
  AvailabilityBlock,
  AvailabilityBlockInsert,
  BookingPolicy,
  BookingPolicyInsert,
} from "../types/rows";
import { unwrap, unwrapList, unwrapMaybe } from "./helpers";

// --- Weekly recurring rules -------------------------------------------------
export async function listAvailabilityRules(
  client: InkdSupabaseClient,
  artistId: string,
): Promise<AvailabilityRule[]> {
  return unwrapList(
    await client
      .from("availability_rules")
      .select("*")
      .eq("artist_id", artistId)
      .order("weekday", { ascending: true })
      .order("start_time", { ascending: true }),
  );
}

const ruleFields = z.object({
  location_id: z.string().uuid().nullable().optional(),
  weekday: z.number().int().min(0).max(6),
  start_time: z.string(), // "HH:MM" / "HH:MM:SS"
  end_time: z.string(),
  is_open: z.boolean().optional(),
});

export async function createAvailabilityRule(
  client: InkdSupabaseClient,
  artistId: string,
  input: z.input<typeof ruleFields>,
): Promise<AvailabilityRule> {
  const fields = ruleFields.parse(input);
  const insert: AvailabilityRuleInsert = { artist_id: artistId, ...fields };
  return unwrap(
    await client
      .from("availability_rules")
      .insert(insert)
      .select("*")
      .single(),
  );
}

const ruleUpdateFields = ruleFields.partial();

export async function updateAvailabilityRule(
  client: InkdSupabaseClient,
  id: string,
  patch: z.input<typeof ruleUpdateFields>,
): Promise<AvailabilityRule> {
  const fields = ruleUpdateFields.parse(patch) as AvailabilityRuleUpdate;
  return unwrap(
    await client
      .from("availability_rules")
      .update(fields)
      .eq("id", id)
      .select("*")
      .single(),
  );
}

export async function deleteAvailabilityRule(
  client: InkdSupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await client
    .from("availability_rules")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/**
 * Reconcile the artist's weekly open blocks against what's persisted, applying
 * the minimal set of insert/update/delete operations (never a blind
 * delete-all + re-insert). Supports multiple blocks per weekday. `existing` is
 * the current `availability_rules` snapshot; `desired` is the editor's block
 * list (blocks with an `id` map to persisted rows).
 */
export async function saveAvailabilityRules(
  client: InkdSupabaseClient,
  artistId: string,
  existing: AvailabilityRule[],
  desired: WeeklyBlock[],
): Promise<void> {
  const plan = diffAvailabilityRules(existing, mergeWeeklyBlocks(desired));

  for (const id of plan.toDelete) {
    await deleteAvailabilityRule(client, id);
  }
  for (const row of plan.toUpdate) {
    await updateAvailabilityRule(client, row.id, {
      weekday: row.weekday,
      start_time: row.start,
      end_time: row.end,
      is_open: true,
    });
  }
  for (const row of plan.toInsert) {
    await createAvailabilityRule(client, artistId, {
      weekday: row.weekday,
      start_time: row.start,
      end_time: row.end,
      is_open: true,
    });
  }
}

// --- Date-range blocks (vacations, holidays) --------------------------------
export async function listAvailabilityBlocks(
  client: InkdSupabaseClient,
  artistId: string,
  range?: { from?: string; to?: string },
): Promise<AvailabilityBlock[]> {
  let query = client
    .from("availability_blocks")
    .select("*")
    .eq("artist_id", artistId)
    .order("starts_at", { ascending: true });
  if (range?.from) query = query.gte("ends_at", range.from);
  if (range?.to) query = query.lte("starts_at", range.to);
  return unwrapList(await query);
}

const blockFields = z.object({
  location_id: z.string().uuid().nullable().optional(),
  block_type: z
    .enum(["vacation", "holiday", "personal", "sick", "custom"])
    .optional(),
  starts_at: z.string(),
  ends_at: z.string(),
  is_available: z.boolean().optional(),
  reason: z.string().max(500).nullable().optional(),
});

export async function createAvailabilityBlock(
  client: InkdSupabaseClient,
  artistId: string,
  input: z.input<typeof blockFields>,
): Promise<AvailabilityBlock> {
  const fields = blockFields.parse(input);
  const insert: AvailabilityBlockInsert = { artist_id: artistId, ...fields };
  return unwrap(
    await client
      .from("availability_blocks")
      .insert(insert)
      .select("*")
      .single(),
  );
}

export async function deleteAvailabilityBlock(
  client: InkdSupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await client
    .from("availability_blocks")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// --- Booking policy (one per artist) ----------------------------------------
export async function getBookingPolicy(
  client: InkdSupabaseClient,
  artistId: string,
): Promise<BookingPolicy | null> {
  return unwrapMaybe(
    await client
      .from("booking_policies")
      .select("*")
      .eq("artist_id", artistId)
      .maybeSingle(),
  );
}

const policyFields = z.object({
  booking_window: z
    .enum(["1mo", "2_3mo", "4_6mo", "1yr", "closed"])
    .optional(),
  allow_image_uploads: z.boolean().optional(),
  allow_document_uploads: z.boolean().optional(),
  require_medical_disclosure: z.boolean().optional(),
  min_notice_hours: z.number().int().nonnegative().optional(),
  max_active_requests: z.number().int().positive().nullable().optional(),
  auto_decline_when_closed: z.boolean().optional(),
  custom_intake_fields: z.array(z.record(z.unknown())).optional(),
});

/** Create-or-update the artist's single booking policy row. */
export async function upsertBookingPolicy(
  client: InkdSupabaseClient,
  artistId: string,
  input: z.input<typeof policyFields>,
): Promise<BookingPolicy> {
  const fields = policyFields.parse(input);
  const row: BookingPolicyInsert = {
    artist_id: artistId,
    ...fields,
    custom_intake_fields:
      fields.custom_intake_fields as BookingPolicyInsert["custom_intake_fields"],
  };
  return unwrap(
    await client
      .from("booking_policies")
      .upsert(row, { onConflict: "artist_id" })
      .select("*")
      .single(),
  );
}
