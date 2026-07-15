// Offline unit tests for the pure webhook interpreter + the idempotent dispatch.
// Uses hand-built Stripe event fixtures + a fake repo — no Stripe, no Supabase.
//   node --test supabase/functions/_shared/webhook.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  interpretEvent,
  handleStripeEvent,
  META,
  type PaymentsRepo,
  type StripeEventLike,
  type WebhookEffect,
} from "./webhook.ts";

// --- fixtures ---------------------------------------------------------------
function depositMeta() {
  return {
    [META.sessionId]: "sess-1",
    [META.bookingId]: "book-1",
    [META.artistId]: "artist-1",
    [META.clientId]: "client-1",
    [META.kind]: "deposit",
    [META.depositCents]: "5000",
    [META.feeCents]: "500",
  };
}

function checkoutCompleted(): StripeEventLike {
  return {
    id: "evt_checkout_1",
    type: "checkout.session.completed",
    api_version: "2025-01-27.acacia",
    livemode: false,
    data: {
      object: {
        id: "cs_test_1",
        object: "checkout.session",
        payment_intent: "pi_1",
        payment_status: "paid",
        amount_total: 5000,
        currency: "usd",
        metadata: depositMeta(),
      },
    },
  };
}

// --- interpretEvent ---------------------------------------------------------
test("interpret checkout.session.completed -> record_deposit", () => {
  const effect = interpretEvent(checkoutCompleted());
  assert.equal(effect.kind, "record_deposit");
  if (effect.kind !== "record_deposit") return;
  assert.equal(effect.sessionId, "sess-1");
  assert.equal(effect.bookingId, "book-1");
  assert.equal(effect.artistId, "artist-1");
  assert.equal(effect.clientId, "client-1");
  assert.equal(effect.amountCents, 5000);
  assert.equal(effect.inkdFeeCents, 500);
  assert.equal(effect.currency, "usd");
  assert.equal(effect.paymentIntentId, "pi_1");
  assert.equal(effect.succeeded, true);
});

test("interpret checkout: amount falls back to metadata when amount_total absent", () => {
  const ev = checkoutCompleted();
  delete (ev.data.object as Record<string, unknown>).amount_total;
  const effect = interpretEvent(ev);
  assert.equal(effect.kind === "record_deposit" && effect.amountCents, 5000);
});

test("interpret payment_intent.succeeded -> confirm_payment (charge as string)", () => {
  const effect = interpretEvent({
    id: "evt_pi_1",
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_1", latest_charge: "ch_1" } },
  });
  assert.equal(effect.kind, "confirm_payment");
  if (effect.kind !== "confirm_payment") return;
  assert.equal(effect.paymentIntentId, "pi_1");
  assert.equal(effect.chargeId, "ch_1");
});

test("interpret payment_intent.succeeded: charge as expanded object", () => {
  const effect = interpretEvent({
    id: "evt_pi_2",
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_2", latest_charge: { id: "ch_2" } } },
  });
  assert.equal(effect.kind === "confirm_payment" && effect.chargeId, "ch_2");
});

test("interpret charge.refunded -> record_refund (full)", () => {
  const effect = interpretEvent({
    id: "evt_ref_1",
    type: "charge.refunded",
    data: {
      object: {
        id: "ch_1",
        object: "charge",
        payment_intent: "pi_1",
        amount: 5000,
        amount_refunded: 5000,
        refunded: true,
        refunds: { data: [{ id: "re_1" }] },
      },
    },
  });
  assert.equal(effect.kind, "record_refund");
  if (effect.kind !== "record_refund") return;
  assert.equal(effect.chargeId, "ch_1");
  assert.equal(effect.paymentIntentId, "pi_1");
  assert.equal(effect.refundId, "re_1");
  assert.equal(effect.amountRefundedCents, 5000);
  assert.equal(effect.chargeAmountCents, 5000);
  assert.equal(effect.fullyRefunded, true);
});

test("interpret charge.refunded -> partial", () => {
  const effect = interpretEvent({
    id: "evt_ref_2",
    type: "charge.refunded",
    data: {
      object: {
        id: "ch_3",
        payment_intent: "pi_3",
        amount: 5000,
        amount_refunded: 2000,
        refunded: false,
        refunds: { data: [{ id: "re_3" }] },
      },
    },
  });
  assert.equal(effect.kind === "record_refund" && effect.fullyRefunded, false);
  assert.equal(effect.kind === "record_refund" && effect.amountRefundedCents, 2000);
});

