// Stripe webhook logic, split into a PURE interpreter and an IO applier so the
// hard part (mapping a Stripe event to ledger mutations) is unit-testable with
// plain object fixtures — no Stripe, no Supabase, no network. See webhook.test.ts.
//
// Money flow recap (SPEC §1): a client's deposit is a DESTINATION CHARGE on the
// INKD platform account with `application_fee_amount` = the INKD fee and
// `transfer_data.destination` = the artist's connected account. So the deposit
// lands artist-direct, minus the INKD fee. The webhook writes the ledger rows
// that record it.

// ---------------------------------------------------------------------------
// Metadata contract — keys INKD sets on the PaymentIntent / Checkout Session.
// create-deposit-checkout writes these; the webhook reads them back.
// ---------------------------------------------------------------------------
export const META = {
  sessionId: "inkd_session_id",
  bookingId: "inkd_booking_id",
  artistId: "inkd_artist_id",
  clientId: "inkd_client_id",
  kind: "inkd_kind",
  depositCents: "inkd_deposit_cents",
  feeCents: "inkd_fee_cents",
} as const;

// ---------------------------------------------------------------------------
// A minimal structural view of a Stripe event. Stripe.Event satisfies this, and
// tests can build the same shape by hand.
// ---------------------------------------------------------------------------
export interface StripeEventLike {
  id: string;
  type: string;
  api_version?: string | null;
  livemode?: boolean;
  data: { object: Record<string, unknown> };
}

// ---------------------------------------------------------------------------
// Effects: the declarative result of interpreting an event. Pure output.
// ---------------------------------------------------------------------------
export type WebhookEffect =
  | {
      kind: "record_deposit";
      sessionId: string | null;
      bookingId: string | null;
      artistId: string | null;
      clientId: string | null;
      amountCents: number;
      inkdFeeCents: number;
      currency: string;
      paymentIntentId: string | null;
      chargeId: string | null;
      succeeded: boolean;
    }
  | {
      kind: "confirm_payment";
      paymentIntentId: string;
      chargeId: string | null;
    }
  | {
      kind: "record_refund";
      paymentIntentId: string | null;
      chargeId: string | null;
      refundId: string | null;
      amountRefundedCents: number;
      chargeAmountCents: number;
      fullyRefunded: boolean;
    }
  | {
      kind: "update_account";
      stripeAccountId: string;
      chargesEnabled: boolean;
      payoutsEnabled: boolean;
      detailsSubmitted: boolean;
    }
  | { kind: "ignore"; reason: string };

// ---------------------------------------------------------------------------
// interpretEvent: PURE. Maps a Stripe event to an effect. No IO.
// ---------------------------------------------------------------------------
export function interpretEvent(event: StripeEventLike): WebhookEffect {
  const obj = event.data?.object ?? {};
  switch (event.type) {
    case "checkout.session.completed": {
      const meta = readMeta(obj);
      return {
        kind: "record_deposit",
        sessionId: meta[META.sessionId] ?? null,
        bookingId: meta[META.bookingId] ?? null,
        artistId: meta[META.artistId] ?? null,
        clientId: meta[META.clientId] ?? null,
        // amount_total is the charged deposit; fall back to metadata.
        amountCents:
          num(obj["amount_total"]) || int(meta[META.depositCents]),
        inkdFeeCents: int(meta[META.feeCents]),
        currency: str(obj["currency"]) ?? "usd",
        paymentIntentId: idOf(obj["payment_intent"]),
        chargeId: null,
        succeeded: str(obj["payment_status"]) === "paid",
      };
    }
    case "payment_intent.succeeded": {
      const id = str(obj["id"]);
      if (!id) return ignore("payment_intent.succeeded missing id");
      return {
        kind: "confirm_payment",
        paymentIntentId: id,
        chargeId: idOf(obj["latest_charge"]),
      };
    }
    case "charge.refunded": {
      return {
        kind: "record_refund",
        paymentIntentId: idOf(obj["payment_intent"]),
        chargeId: str(obj["id"]),
        refundId: latestRefundId(obj),
        amountRefundedCents: num(obj["amount_refunded"]),
        chargeAmountCents: num(obj["amount"]),
        fullyRefunded: Boolean(obj["refunded"]),
      };
    }
    case "account.updated": {
      const id = str(obj["id"]);
      if (!id) return ignore("account.updated missing id");
      return {
        kind: "update_account",
        stripeAccountId: id,
        chargesEnabled: Boolean(obj["charges_enabled"]),
        payoutsEnabled: Boolean(obj["payouts_enabled"]),
        detailsSubmitted: Boolean(obj["details_submitted"]),
      };
    }
    default:
      return ignore(`Unhandled event type: ${event.type}`);
  }
}

