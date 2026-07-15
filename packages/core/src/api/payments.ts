/**
 * Payments client: thin wrappers over the INKD Stripe edge functions plus
 * RLS-scoped reads of the `payments` ledger for the artist earnings view and
 * refund status.
 *
 * The two edge-function calls use `supabase.functions.invoke`, which forwards
 * the caller's session JWT automatically — the functions re-verify it. No
 * Stripe keys ever touch the client; the browser only ever receives a redirect
 * URL.
 */
import { z } from "zod";

import type { InkdSupabaseClient } from "../supabase/client";
import type { ArtistProfile, Payment } from "../types/rows";
import { unwrapList } from "./helpers";

// ===========================================================================
// Edge-function invocations
// ===========================================================================

/** Shape returned by the connect-onboarding-link function. */
export interface ConnectOnboardingResult {
  url: string;
  account_id: string;
  charges_enabled: boolean;
}

/** Shape returned by the create-deposit-checkout function. */
export interface DepositCheckoutResult {
  url: string;
}

interface InvokeErrorEnvelope {
  error?: { code?: string; message?: string };
}

/** Invoke an edge function and surface its `{ error: { code, message } }` body. */
async function invokeFunction<T>(
  client: InkdSupabaseClient,
  name: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.functions.invoke<T & InvokeErrorEnvelope>(
    name,
    { body: body ?? {} },
  );
  if (error) {
    // FunctionsHttpError carries the non-2xx response; try to read our envelope.
    let message = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const parsed = (await ctx.json()) as InvokeErrorEnvelope;
        if (parsed?.error?.message) message = parsed.error.message;
      } catch {
        // keep the original message
      }
    }
    throw new Error(message);
  }
  if (!data) throw new Error(`Empty response from ${name}`);
  const envelope = data as InvokeErrorEnvelope;
  if (envelope.error) {
    throw new Error(envelope.error.message ?? `Error from ${name}`);
  }
  return data as T;
}

const onboardingOptsSchema = z
  .object({
    returnUrl: z.string().url().optional(),
    refreshUrl: z.string().url().optional(),
  })
  .optional();

/**
 * Start (or resume) Stripe Connect Express onboarding for the current artist.
 * Returns a one-time account-link `url` to redirect the artist to.
 */
export async function startConnectOnboarding(
  client: InkdSupabaseClient,
  opts?: z.input<typeof onboardingOptsSchema>,
): Promise<ConnectOnboardingResult> {
  const parsed = onboardingOptsSchema.parse(opts);
  const body: Record<string, unknown> = {};
  if (parsed?.returnUrl) body.return_url = parsed.returnUrl;
  if (parsed?.refreshUrl) body.refresh_url = parsed.refreshUrl;
  return invokeFunction<ConnectOnboardingResult>(
    client,
    "connect-onboarding-link",
    body,
  );
}

/**
 * Request a Stripe Checkout URL for the current client to pay a session's
 * deposit. This is the exact contract the booking UI builds against:
 *   requestDepositCheckout(sessionId) -> { url }
 */
export async function requestDepositCheckout(
  client: InkdSupabaseClient,
  sessionId: string,
): Promise<DepositCheckoutResult> {
  const id = z.string().uuid("session_id must be a UUID").parse(sessionId);
  return invokeFunction<DepositCheckoutResult>(
    client,
    "create-deposit-checkout",
    { session_id: id },
  );
}

// ===========================================================================
// Ledger reads (RLS-scoped; no service role)
// ===========================================================================

/** All ledger rows for an artist (earnings history), newest first. */
export async function listArtistPayments(
  client: InkdSupabaseClient,
  artistId: string,
): Promise<Payment[]> {
  return unwrapList(
    await client
      .from("payments")
      .select("*")
      .eq("artist_id", artistId)
      .order("created_at", { ascending: false }),
  );
}

