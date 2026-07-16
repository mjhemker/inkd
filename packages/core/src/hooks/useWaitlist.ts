/**
 * TanStack Query hooks for the cancellation waitlist (Wave 2). Client-side:
 * join / list / cancel entries, list offers, claim / decline. Artist-side:
 * view the waitlist + outstanding offers, open a freed session, toggle the
 * waitlist on/off. Thin wrappers over `../api/waitlist`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  joinWaitlist,
  listClientWaitlistEntries,
  cancelWaitlistEntry,
  listClientWaitlistOffers,
  claimWaitlistOffer,
  declineWaitlistOffer,
  listArtistWaitlistEntries,
  listArtistWaitlistOffers,
  openSessionToWaitlist,
  setWaitlistEnabled,
  type CreateWaitlistEntryInput,
} from "../api/waitlist";
import { useInkdClient } from "./context";

export const waitlistQueryKeys = {
  clientEntries: (clientId: string) => ["waitlist", "clientEntries", clientId] as const,
  clientOffers: (clientId: string) => ["waitlist", "clientOffers", clientId] as const,
  artistEntries: (artistId: string) => ["waitlist", "artistEntries", artistId] as const,
  artistOffers: (artistId: string) => ["waitlist", "artistOffers", artistId] as const,
} as const;

// --- Client -----------------------------------------------------------------
export function useClientWaitlistEntries(clientId: string) {
  const client = useInkdClient();
  return useQuery({
    queryKey: waitlistQueryKeys.clientEntries(clientId),
    queryFn: () =>
      listClientWaitlistEntries(client, clientId, { status: ["active", "offered"] }),
    enabled: Boolean(clientId),
  });
}

export function useClientWaitlistOffers(clientId: string) {
  const client = useInkdClient();
  return useQuery({
    queryKey: waitlistQueryKeys.clientOffers(clientId),
    queryFn: () => listClientWaitlistOffers(client, clientId, { status: "pending" }),
    enabled: Boolean(clientId),
    // Offers are time-boxed — keep them fresh so a countdown-driven UI updates.
    refetchInterval: 60_000,
  });
}

export function useJoinWaitlist(clientId: string) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWaitlistEntryInput) => joinWaitlist(client, clientId, input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: waitlistQueryKeys.clientEntries(clientId) }),
  });
}

export function useCancelWaitlistEntry(clientId: string) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelWaitlistEntry(client, id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: waitlistQueryKeys.clientEntries(clientId) }),
  });
}

export function useClaimWaitlistOffer(clientId: string) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (offerId: string) => claimWaitlistOffer(client, offerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: waitlistQueryKeys.clientOffers(clientId) });
      qc.invalidateQueries({ queryKey: waitlistQueryKeys.clientEntries(clientId) });
    },
  });
}

export function useDeclineWaitlistOffer(clientId: string) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (offerId: string) => declineWaitlistOffer(client, offerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: waitlistQueryKeys.clientOffers(clientId) });
      qc.invalidateQueries({ queryKey: waitlistQueryKeys.clientEntries(clientId) });
    },
  });
}

// --- Artist -----------------------------------------------------------------
export function useArtistWaitlistEntries(artistId: string) {
  const client = useInkdClient();
  return useQuery({
    queryKey: waitlistQueryKeys.artistEntries(artistId),
    queryFn: () =>
      listArtistWaitlistEntries(client, artistId, { status: ["active", "offered"] }),
    enabled: Boolean(artistId),
  });
}

export function useArtistWaitlistOffers(artistId: string) {
  const client = useInkdClient();
  return useQuery({
    queryKey: waitlistQueryKeys.artistOffers(artistId),
    queryFn: () => listArtistWaitlistOffers(client, artistId, { status: "pending" }),
    enabled: Boolean(artistId),
    refetchInterval: 60_000,
  });
}

export function useOpenSessionToWaitlist(artistId: string) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => openSessionToWaitlist(client, sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: waitlistQueryKeys.artistEntries(artistId) });
      qc.invalidateQueries({ queryKey: waitlistQueryKeys.artistOffers(artistId) });
    },
  });
}

export function useSetWaitlistEnabled(artistId: string) {
  const client = useInkdClient();
  return useMutation({
    mutationFn: (enabled: boolean) => setWaitlistEnabled(client, artistId, enabled),
  });
}
