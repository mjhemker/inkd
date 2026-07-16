/**
 * Data access: the booking pipeline — booking_requests -> bookings -> sessions,
 * plus read access to the payments ledger.
 *
 * Two viewpoints share these functions: the client (owns booking_requests, reads
 * everything about their own engagements) and the artist (triages requests,
 * manages bookings/sessions). RLS enforces which rows each side can touch.
 */
import { z } from "zod";

import type { InkdSupabaseClient } from "../supabase/client";
import type {
  BookingRequest,
  BookingRequestInsert,
  BookingRequestStatus,
  Booking,
  BookingInsert,
  BookingStatus,
  Session,
  SessionInsert,
  SessionUpdate,
  Payment,
} from "../types/rows";
import { unwrap, unwrapList, clampLimit, unwrapMaybe } from "./helpers";

// ===========================================================================
// booking_requests
// ===========================================================================
const requestStatuses = [
  "pending",
  "reviewing",
  "accepted",
  "declined",
  "converted",
  "withdrawn",
  "expired",
] as const;

/** Requests for an artist's inbox (artist view). Optionally filter by status. */
export async function listArtistBookingRequests(
  client: InkdSupabaseClient,
  artistId: string,
  opts: { status?: BookingRequestStatus; limit?: number; offset?: number } = {},
): Promise<BookingRequest[]> {
  const offset = opts.offset ?? 0;
  let query = client
    .from("booking_requests")
    .select("*")
    .eq("artist_id", artistId)
    .order("created_at", { ascending: false })
    .range(offset, offset + clampLimit(opts.limit) - 1);
  if (opts.status) query = query.eq("status", opts.status);
  return unwrapList(await query);
}

/** Requests the current client has submitted (client view). */
export async function listClientBookingRequests(
  client: InkdSupabaseClient,
  clientId: string,
): Promise<BookingRequest[]> {
  return unwrapList(
    await client
      .from("booking_requests")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
  );
}

