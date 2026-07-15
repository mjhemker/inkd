/** Hooks: booking-request lists (artist inbox + client submissions). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  listArtistBookingRequests,
  listClientBookingRequests,
  setBookingRequestStatus,
} from "../api/booking";
import type { BookingRequestStatus } from "../types/rows";
import { useInkdClient } from "./context";
import { queryKeys } from "./queryKeys";

export function useArtistBookingRequests(
  artistId: string,
  status?: BookingRequestStatus,
) {
  const client = useInkdClient();
  return useQuery({
    queryKey: queryKeys.artistBookingRequests(artistId, status),
    queryFn: () =>
      listArtistBookingRequests(client, artistId, { status }),
    enabled: Boolean(artistId),
  });
}

export function useClientBookingRequests(clientId: string) {
  const client = useInkdClient();
  return useQuery({
    queryKey: queryKeys.clientBookingRequests(clientId),
    queryFn: () => listClientBookingRequests(client, clientId),
    enabled: Boolean(clientId),
  });
}

export function useSetBookingRequestStatus(artistId: string) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; status: BookingRequestStatus }) =>
      setBookingRequestStatus(client, args.id, args.status),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ["bookingRequests", "artist", artistId],
      }),
  });
}
