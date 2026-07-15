/**
 * Data access: waiver_templates (artist or INKD-global, MD/PA aware) and
 * signed_waivers (append-only e-signature records — immutable after insert).
 */
import { z } from "zod";

import type { InkdSupabaseClient } from "../supabase/client";
import type {
  WaiverTemplate,
  WaiverTemplateInsert,
  SignedWaiver,
  SignedWaiverInsert,
} from "../types/rows";
import { unwrap, unwrapList } from "./helpers";

/** Templates available to an artist: their own + active INKD-global ones.
 * RLS returns exactly this set, so a plain select is sufficient. */
export async function listWaiverTemplates(
  client: InkdSupabaseClient,
  opts: { state?: "MD" | "PA" } = {},
): Promise<WaiverTemplate[]> {
  let query = client
    .from("waiver_templates")
    .select("*")
    .order("created_at", { ascending: false });
  if (opts.state) query = query.eq("state", opts.state);
  return unwrapList(await query);
}

const templateFields = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().min(1),
  state: z.enum(["MD", "PA"]).nullable().optional(),
  version: z.number().int().positive().optional(),
  is_active: z.boolean().optional(),
  required_fields: z.array(z.record(z.unknown())).optional(),
});

export async function createWaiverTemplate(
  client: InkdSupabaseClient,
  artistId: string,
  input: z.input<typeof templateFields>,
): Promise<WaiverTemplate> {
  const fields = templateFields.parse(input);
  const insert: WaiverTemplateInsert = {
    artist_id: artistId,
    ...fields,
    required_fields:
      fields.required_fields as WaiverTemplateInsert["required_fields"],
  };
  return unwrap(
    await client
      .from("waiver_templates")
      .insert(insert)
      .select("*")
      .single(),
  );
}

/** Signed waivers for an artist (client and artist can both read their own). */
export async function listSignedWaivers(
  client: InkdSupabaseClient,
  opts: { artistId?: string; clientId?: string; bookingId?: string } = {},
): Promise<SignedWaiver[]> {
  let query = client
    .from("signed_waivers")
    .select("*")
    .order("signed_at", { ascending: false });
  if (opts.artistId) query = query.eq("artist_id", opts.artistId);
  if (opts.clientId) query = query.eq("client_id", opts.clientId);
  if (opts.bookingId) query = query.eq("booking_id", opts.bookingId);
  return unwrapList(await query);
}

const signWaiverSchema = z.object({
  template_id: z.string().uuid().nullable().optional(),
  artist_id: z.string().uuid(),
  client_id: z.string().uuid().nullable().optional(),
  booking_id: z.string().uuid().nullable().optional(),
  session_id: z.string().uuid().nullable().optional(),
  signer_name: z.string().trim().min(1).max(200),
  signer_email: z.string().email().nullable().optional(),
  signer_dob: z.string().nullable().optional(),
  state: z.enum(["MD", "PA"]),
  signature_type: z.enum(["drawn", "typed"]).nullable().optional(),
  signature_data: z.string().nullable().optional(),
  content_snapshot: z.string().min(1),
  retention_until: z.string().nullable().optional(),
});

/** Record a signed waiver. Immutable once written (DB trigger + no update RLS). */
export async function signWaiver(
  client: InkdSupabaseClient,
  input: z.input<typeof signWaiverSchema>,
): Promise<SignedWaiver> {
  const fields = signWaiverSchema.parse(input) as SignedWaiverInsert;
  return unwrap(
    await client.from("signed_waivers").insert(fields).select("*").single(),
  );
}