test("interpret account.updated -> update_account", () => {
  const effect = interpretEvent({
    id: "evt_acct_1",
    type: "account.updated",
    data: {
      object: {
        id: "acct_1",
        charges_enabled: true,
        payouts_enabled: false,
        details_submitted: true,
      },
    },
  });
  assert.equal(effect.kind, "update_account");
  if (effect.kind !== "update_account") return;
  assert.equal(effect.stripeAccountId, "acct_1");
  assert.equal(effect.chargesEnabled, true);
  assert.equal(effect.payoutsEnabled, false);
  assert.equal(effect.detailsSubmitted, true);
});

test("interpret unknown type -> ignore", () => {
  const effect = interpretEvent({
    id: "evt_x",
    type: "invoice.paid",
    data: { object: {} },
  });
  assert.equal(effect.kind, "ignore");
});

// --- idempotent dispatch with a fake repo -----------------------------------
class FakeRepo implements PaymentsRepo {
  seen = new Set<string>();
  calls: WebhookEffect["kind"][] = [];
  deposits = 0;
  refunds = 0;
  confirms = 0;
  accounts = 0;

  reserveEvent(event: StripeEventLike): Promise<boolean> {
    if (this.seen.has(event.id)) return Promise.resolve(false);
    this.seen.add(event.id);
    return Promise.resolve(true);
  }
  recordDeposit(): Promise<void> {
    this.calls.push("record_deposit");
    this.deposits++;
    return Promise.resolve();
  }
  confirmPayment(): Promise<void> {
    this.calls.push("confirm_payment");
    this.confirms++;
    return Promise.resolve();
  }
  recordRefund(): Promise<void> {
    this.calls.push("record_refund");
    this.refunds++;
    return Promise.resolve();
  }
  updateArtistAccount(): Promise<void> {
    this.calls.push("update_account");
    this.accounts++;
    return Promise.resolve();
  }
}

test("handleStripeEvent applies once, dedupes on redelivery", async () => {
  const repo = new FakeRepo();
  const ev = checkoutCompleted();

  const first = await handleStripeEvent(ev, repo);
  assert.equal(first.handled, true);
  assert.equal(first.deduped, false);
  assert.equal(first.effect, "record_deposit");
  assert.equal(repo.deposits, 1);

  // Stripe redelivers the same event id -> no-op.
  const second = await handleStripeEvent(ev, repo);
  assert.equal(second.handled, false);
  assert.equal(second.deduped, true);
  assert.equal(repo.deposits, 1); // NOT applied again
});

test("handleStripeEvent routes each event type to its repo method", async () => {
  const repo = new FakeRepo();
  await handleStripeEvent(checkoutCompleted(), repo);
  await handleStripeEvent(
    { id: "evt_pi_9", type: "payment_intent.succeeded", data: { object: { id: "pi_9", latest_charge: "ch_9" } } },
    repo,
  );
  await handleStripeEvent(
    {
      id: "evt_ref_9",
      type: "charge.refunded",
      data: { object: { id: "ch_9", payment_intent: "pi_9", amount: 5000, amount_refunded: 5000, refunded: true, refunds: { data: [{ id: "re_9" }] } } },
    },
    repo,
  );
  await handleStripeEvent(
    { id: "evt_acct_9", type: "account.updated", data: { object: { id: "acct_9", charges_enabled: true, payouts_enabled: true, details_submitted: true } } },
    repo,
  );
  assert.deepEqual(repo.calls, [
    "record_deposit",
    "confirm_payment",
    "record_refund",
    "update_account",
  ]);
});

test("handleStripeEvent: ignore effect is reserved but does no work", async () => {
  const repo = new FakeRepo();
  const res = await handleStripeEvent(
    { id: "evt_ignore", type: "invoice.paid", data: { object: {} } },
    repo,
  );
  assert.equal(res.handled, false);
  assert.equal(res.deduped, false);
  assert.equal(res.effect, "ignore");
  assert.equal(repo.calls.length, 0);
});
