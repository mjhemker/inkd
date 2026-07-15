/**
 * Hooks for the booking pipeline beyond raw requests: bookings, sessions, the
 * payments ledger, and the artist triage/accept mutations. Query keys are kept
 * local (hierarchical + typo-proof) so this module is fully additive.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  listArtistBookings,
  listClientBookings,
  getBooking,
  setBookingStatus,
  listBookingSessions,
  listArtistSessions,
  createSession,
  updateSession,
  listBookingPayments,
} from "../api/booking";
import {
  acceptBookingRequest,
  declineBookingRequest,
  askQuestionOnRequest,
} from "../api/bookingFlow";
import type {
  BookingRequest,
  BookingStatus,
} from "../types/rows";
import { useInkdClient } from "./context";

export const pipelineKeys = {
  artistBookings: (artistId: string, status?: string) =>
    ["bookings", "artist", artistId, status ?? "all"] as const,
  clientBookings: (clientId: string) => ["bookings", "client", clientId] as const,
  booking: (id: string) => ["booking", id] as const,
  bookingSessions: (bookingId: string) => ["sessions", "booking", bookingId] as const,
  artistSessions: (artistId: string) => ["sessions", "artist", artistId] as const,
  bookingPayments: (bookingId: string) => ["payments", "booking", bookingId] as const,
};

// --- Queries ----------------------------------------------------------------
export function useArtistBookings(artistId: string, status?: BookingStatus) {
  const client = useInkdClient();
  return useQuery({
    queryKey: pipelineKeys.artistBookings(artistId, status),
    queryFn: () => listArtistBookings(client, artistId, { status }),
    enabled: Boolean(artistId),
  });
}

export function useClientBookings(clientId: string) {
  const client = useInkdClient();
  return useQuery({
    queryKey: pipelineKeys.clientBookings(clientId),
    queryFn: () => listClientBookings(client, clientId),
    enabled: Boolean(clientId),
  });
}

export function useBooking(id: string) {
  const client = useInkdClient();
  return useQuery({
    queryKey: pipelineKeys.booking(id),
    queryFn: () => getBooking(client, id),
    enabled: Boolean(id),
  });
}

export function useBookingSessions(bookingId: string) {
  const client = useInkdClient();
  return useQuery({
    queryKey: pipelineKeys.bookingSessions(bookingId),
    queryFn: () => listBookingSessions(client, bookingId),
    enabled: Boolean(bookingId),
  });
}

export function useArtistSessions(
  artistId: string,
  range?: { from?: string; to?: string },
) {
  const client = useInkdClient();
  return useQuery({
    queryKey: [...pipelineKeys.artistSessions(artistId), range ?? null],
    queryFn: () => listArtistSessions(client, artistId, range),
    enabled: Boolean(artistId),
  });
}

export function useBookingPayments(bookingId: string) {
  const client = useInkdClient();
  return useQuery({
    queryKey: pipelineKeys.bookingPayments(bookingId),
    queryFn: () => listBookingPayments(client, bookingId),
    enabled: Boolean(bookingId),
  });
}

// --- Mutations --------------------------------------------------------------
function useInvalidatePipeline(artistId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["bookings"] });
    qc.invalidateQueries({ queryKey: ["sessions"] });
    qc.invalidateQueries({ queryKey: ["bookingRequests"] });
    qc.invalidateQueries({ queryKey: pipelineKeys.artistSessions(artistId) });
  };
}

/** Accept a request → booking + first session(s). */
export function useAcceptRequest(artistId: string) {
  const client = useInkdClient();
  const invalidate = useInvalidatePipeline(artistId);
  return useMutation({
    mutationFn: (args: {
      request: Pick<BookingRequest, "id" | "client_id" | "service_id" | "location_id">;
      input?: Parameters<typeof acceptBookingRequest>[3];
    }) => acceptBookingRequest(client, artistId, args.request, args.input),
    onSuccess: invalidate,
  });
}

/** Decline a request, optionally messaging the client a reason. */
export function useDeclineRequest(artistId: string) {
  const client = useInkdClient();
  const invalidate = useInvalidatePipeline(artistId);
  return useMutation({
    mutationFn: (args: {
      request: Pick<BookingRequest, "id" | "artist_id" | "client_id">;
      reason?: string;
      artistProfileId: string;
    }) => declineBookingRequest(client, args.request, args.reason, args.artistProfileId),
    onSuccess: invalidate,
  });
}

/** Ask the client a question (→ reviewing + thread). */
export function useAskQuestion(artistId: string) {
  const client = useInkdClient();
  const invalidate = useInvalidatePipeline(artistId);
  return useMutation({
    mutationFn: (args: {
      request: Pick<BookingRequest, "id" | "artist_id" | "client_id">;
      question: string;
      artistProfileId: string;
    }) => askQuestionOnRequest(client, args.request, args.question, args.artistProfileId),
    onSuccess: invalidate,
  });
}

export function useSetBookingStatus(artistId: string) {
  const client = useInkdClient();
  const invalidate = useInvalidatePipeline(artistId);
  return useMutation({
    mutationFn: (args: { id: string; status: BookingStatus }) =>
      setBookingStatus(client, args.id, args.status),
    onSuccess: invalidate,
  });
}

/** Add a session to a booking (multi-session projects). */
export function useCreateSession(artistId: string) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createSession>[2]) =>
      createSession(client, artistId, input),
    onSuccess: (session) => {
      qc.invalidateQueries({ queryKey: pipelineKeys.bookingSessions(session.booking_id) });
      qc.invalidateQueries({ queryKey: pipelineKeys.artistSessions(artistId) });
    },
  });
}

/** Update a session (reschedule, cancel, mark complete, deposit/balance flags). */
export function useUpdateSession(artistId: string) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; patch: Parameters<typeof updateSession>[2] }) =>
      updateSession(client, args.id, args.patch),
    onSuccess: (session) => {
      qc.invalidateQueries({ queryKey: pipelineKeys.bookingSessions(session.booking_id) });
      qc.invalidateQueries({ queryKey: pipelineKeys.artistSessions(artistId) });
      qc.invalidateQueries({ queryKey: pipelineKeys.bookingPayments(session.booking_id) });
    },
  });
}
