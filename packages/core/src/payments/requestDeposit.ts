/**
 * Deposit checkout integration point.
 *
 * TODO(payments-integration): wire real endpoint after merge.
 *
 * A separate payments agent owns the Stripe edge functions. This module only
 * codes to the agreed contract so the booking UI can be built + demoed now:
 *
 *   POST /functions/v1/create-deposit-checkout  { session_id }  ->  { url }
 *
 * The booking screens call `requestDeposit(client, sessionId)` and redirect to
 * the returned `url`. Until the edge function ships, calls will fail at runtime
 * (the function 404s) — the UI treats that as "couldn't start checkout" and the
 * deposit state continues to be driven by the `payments` table, not this call.
 */
import { resolveSupabaseEnv } from "../env";
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
  const { url, anonKey } = resolveSupabaseEnv();
  const { data } = await client.auth.getSession();
  const accessToken = data.session?.access_token ?? anonKey;

  const res = await fetch(`${url}/functions/v1/create-deposit-checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ session_id: sessionId }),
  });

  if (!res.ok) {
    // TODO(payments-integration): tighten error mapping once the function ships.
    throw new Error(
      `create-deposit-checkout failed (${res.status}). The payments service may not be deployed yet.`,
    );
  }

  const body = (await res.json()) as Partial<DepositCheckout>;
  if (!body?.url) throw new Error("create-deposit-checkout returned no url.");
  return { url: body.url };
}
