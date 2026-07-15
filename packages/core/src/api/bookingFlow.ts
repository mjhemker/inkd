/**
 * Higher-level orchestration for the booking pipeline UX — composes the primitive
 * data-access functions in `./booking`, `./messaging`, and `./artistProfiles`
 * into the flows the screens actually run:
 *
 *   - client: resolve a public artist by handle for the /book page;
 *   - artist: accept a request (→ booking + first session[s]), decline with a
 *     reason, or ask a question — the last two link to the messages thread.
 *
 * Everything runs under the caller's RLS session (no service role).
 */
import { z } from "zod";

import type { InkdSupabaseClient } from "../supabase/client";
import type {
  ArtistProfile,
  Booking,
  BookingRequest,
  Profile,
  Session,
  Thread,
} from "../types/rows";
import { unwrapMaybe } from "./helpers";
import { getArtistProfileByProfileId } from "./artistProfiles";
import {
  createBooking,
  createSession,
  setBookingRequestStatus,
} from "./booking";
import { createThread, sendMessage } from "./messaging";

// ---------------------------------------------------------------------------
// Client: resolve the artist behind a public @handle for /book/[artistHandle].
// ---------------------------------------------------------------------------
export interface PublicArtist {
  profile: Profile;
  artist: ArtistProfile;
}

/**
 * Look up a bookable artist by their public handle. Returns null when the handle
 * is unknown, private, or belongs to a client-only account. RLS only exposes
 * public profiles + published artist profiles to anon/other users.
 */
export async function getPublicArtistByHandle(
  client: InkdSupabaseClient,
  handle: string,
): Promise<PublicArtist | null> {
  const normalized = handle.trim().replace(/^@/, "");
  if (!normalized) return null;
  const profile = unwrapMaybe(
    await client
      .from("profiles")
      .select("*")
      .ilike("handle", normalized)
      .maybeSingle(),
  ) as Profile | null;
  if (!profile) return null;
  const artist = await getArtistProfileByProfileId(client, profile.id);
  if (!artist) return null;
  return { profile, artist };
}

// ---------------------------------------------------------------------------
// Artist: accept a request → create the booking + its first session(s).
// ---------------------------------------------------------------------------
const acceptSchema = z.object({
  title: z.string().max(200).nullable().optional(),
  totalPriceCents: z.number().int().nonnegative().nullable().optional(),
  depositCents: z.number().int().nonnegative().nullable().optional(),
  /** How many sessions to seed for a multi-session project (default 1). */
  sessionCount: z.number().int().min(1).max(24).optional(),
  locationId: z.string().uuid().nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
});

export interface AcceptRequestResult {
  booking: Booking;
  sessions: Session[];
}

/**
 * Convert an accepted booking request into a live booking with its first
 * session(s). The deposit is attached to session #1. Marks the request
 * `converted` last so the row moves out of the inbox only once the booking
 * exists. Not a DB transaction — callers should surface partial failures.
 */
export async function acceptBookingRequest(
  client: InkdSupabaseClient,
  artistId: string,
  request: Pick<BookingRequest, "id" | "client_id" | "service_id" | "location_id">,
  input: z.input<typeof acceptSchema> = {},
): Promise<AcceptRequestResult> {
  const opts = acceptSchema.parse(input);
  const count = opts.sessionCount ?? 1;
  const locationId = opts.locationId ?? request.location_id ?? null;

  const booking = await createBooking(client, artistId, {
    request_id: request.id,
    client_id: request.client_id,
    service_id: request.service_id ?? null,
    title: opts.title ?? null,
    total_price_cents: opts.totalPriceCents ?? null,
    deposit_cents: opts.depositCents ?? null,
    notes: opts.notes ?? null,
  });

  const sessions: Session[] = [];
  for (let i = 1; i <= count; i++) {
    const session = await createSession(client, artistId, {
      booking_id: booking.id,
      client_id: request.client_id,
      location_id: locationId,
      session_number: i,
      deposit_cents: i === 1 ? opts.depositCents ?? 0 : 0,
    });
    sessions.push(session);
  }

  await setBookingRequestStatus(client, request.id, "converted");
  return { booking, sessions };
}

// ---------------------------------------------------------------------------
// Artist: decline + ask-a-question — both link to the messages thread.
// ---------------------------------------------------------------------------

/** Find or create the thread tied to a booking request (client ↔ artist). */
export async function ensureThreadForRequest(
  client: InkdSupabaseClient,
  request: Pick<BookingRequest, "id" | "artist_id" | "client_id">,
  subject?: string | null,
): Promise<Thread> {
  const existing = unwrapMaybe(
    await client
      .from("threads")
      .select("*")
      .eq("booking_request_id", request.id)
      .maybeSingle(),
  );
  if (existing) return existing;
  return createThread(client, {
    artist_id: request.artist_id,
    client_id: request.client_id,
    booking_request_id: request.id,
    subject: subject ?? "Booking request",
  });
}

/**
 * Decline a request. Sets the status to `declined`; when a reason is given it's
 * sent to the client as an artist message on the request's thread (created on
 * demand) so the decision is on the record and the client hears why.
 */
export async function declineBookingRequest(
  client: InkdSupabaseClient,
  request: Pick<BookingRequest, "id" | "artist_id" | "client_id">,
  reason: string | null | undefined,
  artistProfileId: string,
): Promise<void> {
  await setBookingRequestStatus(client, request.id, "declined");
  const trimmed = reason?.trim();
  if (!trimmed) return;
  const thread = await ensureThreadForRequest(client, request, "Booking update");
  await sendMessage(client, {
    thread_id: thread.id,
    sender_kind: "artist",
    sender_profile_id: artistProfileId,
    body: trimmed,
  });
}

/**
 * Ask the client a question about their request. Moves the request to
 * `reviewing`, ensures a thread exists, and posts the question. Returns the
 * thread so the UI can deep-link into messages.
 */
export async function askQuestionOnRequest(
  client: InkdSupabaseClient,
  request: Pick<BookingRequest, "id" | "artist_id" | "client_id">,
  question: string,
  artistProfileId: string,
): Promise<Thread> {
  const thread = await ensureThreadForRequest(client, request, "Booking request");
  const trimmed = question.trim();
  if (trimmed) {
    await sendMessage(client, {
      thread_id: thread.id,
      sender_kind: "artist",
      sender_profile_id: artistProfileId,
      body: trimmed,
    });
  }
  await setBookingRequestStatus(client, request.id, "reviewing");
  return thread;
}
