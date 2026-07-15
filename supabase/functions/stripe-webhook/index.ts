// POST /functions/v1/stripe-webhook
//
// Stripe -> INKD. Signature-verified (Stripe is the authenticator here, NOT a
// Supabase JWT — deploy this function with verify_jwt = false, see config.toml).
// Handles: checkout.session.completed, payment_intent.succeeded, charge.refunded,
// account.updated. Idempotent via the stripe_events dedupe table.
//
// The heavy lifting (event -> effect mapping) lives in _shared/webhook.ts and is
// unit-tested offline. This file only wires Stripe verification + the DB repo.
import { requireEnv } from "../_shared/env.ts";
import { getStripe } from "../_shared/stripe.ts";
import { getAdminClient, type SupabaseClient } from "../_shared/supabaseAdmin.ts";
import {
  handleStripeEvent,
  type PaymentsRepo,
  type StripeEventLike,
} from "../_shared/webhook.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing stripe-signature", { status: 400 });

  const payload = await req.text(); // raw body required for signature checking
  const webhookSecret = requireEnv("STRIPE_WEBHOOK_SECRET");
  const stripe = getStripe();

  let event: StripeEventLike;
  try {
    // Deno uses SubtleCrypto -> the async verifier is mandatory.
    event = (await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      webhookSecret,
    )) as unknown as StripeEventLike;
  } catch (err) {
    console.error("stripe-webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    const repo = createRepo(getAdminClient());
    const result = await handleStripeEvent(event, repo);
    return new Response(
      JSON.stringify({ received: true, ...result }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    // Return 500 so Stripe retries; the dedupe table keeps retries safe.
    console.error("stripe-webhook handler error:", err);
    return new Response(JSON.stringify({ received: false }), { status: 500 });
  }
});

// ---------------------------------------------------------------------------
// Service-role repository implementing the PaymentsRepo IO contract.
// ---------------------------------------------------------------------------
function createRepo(db: SupabaseClient): PaymentsRepo {
  return {
    async reserveEvent(event) {
      // ON CONFLICT DO NOTHING via upsert(ignoreDuplicates): returns the row
      // only when it was newly inserted, so [] === already processed.
      const { data, error } = await db
        .from("stripe_events")
        .upsert(
          {
            id: event.id,
            type: event.type,
            api_version: event.api_version ?? null,
            livemode: event.livemode ?? null,
            payload: event as unknown as Record<string, unknown>,
          },
          { onConflict: "id", ignoreDuplicates: true },
        )
        .select("id");
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },

    async recordDeposit(e) {
      const status = e.succeeded ? "succeeded" : "processing";
      // Upsert-by-PI without a DB unique constraint: look up, then update/insert.
      const existing = e.paymentIntentId
        ? await db
            .from("payments")
            .select("id")
            .eq("stripe_payment_intent_id", e.paymentIntentId)
            .eq("kind", "deposit")
            .maybeSingle()
        : { data: null, error: null };
      if (existing.error) throw existing.error;

      const row = {
        booking_id: e.bookingId,
        session_id: e.sessionId,
        artist_id: e.artistId,
        client_id: e.clientId,
        kind: "deposit" as const,
        status,
        amount_cents: e.amountCents,
        inkd_fee_cents: e.inkdFeeCents,
        currency: e.currency,
        stripe_payment_intent_id: e.paymentIntentId,
        stripe_charge_id: e.chargeId,
        description: "Session deposit",
        processed_at: e.succeeded ? new Date().toISOString() : null,
      };

      if (existing.data?.id) {
        const { error } = await db
          .from("payments")
          .update(row)
          .eq("id", existing.data.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("payments").insert(row);
        if (error) throw error;
      }

      if (e.sessionId && e.succeeded) {
        const { error } = await db
          .from("sessions")
          .update({ deposit_paid: true, deposit_cents: e.amountCents })
          .eq("id", e.sessionId);
        if (error) throw error;
      }
    },

    async confirmPayment(e) {
      const { error } = await db
        .from("payments")
        .update({
          status: "succeeded",
          stripe_charge_id: e.chargeId,
          processed_at: new Date().toISOString(),
        })
        .eq("stripe_payment_intent_id", e.paymentIntentId)
        .eq("kind", "deposit");
      if (error) throw error;
    },

    async recordRefund(e) {
      // Find the original deposit to inherit its links (artist_id is NOT NULL).
      let original = null as
        | { id: string; booking_id: string | null; session_id: string | null; artist_id: string; client_id: string | null }
        | null;
      if (e.chargeId) {
        const { data } = await db
          .from("payments")
          .select("id, booking_id, session_id, artist_id, client_id")
          .eq("stripe_charge_id", e.chargeId)
          .eq("kind", "deposit")
          .maybeSingle();
        original = data ?? null;
      }
      if (!original && e.paymentIntentId) {
        const { data } = await db
          .from("payments")
          .select("id, booking_id, session_id, artist_id, client_id")
          .eq("stripe_payment_intent_id", e.paymentIntentId)
          .eq("kind", "deposit")
          .maybeSingle();
        original = data ?? null;
      }
      if (!original) {
        console.warn("charge.refunded with no matching deposit:", e.chargeId);
        return;
      }

      const { error: insErr } = await db.from("payments").insert({
        booking_id: original.booking_id,
        session_id: original.session_id,
        artist_id: original.artist_id,
        client_id: original.client_id,
        kind: "refund" as const,
        status: "succeeded" as const,
        amount_cents: e.amountRefundedCents,
        inkd_fee_cents: 0,
        stripe_payment_intent_id: e.paymentIntentId,
        stripe_charge_id: e.chargeId,
        stripe_refund_id: e.refundId,
        description: "Deposit refund",
        processed_at: new Date().toISOString(),
      });
      if (insErr) throw insErr;

      const { error: updErr } = await db
        .from("payments")
        .update({ status: e.fullyRefunded ? "refunded" : "partially_refunded" })
        .eq("id", original.id);
      if (updErr) throw updErr;
    },

    async updateArtistAccount(e) {
      const patch: Record<string, unknown> = {
        stripe_charges_enabled: e.chargesEnabled,
        stripe_payouts_enabled: e.payoutsEnabled,
        stripe_details_submitted: e.detailsSubmitted,
      };
      if (e.detailsSubmitted && e.chargesEnabled) {
        patch.stripe_onboarding_completed_at = new Date().toISOString();
      }
      const { error } = await db
        .from("artist_profiles")
        .update(patch)
        .eq("stripe_account_id", e.stripeAccountId);
      if (error) throw error;
    },
  } satisfies PaymentsRepo;
}