export async function getBookingRequest(
  client: InkdSupabaseClient,
  id: string,
): Promise<BookingRequest | null> {
  return unwrapMaybe(
    await client
      .from("booking_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle(),
  );
}

const createRequestSchema = z.object({
  artist_id: z.string().uuid(),
  service_id: z.string().uuid().nullable().optional(),
  location_id: z.string().uuid().nullable().optional(),
  placement: z.string().max(200).nullable().optional(),
  // Structured body-map placement (mirrors the visual picker). `placement`
  // above is kept as the free-text specifics note / back-compat.
  placement_region: z.string().max(40).nullable().optional(),
  placement_side: z.enum(["left", "right"]).nullable().optional(),
  placement_view: z.enum(["front", "back"]).nullable().optional(),
  size_description: z.string().max(200).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
  reference_uploads: z.array(z.record(z.unknown())).optional(),
  budget_min_cents: z.number().int().nonnegative().nullable().optional(),
  budget_max_cents: z.number().int().nonnegative().nullable().optional(),
  has_medical_flags: z.boolean().optional(),
  medical_notes: z.string().max(2000).nullable().optional(),
  is_cover_up: z.boolean().optional(),
  is_first_tattoo: z.boolean().nullable().optional(),
  preferred_dates: z.array(z.record(z.unknown())).optional(),
});

/** Client submits a new booking request. `client_id` is set to the current
 * user (RLS also enforces `client_id = auth.uid()`). */
export async function createBookingRequest(
  client: InkdSupabaseClient,
  clientId: string,
  input: z.input<typeof createRequestSchema>,
): Promise<BookingRequest> {
  const fields = createRequestSchema.parse(input);
  const insert: BookingRequestInsert = {
    client_id: clientId,
    ...fields,
    reference_uploads:
      fields.reference_uploads as BookingRequestInsert["reference_uploads"],
    preferred_dates:
      fields.preferred_dates as BookingRequestInsert["preferred_dates"],
  };
  return unwrap(
    await client
      .from("booking_requests")
      .insert(insert)
      .select("*")
      .single(),
  );
}

/** Artist (or client, for withdraw) transitions a request's status. */
export async function setBookingRequestStatus(
  client: InkdSupabaseClient,
  id: string,
  status: BookingRequestStatus,
): Promise<BookingRequest> {
  z.enum(requestStatuses).parse(status);
  return unwrap(
    await client
      .from("booking_requests")
      .update({ status })
      .eq("id", id)
      .select("*")
      .single(),
  );
}

// ===========================================================================
// bookings
// ===========================================================================
export async function listArtistBookings(
  client: InkdSupabaseClient,
  artistId: string,
  opts: { status?: BookingStatus } = {},
): Promise<Booking[]> {
  let query = client
    .from("bookings")
    .select("*")
    .eq("artist_id", artistId)
    .order("created_at", { ascending: false });
  if (opts.status) query = query.eq("status", opts.status);
  return unwrapList(await query);
}

export async function listClientBookings(
  client: InkdSupabaseClient,
  clientId: string,
): Promise<Booking[]> {
  return unwrapList(
    await client
      .from("bookings")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
  );
}

export async function getBooking(
  client: InkdSupabaseClient,
  id: string,
): Promise<Booking | null> {
  return unwrapMaybe(
    await client.from("bookings").select("*").eq("id", id).maybeSingle(),
  );
}

const createBookingSchema = z.object({
  request_id: z.string().uuid().nullable().optional(),
  client_id: z.string().uuid(),
  service_id: z.string().uuid().nullable().optional(),
  title: z.string().max(200).nullable().optional(),
  total_price_cents: z.number().int().nonnegative().nullable().optional(),
  deposit_cents: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
});

/** Artist converts an accepted request into a booking. */
export async function createBooking(
  client: InkdSupabaseClient,
  artistId: string,
  input: z.input<typeof createBookingSchema>,
): Promise<Booking> {
  const fields = createBookingSchema.parse(input);
  const insert: BookingInsert = { artist_id: artistId, ...fields };
  return unwrap(
    await client.from("bookings").insert(insert).select("*").single(),
  );
}

export async function setBookingStatus(
  client: InkdSupabaseClient,
  id: string,
  status: BookingStatus,
): Promise<Booking> {
  return unwrap(
    await client
      .from("bookings")
      .update({ status })
      .eq("id", id)
      .select("*")
      .single(),
  );
}

// ===========================================================================
// sessions
// ===========================================================================
export async function listBookingSessions(
  client: InkdSupabaseClient,
  bookingId: string,
): Promise<Session[]> {
  return unwrapList(
    await client
      .from("sessions")
      .select("*")
      .eq("booking_id", bookingId)
      .order("session_number", { ascending: true }),
  );
}

/** Upcoming scheduled sessions for an artist's calendar. */
export async function listArtistSessions(
  client: InkdSupabaseClient,
  artistId: string,
  range?: { from?: string; to?: string },
): Promise<Session[]> {
  let query = client
    .from("sessions")
    .select("*")
    .eq("artist_id", artistId)
    .order("scheduled_start", { ascending: true });
  if (range?.from) query = query.gte("scheduled_start", range.from);
  if (range?.to) query = query.lte("scheduled_start", range.to);
  return unwrapList(await query);
}

const createSessionSchema = z.object({
  booking_id: z.string().uuid(),
  client_id: z.string().uuid(),
  location_id: z.string().uuid().nullable().optional(),
  session_number: z.number().int().positive().optional(),
  scheduled_start: z.string().nullable().optional(),
  scheduled_end: z.string().nullable().optional(),
  duration_minutes: z.number().int().positive().nullable().optional(),
  deposit_cents: z.number().int().nonnegative().optional(),
  balance_cents: z.number().int().nonnegative().optional(),
  notes: z.string().max(4000).nullable().optional(),
});

export async function createSession(
  client: InkdSupabaseClient,
  artistId: string,
  input: z.input<typeof createSessionSchema>,
): Promise<Session> {
  const fields = createSessionSchema.parse(input);
  const insert: SessionInsert = { artist_id: artistId, ...fields };
  return unwrap(
    await client.from("sessions").insert(insert).select("*").single(),
  );
}

const updateSessionSchema = z
  .object({
    location_id: z.string().uuid().nullable(),
    session_number: z.number().int().positive(),
    status: z.enum([
      "scheduled",
      "confirmed",
      "completed",
      "cancelled",
      "no_show",
      "rescheduled",
    ]),
    scheduled_start: z.string().nullable(),
    scheduled_end: z.string().nullable(),
    duration_minutes: z.number().int().positive().nullable(),
    deposit_cents: z.number().int().nonnegative(),
    deposit_paid: z.boolean(),
    balance_cents: z.number().int().nonnegative(),
    balance_paid: z.boolean(),
    notes: z.string().max(4000).nullable(),
  })
  .partial();

export async function updateSession(
  client: InkdSupabaseClient,
  id: string,
  patch: z.input<typeof updateSessionSchema>,
): Promise<Session> {
  const fields = updateSessionSchema.parse(patch) as SessionUpdate;
  return unwrap(
    await client
      .from("sessions")
      .update(fields)
      .eq("id", id)
      .select("*")
      .single(),
  );
}

// ===========================================================================
// payments (read-only from the app; writes happen server-side via Stripe)
// ===========================================================================
export async function listBookingPayments(
  client: InkdSupabaseClient,
  bookingId: string,
): Promise<Payment[]> {
  return unwrapList(
    await client
      .from("payments")
      .select("*")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false }),
  );
}
