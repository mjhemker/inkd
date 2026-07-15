/**
 * Hooks: Stripe Connect onboarding, deposit checkout, and payment/earnings
 * reads. Mount `<InkdProvider>` once, then call these from web or mobile.
 */
import { useMutation, useQuery } from "@tanstack/react-query";

import {
  startConnectOnboarding,
  requestDepositCheckout,
  listArtistPayments,
  listSessionPayments,
  getArtistEarnings,
  getConnectStatus,
  type ConnectOnboardingResult,
} from "../api/payments";
import { useInkdClient } from "./context";
import { queryKeys } from "./queryKeys";

/**
 * Kicks off Connect onboarding and returns the account-link URL. The caller
 * redirects the browser (web) or opens it in a system browser (mobile).
 */
export function useStartConnectOnboarding() {
  const client = useInkdClient();
  return useMutation<
    ConnectOnboardingResult,
    Error,
    { returnUrl?: string; refreshUrl?: string } | undefined
  >({
    mutationFn: (opts) => startConnectOnboarding(client, opts),
  });
}

/**
 * Requests a deposit Checkout URL for a session. Contract:
 *   mutateAsync(sessionId) -> { url }
 */
export function useRequestDepositCheckout() {
  const client = useInkdClient();
  return useMutation({
    mutationFn: (sessionId: string) => requestDepositCheckout(client, sessionId),
  });
}

/** An artist's full payment ledger (earnings history). */
export function useArtistPayments(artistId: string) {
  const client = useInkdClient();
  return useQuery({
    queryKey: queryKeys.artistPayments(artistId),
    queryFn: () => listArtistPayments(client, artistId),
    enabled: Boolean(artistId),
  });
}

/** Aggregated earnings summary for the artist dashboard. */
export function useArtistEarnings(artistId: string) {
  const client = useInkdClient();
  return useQuery({
    queryKey: queryKeys.artistEarnings(artistId),
    queryFn: () => getArtistEarnings(client, artistId),
    enabled: Boolean(artistId),
  });
}

/** Ledger rows (deposit + refunds) for one session. */
export function useSessionPayments(sessionId: string) {
  const client = useInkdClient();
  return useQuery({
    queryKey: queryKeys.sessionPayments(sessionId),
    queryFn: () => listSessionPayments(client, sessionId),
    enabled: Boolean(sessionId),
  });
}

/** Connect payout-readiness status for an artist. */
export function useConnectStatus(artistId: string) {
  const client = useInkdClient();
  return useQuery({
    queryKey: queryKeys.connectStatus(artistId),
    queryFn: () => getConnectStatus(client, artistId),
    enabled: Boolean(artistId),
  });
}
