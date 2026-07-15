/**
 * Deposit checkout integration point.
 *
 * This module used to be a contract-only stub while a separate payments agent
 * owned the Stripe edge functions. Those functions have shipped, so this now
 * delegates to the real payments client (`requestDepositCheckout`), which calls
 * `create-deposit-checkout` via `supabase.functions.invoke` (JWT forwarded and
 * re-verified server-side, structured error envelope surfaced).
 *
 * The booking screens keep calling `requestDeposit(client, sessionId)` and
 * redirect to the returned `url`; deposit state continues to be driven by the
 * `payments` table, not this call.
 */
import { requestDepositCheckout } from "../api/payments";
import type { InkdSupabaseClient } from "../supabase/client";

export interface DepositCheckout {
  /** Hosted Stripe Checkout URL to send the client to. */
  url: string;
}

/**
 * Kick off a deposit checkout for a session. Returns the hosted checkout URL.
 * Throws when the endpoint is unavailable or returns a non-2xx — callers should
 * catch and show a "couldn't start checkout" state.
 */
export async function requestDeposit(
  client: InkdSupabaseClient,
  sessionId: string,
): Promise<DepositCheckout> {
  const { url } = await requestDepositCheckout(client, sessionId);
  return { url };
}