// ---------------------------------------------------------------------------
// Repository: the only IO surface. Real impl lives in stripe-webhook/index.ts;
// tests pass a fake.
// ---------------------------------------------------------------------------
export interface PaymentsRepo {
  /** Insert the event id; returns true only the FIRST time (idempotency gate). */
  reserveEvent(event: StripeEventLike): Promise<boolean>;
  /** Upsert the deposit ledger row keyed by payment_intent id + mark the session. */
  recordDeposit(effect: Extract<WebhookEffect, { kind: "record_deposit" }>): Promise<void>;
  /** Mark a deposit payment succeeded (by payment_intent), attaching the charge. */
  confirmPayment(effect: Extract<WebhookEffect, { kind: "confirm_payment" }>): Promise<void>;
  /** Insert a refund ledger row + downgrade the original payment status. */
  recordRefund(effect: Extract<WebhookEffect, { kind: "record_refund" }>): Promise<void>;
  /** Mirror Stripe account capability flags onto the artist profile. */
  updateArtistAccount(effect: Extract<WebhookEffect, { kind: "update_account" }>): Promise<void>;
}

export interface HandleResult {
  handled: boolean;
  deduped: boolean;
  effect: WebhookEffect["kind"];
}

/**
 * Idempotently handle a verified Stripe event: reserve the id (dedupe), then
 * apply the interpreted effect. A duplicate delivery is a no-op.
 */
export async function handleStripeEvent(
  event: StripeEventLike,
  repo: PaymentsRepo,
): Promise<HandleResult> {
  const effect = interpretEvent(event);

  // Reserve first so a duplicate never double-applies. `ignore` effects still
  // get reserved so we don't re-interpret noise, but they do no work.
  const fresh = await repo.reserveEvent(event);
  if (!fresh) {
    return { handled: false, deduped: true, effect: effect.kind };
  }

  await applyEffect(effect, repo);
  return { handled: effect.kind !== "ignore", deduped: false, effect: effect.kind };
}

export async function applyEffect(
  effect: WebhookEffect,
  repo: PaymentsRepo,
): Promise<void> {
  switch (effect.kind) {
    case "record_deposit":
      await repo.recordDeposit(effect);
      return;
    case "confirm_payment":
      await repo.confirmPayment(effect);
      return;
    case "record_refund":
      await repo.recordRefund(effect);
      return;
    case "update_account":
      await repo.updateArtistAccount(effect);
      return;
    case "ignore":
      return;
  }
}

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------
function ignore(reason: string): WebhookEffect {
  return { kind: "ignore", reason };
}

function readMeta(obj: Record<string, unknown>): Record<string, string> {
  const meta = obj["metadata"];
  if (meta && typeof meta === "object") {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
      if (v != null) out[k] = String(v);
    }
    return out;
  }
  return {};
}

/** A Stripe field that may be an id string or an expanded object with an `id`. */
function idOf(value: unknown): string | null {
  if (typeof value === "string") return value || null;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

function latestRefundId(charge: Record<string, unknown>): string | null {
  const refunds = charge["refunds"];
  if (refunds && typeof refunds === "object" && "data" in refunds) {
    const data = (refunds as { data?: unknown }).data;
    if (Array.isArray(data) && data.length > 0) {
      const last = data[data.length - 1] as { id?: unknown };
      if (typeof last?.id === "string") return last.id;
    }
  }
  return null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function int(value: string | undefined): number {
  if (value == null) return 0;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}