/** Ledger rows tied to a single session (deposit + any refunds). */
export async function listSessionPayments(
  client: InkdSupabaseClient,
  sessionId: string,
): Promise<Payment[]> {
  return unwrapList(
    await client
      .from("payments")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false }),
  );
}

// ===========================================================================
// Derived views (pure — safe to unit test / memoize)
// ===========================================================================

export interface ArtistEarnings {
  /** Sum of succeeded deposit amounts (gross, before the INKD fee). */
  grossDepositCents: number;
  /** Sum of INKD application fees on those deposits. */
  inkdFeeCents: number;
  /** Total refunded back to clients. */
  refundedCents: number;
  /** What the artist actually keeps: gross - INKD fee - refunds. */
  netCents: number;
  /** Deposits still processing (not yet succeeded). */
  pendingCents: number;
  /** Count of succeeded deposits. */
  depositCount: number;
}

const SUCCEEDED = "succeeded";

/** Aggregate a ledger into the artist earnings summary. Pure. */
export function summarizeEarnings(payments: Payment[]): ArtistEarnings {
  let grossDepositCents = 0;
  let inkdFeeCents = 0;
  let refundedCents = 0;
  let pendingCents = 0;
  let depositCount = 0;

  for (const p of payments) {
    if (p.kind === "deposit") {
      if (p.status === SUCCEEDED) {
        grossDepositCents += p.amount_cents;
        inkdFeeCents += p.inkd_fee_cents;
        depositCount += 1;
      } else if (p.status === "pending" || p.status === "processing") {
        pendingCents += p.amount_cents;
      }
    } else if (p.kind === "refund" && p.status === SUCCEEDED) {
      refundedCents += p.amount_cents;
    }
  }

  const netCents = Math.max(0, grossDepositCents - inkdFeeCents - refundedCents);
  return {
    grossDepositCents,
    inkdFeeCents,
    refundedCents,
    netCents,
    pendingCents,
    depositCount,
  };
}

export type RefundStatus = "none" | "partial" | "full";

/** Refund state for a session, derived from its ledger rows. Pure. */
export function refundStatusForSession(payments: Payment[]): RefundStatus {
  const deposit = payments.find((p) => p.kind === "deposit");
  const refunded = payments
    .filter((p) => p.kind === "refund" && p.status === SUCCEEDED)
    .reduce((sum, p) => sum + p.amount_cents, 0);
  if (refunded <= 0) return "none";
  if (deposit && refunded >= deposit.amount_cents) return "full";
  return "partial";
}

/** Convenience: fetch + summarize an artist's earnings in one call. */
export async function getArtistEarnings(
  client: InkdSupabaseClient,
  artistId: string,
): Promise<ArtistEarnings> {
  const payments = await listArtistPayments(client, artistId);
  return summarizeEarnings(payments);
}

// ===========================================================================
// Connect account status (read straight off artist_profiles)
// ===========================================================================

export interface ConnectStatus {
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  onboardingCompletedAt: string | null;
  /** True once the artist can accept deposit charges. */
  ready: boolean;
}

/** Map an artist profile row to its Connect payout-readiness status. */
export function connectStatusFromProfile(artist: ArtistProfile): ConnectStatus {
  return {
    accountId: artist.stripe_account_id,
    chargesEnabled: artist.stripe_charges_enabled,
    payoutsEnabled: artist.stripe_payouts_enabled,
    detailsSubmitted: artist.stripe_details_submitted,
    onboardingCompletedAt: artist.stripe_onboarding_completed_at,
    ready: Boolean(artist.stripe_account_id) && artist.stripe_charges_enabled,
  };
}

/** Fetch the current Connect status for an artist by artist_profiles.id. */
export async function getConnectStatus(
  client: InkdSupabaseClient,
  artistId: string,
): Promise<ConnectStatus | null> {
  const { data, error } = await client
    .from("artist_profiles")
    .select("*")
    .eq("id", artistId)
    .maybeSingle();
  if (error) throw error;
  return data ? connectStatusFromProfile(data) : null;
}
