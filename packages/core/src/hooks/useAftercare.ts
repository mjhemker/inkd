/**
 * TanStack Query hooks for the aftercare healing timeline + healed-photo loop.
 * Usable from web + mobile. Query keys are kept local (mirrors
 * `./useReviews.ts`) rather than editing the shared key barrels.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  listBookingAftercareCheckins,
  listSessionAftercareCheckins,
  listClientAftercareCheckins,
  getAftercareCheckin,
  getAftercareCheckinContext,
  respondToAftercareCheckin,
  shareHealedPhotoToPortfolio,
  getAftercarePhotoUrl,
  type AftercareCheckinContext,
  type ShareHealedPhotoArgs,
} from "../api/aftercare";
import type { AftercareResponseInput } from "../aftercare/consent";
import type { AftercareCheckin } from "../types/rows";
import { useInkdClient } from "./context";

export const aftercareQueryKeys = {
  booking: (bookingId: string) => ["aftercare", "booking", bookingId] as const,
  session: (sessionId: string) => ["aftercare", "session", sessionId] as const,
  client: (clientId: string) => ["aftercare", "client", clientId] as const,
  checkin: (id: string) => ["aftercare", "checkin", id] as const,
  context: (id: string) => ["aftercare", "context", id] as const,
  photo: (path: string) => ["aftercare", "photo", path] as const,
};

// --- Queries ----------------------------------------------------------------
export function useBookingAftercare(bookingId: string | undefined) {
  const client = useInkdClient();
  return useQuery({
    queryKey: aftercareQueryKeys.booking(bookingId ?? ""),
    queryFn: () => listBookingAftercareCheckins(client, bookingId as string),
    enabled: Boolean(bookingId),
  });
}

export function useSessionAftercare(sessionId: string | undefined) {
  const client = useInkdClient();
  return useQuery({
    queryKey: aftercareQueryKeys.session(sessionId ?? ""),
    queryFn: () => listSessionAftercareCheckins(client, sessionId as string),
    enabled: Boolean(sessionId),
  });
}

export function useClientAftercare(clientId: string | undefined) {
  const client = useInkdClient();
  return useQuery({
    queryKey: aftercareQueryKeys.client(clientId ?? ""),
    queryFn: () => listClientAftercareCheckins(client, clientId as string),
    enabled: Boolean(clientId),
  });
}

export function useAftercareCheckin(id: string | undefined) {
  const client = useInkdClient();
  return useQuery({
    queryKey: aftercareQueryKeys.checkin(id ?? ""),
    queryFn: () => getAftercareCheckin(client, id as string),
    enabled: Boolean(id),
  });
}

/** The check-in + light context (piece label, artist name) for the client screen. */
export function useAftercareCheckinContext(id: string | undefined) {
  const client = useInkdClient();
  return useQuery<AftercareCheckinContext | null>({
    queryKey: aftercareQueryKeys.context(id ?? ""),
    queryFn: () => getAftercareCheckinContext(client, id as string),
    enabled: Boolean(id),
  });
}

/** Signed URL for a private healed photo (client + linked artist only). */
export function useAftercarePhotoUrl(path: string | null | undefined) {
  const client = useInkdClient();
  return useQuery({
    queryKey: aftercareQueryKeys.photo(path ?? ""),
    queryFn: () => getAftercarePhotoUrl(client, path as string),
    enabled: Boolean(path),
    staleTime: 50 * 60 * 1000, // signed URL lives ~60m; refetch a little early
  });
}

// --- Mutations --------------------------------------------------------------
function useInvalidateAftercare(checkin: AftercareCheckin | null | undefined) {
  const qc = useQueryClient();
  return () => {
    if (!checkin) return;
    qc.invalidateQueries({ queryKey: aftercareQueryKeys.checkin(checkin.id) });
    qc.invalidateQueries({ queryKey: aftercareQueryKeys.context(checkin.id) });
    if (checkin.booking_id) {
      qc.invalidateQueries({ queryKey: aftercareQueryKeys.booking(checkin.booking_id) });
    }
    qc.invalidateQueries({ queryKey: aftercareQueryKeys.session(checkin.session_id) });
    qc.invalidateQueries({ queryKey: aftercareQueryKeys.client(checkin.client_id) });
  };
}

/** Client submits their healing response (rating/note/photo/consent). */
export function useRespondToAftercareCheckin(checkin: AftercareCheckin | null | undefined) {
  const client = useInkdClient();
  const invalidate = useInvalidateAftercare(checkin);
  return useMutation({
    mutationFn: (input: AftercareResponseInput) =>
      respondToAftercareCheckin(client, checkin?.id as string, input),
    onSuccess: invalidate,
  });
}

/** Artist mirrors a consented healed photo into their public portfolio. */
export function useShareHealedPhoto(checkin: AftercareCheckin | null | undefined) {
  const client = useInkdClient();
  const invalidate = useInvalidateAftercare(checkin);
  return useMutation({
    mutationFn: (args: Omit<ShareHealedPhotoArgs, "checkin">) =>
      shareHealedPhotoToPortfolio(client, { ...args, checkin: checkin as AftercareCheckin }),
    onSuccess: invalidate,
  });
}
