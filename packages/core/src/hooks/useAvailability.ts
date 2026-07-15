/** Hooks: availability rules/blocks + booking policy for an artist. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  listAvailabilityRules,
  createAvailabilityRule,
  deleteAvailabilityRule,
  listAvailabilityBlocks,
  createAvailabilityBlock,
  deleteAvailabilityBlock,
  getBookingPolicy,
  upsertBookingPolicy,
} from "../api/availability";
import { useInkdClient } from "./context";
import { queryKeys } from "./queryKeys";

export function useAvailabilityRules(artistId: string) {
  const client = useInkdClient();
  return useQuery({
    queryKey: queryKeys.availabilityRules(artistId),
    queryFn: () => listAvailabilityRules(client, artistId),
    enabled: Boolean(artistId),
  });
}

export function useAvailabilityBlocks(
  artistId: string,
  range?: { from?: string; to?: string },
) {
  const client = useInkdClient();
  return useQuery({
    queryKey: [...queryKeys.availabilityBlocks(artistId), range ?? null],
    queryFn: () => listAvailabilityBlocks(client, artistId, range),
    enabled: Boolean(artistId),
  });
}

export function useBookingPolicy(artistId: string) {
  const client = useInkdClient();
  return useQuery({
    queryKey: queryKeys.bookingPolicy(artistId),
    queryFn: () => getBookingPolicy(client, artistId),
    enabled: Boolean(artistId),
  });
}

export function useAvailabilityMutations(artistId: string) {
  const client = useInkdClient();
  const qc = useQueryClient();
  const invalidateRules = () =>
    qc.invalidateQueries({ queryKey: queryKeys.availabilityRules(artistId) });
  const invalidateBlocks = () =>
    qc.invalidateQueries({ queryKey: queryKeys.availabilityBlocks(artistId) });

  return {
    createRule: useMutation({
      mutationFn: (input: Parameters<typeof createAvailabilityRule>[2]) =>
        createAvailabilityRule(client, artistId, input),
      onSuccess: invalidateRules,
    }),
    deleteRule: useMutation({
      mutationFn: (id: string) => deleteAvailabilityRule(client, id),
      onSuccess: invalidateRules,
    }),
    createBlock: useMutation({
      mutationFn: (input: Parameters<typeof createAvailabilityBlock>[2]) =>
        createAvailabilityBlock(client, artistId, input),
      onSuccess: invalidateBlocks,
    }),
    deleteBlock: useMutation({
      mutationFn: (id: string) => deleteAvailabilityBlock(client, id),
      onSuccess: invalidateBlocks,
    }),
    upsertPolicy: useMutation({
      mutationFn: (input: Parameters<typeof upsertBookingPolicy>[2]) =>
        upsertBookingPolicy(client, artistId, input),
      onSuccess: () =>
        qc.invalidateQueries({ queryKey: queryKeys.bookingPolicy(artistId) }),
    }),
  };
}
