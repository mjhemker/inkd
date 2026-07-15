/**
 * Client-side booking-flow hooks for /book/[artistHandle]: resolve the public
 * artist, load their bookable menu + availability, compute selectable dates, and
 * submit a booking request (with reference uploads). Additive — local keys.
 */
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getPublicArtistByHandle } from "../api/bookingFlow";
import { listPublicServices } from "../api/services";
import { listStudioLocations } from "../api/studioLocations";
import {
  listAvailabilityRules,
  listAvailabilityBlocks,
  getBookingPolicy,
} from "../api/availability";
import { createBookingRequest } from "../api/booking";
import {
  uploadBookingReference,
  removeBookingReference,
  type UploadReferenceArgs,
} from "../api/uploads";
import { computeBookableDates } from "../booking/slots";
import { useInkdClient } from "./context";

export const bookingFlowKeys = {
  publicArtist: (handle: string) => ["publicArtist", handle.toLowerCase()] as const,
  publicServices: (artistId: string) => ["publicServices", artistId] as const,
  publicLocations: (artistId: string) => ["publicLocations", artistId] as const,
};

/** Resolve `{ profile, artist }` for a public @handle. */
export function usePublicArtist(handle: string) {
  const client = useInkdClient();
  return useQuery({
    queryKey: bookingFlowKeys.publicArtist(handle),
    queryFn: () => getPublicArtistByHandle(client, handle),
    enabled: Boolean(handle),
  });
}

/** Public (client-facing) service menu. */
export function usePublicServices(artistId: string) {
  const client = useInkdClient();
  return useQuery({
    queryKey: bookingFlowKeys.publicServices(artistId),
    queryFn: () => listPublicServices(client, artistId),
    enabled: Boolean(artistId),
  });
}

/** Public studio locations. */
export function usePublicLocations(artistId: string) {
  const client = useInkdClient();
  return useQuery({
    queryKey: bookingFlowKeys.publicLocations(artistId),
    queryFn: () => listStudioLocations(client, artistId),
    enabled: Boolean(artistId),
  });
}

/**
 * Everything the date-picker needs: availability rules, blocks, and the booking
 * policy, projected into concrete bookable days via `computeBookableDates`.
 */
export function useBookableDates(artistId: string) {
  const client = useInkdClient();

  const rulesQ = useQuery({
    queryKey: ["availabilityRules", artistId],
    queryFn: () => listAvailabilityRules(client, artistId),
    enabled: Boolean(artistId),
  });
  const blocksQ = useQuery({
    queryKey: ["availabilityBlocks", artistId, "future"],
    queryFn: () =>
      listAvailabilityBlocks(client, artistId, {
        from: new Date().toISOString(),
      }),
    enabled: Boolean(artistId),
  });
  const policyQ = useQuery({
    queryKey: ["bookingPolicy", artistId],
    queryFn: () => getBookingPolicy(client, artistId),
    enabled: Boolean(artistId),
  });

  const days = useMemo(() => {
    if (!rulesQ.data) return [];
    return computeBookableDates({
      rules: rulesQ.data,
      blocks: blocksQ.data ?? [],
      bookingWindow: policyQ.data?.booking_window ?? null,
      minNoticeHours: policyQ.data?.min_notice_hours ?? 0,
    });
  }, [rulesQ.data, blocksQ.data, policyQ.data]);

  return {
    days,
    policy: policyQ.data ?? null,
    isLoading: rulesQ.isLoading || blocksQ.isLoading || policyQ.isLoading,
    isError: rulesQ.isError || blocksQ.isError || policyQ.isError,
  };
}

/** Submit a booking request for the current client. */
export function useCreateBookingRequest(clientId: string) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createBookingRequest>[2]) =>
      createBookingRequest(client, clientId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookingRequests", "client", clientId] });
    },
  });
}

/** Upload one reference file to the client's private folder. */
export function useUploadReference() {
  const client = useInkdClient();
  return useMutation({
    mutationFn: (args: UploadReferenceArgs) => uploadBookingReference(client, args),
  });
}

/** Remove a reference file (drop before submit). */
export function useRemoveReference() {
  const client = useInkdClient();
  return useMutation({
    mutationFn: (path: string) => removeBookingReference(client, path),
  });
}
