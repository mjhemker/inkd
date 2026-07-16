/**
 * Data access: the cancellation waitlist (Wave 2).
 *
 * Two viewpoints share these functions under RLS:
 *   - client: manages their own `waitlist_entries`, reads offers addressed to
 *     them, and accepts/declines via the SECURITY DEFINER RPCs
 *     (`claim_waitlist_offer` / `decline_waitlist_offer`);
 *   - artist: reads their waitlist + offers, toggles `waitlist_enabled`, and
 *     manually opens a freed session to the waitlist
 *     (`waitlist_artist_open_session`).
 *
 * All matching / offer creation / cascade / double-booking guarding happens in
 * SQL (migration 20260717130000_waitlist.sql); this layer only reads and calls
 * the RPCs. No service-role usage.
 */
import { z } from "zod";

import type { InkdSupabaseClient } from "../supabase/client";
import type {
  WaitlistEntry,
  WaitlistEntryInsert,
  WaitlistEntryStatus,
  WaitlistOffer,
  WaitlistOfferStatus,
} from "../types/rows";
import { unwrap, unwrapList } from "./helpers";

// ===========================================================================
// Client — entries
// ===========================================================================
const createEntrySchema = z.object({
  artist_id: z.string().uuid(),
  service_id: z.string().uuid().nullable().optional(),
  earliest_date: z.string().nullable().optional(), // "YYYY-MM-DD"
  latest_date: z.string().nullable().optional(),
  preferred_weekdays: z.array(z.number().int().min(0).max(6)).nullable().optional(),
  preferred_time_start: z.string().nullable().optional(), // "HH:MM"
  preferred_time_end: z.string().nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
  priority: z.number().int().optional(),
});

export type CreateWaitlistEntryInput = z.input<typeof createEntrySchema>;

/** Client joins an artist's waitlist. `client_id` is forced to the current user
 * (RLS also enforces `client_id = auth.uid()`). */
export async function joinWaitlist(
  client: InkdSupabaseClient,
  clientId: string,
  input: CreateWaitlistEntryInput,
): Promise<WaitlistEntry> {
  const fields = createEntrySchema.parse(input);
  const insert: WaitlistEntryInsert = {
    client_id: clientId,
    ...fields,
    preferred_weekdays: fields.preferred_weekdays ?? null,
  };
  return unwrap(
    await client.from("waitlist_entries").insert(insert).select("*").single(),
  );
}

/** The current client's waitlist entries (newest first). Filter by status. */
export async function listClientWaitlistEntries(
  client: InkdSupabaseClient,
  clientId: string,
  opts: { status?: WaitlistEntryStatus | WaitlistEntryStatus[] } = {},
): Promise<WaitlistEntry[]> {
  let query = client
    .from("waitlist_entries")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (opts.status) {
    query = Array.isArray(opts.status)
      ? query.in("status", opts.status)
      : query.eq("status", opts.status);
  }
  return unwrapList(await query);
}

/** Client cancels one of their entries (RLS: own rows only). */
export async function cancelWaitlistEntry(
  client: InkdSupabaseClient,
  id: string,
): Promise<WaitlistEntry> {
  return unwrap(
    await client
      .from("waitlist_entries")
      .update({ status: "cancelled" })
      .eq("id", id)
      .select("*")
      .single(),
  );
}

// ===========================================================================
// Client — offers
// ===========================================================================
/** Offers addressed to the current client (pending first, newest first). */
export async function listClientWaitlistOffers(
  client: InkdSupabaseClient,
  clientId: string,
  opts: { status?: WaitlistOfferStatus | WaitlistOfferStatus[] } = {},
): Promise<WaitlistOffer[]> {
  let query = client
    .from("waitlist_offers")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (opts.status) {
    query = Array.isArray(opts.status)
      ? query.in("status", opts.status)
      : query.eq("status", opts.status);
  }
  return unwrapList(await query);
}

/** Accept an offer → booking + session (voids sibling offers). Returns the new
 * booking id. Guards against double-booking server-side. */
export async function claimWaitlistOffer(
  client: InkdSupabaseClient,
  offerId: string,
): Promise<string> {
  const { data, error } = await client.rpc("claim_waitlist_offer", {
    p_offer_id: offerId,
  });
  if (error) throw error;
  return data as string;
}

/** Decline an offer → cascades to the next candidate. */
export async function declineWaitlistOffer(
  client: InkdSupabaseClient,
  offerId: string,
): Promise<void> {
  const { error } = await client.rpc("decline_waitlist_offer", {
    p_offer_id: offerId,
  });
  if (error) throw error;
}

// ===========================================================================
// Artist — view + controls
// ===========================================================================
/** The artist's waitlist (active + offered by default). */
export async function listArtistWaitlistEntries(
  client: InkdSupabaseClient,
  artistId: string,
  opts: { status?: WaitlistEntryStatus | WaitlistEntryStatus[] } = {
    status: ["active", "offered"],
  },
): Promise<WaitlistEntry[]> {
  let query = client
    .from("waitlist_entries")
    .select("*")
    .eq("artist_id", artistId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });
  if (opts.status) {
    query = Array.isArray(opts.status)
      ? query.in("status", opts.status)
      : query.eq("status", opts.status);
  }
  return unwrapList(await query);
}

/** Live offers the artist has out to their waitlist. */
export async function listArtistWaitlistOffers(
  client: InkdSupabaseClient,
  artistId: string,
  opts: { status?: WaitlistOfferStatus | WaitlistOfferStatus[] } = { status: "pending" },
): Promise<WaitlistOffer[]> {
  let query = client
    .from("waitlist_offers")
    .select("*")
    .eq("artist_id", artistId)
    .order("created_at", { ascending: false });
  if (opts.status) {
    query = Array.isArray(opts.status)
      ? query.in("status", opts.status)
      : query.eq("status", opts.status);
  }
  return unwrapList(await query);
}

/** Artist manually opens a freed session slot to their waitlist → cascades the
 * first offer. Returns the opening id (or null if nobody matched / disabled). */
export async function openSessionToWaitlist(
  client: InkdSupabaseClient,
  sessionId: string,
): Promise<string | null> {
  const { data, error } = await client.rpc("waitlist_artist_open_session", {
    p_session_id: sessionId,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}

/** Enable/disable the waitlist for an artist (RLS: own profile). */
export async function setWaitlistEnabled(
  client: InkdSupabaseClient,
  artistId: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await client
    .from("artist_profiles")
    .update({ waitlist_enabled: enabled })
    .eq("id", artistId);
  if (error) throw error;
}
