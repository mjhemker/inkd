// Offline unit tests for the pure money math. Runs with zero dependencies under
// Node's built-in runner (type-stripping):
//   node --test supabase/functions/_shared/fees.test.ts
// The same fees.ts module is imported by the deployed Deno functions.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeInkdFeeCents,
  computeArtistNetCents,
  depositFromServicePolicy,
  resolveDepositCents,
  STRIPE_MIN_CHARGE_CENTS,
  type ServiceDepositPolicy,
} from "./fees.ts";

test("computeInkdFeeCents: 10% default (1000 bps)", () => {
  assert.equal(computeInkdFeeCents(5000, 1000), 500); // $50 deposit -> $5 fee
  assert.equal(computeInkdFeeCents(10000, 1000), 1000);
});

test("computeInkdFeeCents: configurable bps", () => {
  assert.equal(computeInkdFeeCents(5000, 500), 250); // 5%
  assert.equal(computeInkdFeeCents(5000, 1500), 750); // 15%
  assert.equal(computeInkdFeeCents(5000, 0), 0);
});

test("computeInkdFeeCents: rounds half-up", () => {
  assert.equal(computeInkdFeeCents(999, 1000), 100); // 99.9 -> 100
  assert.equal(computeInkdFeeCents(994, 1000), 99); // 99.4 -> 99
});

test("computeInkdFeeCents: never exceeds the charge, guards bad input", () => {
  assert.equal(computeInkdFeeCents(100, 20000), 100); // clamped to amount
  assert.equal(computeInkdFeeCents(0, 1000), 0);
  assert.equal(computeInkdFeeCents(-500, 1000), 0);
  assert.equal(computeInkdFeeCents(Number.NaN, 1000), 0);
});

test("computeArtistNetCents: deposit minus INKD fee", () => {
  assert.equal(computeArtistNetCents(5000, 1000), 4500);
  assert.equal(computeArtistNetCents(5000, 0), 5000);
});

test("depositFromServicePolicy: none", () => {
  const svc: ServiceDepositPolicy = {
    deposit_type: "none",
    deposit_amount_cents: 5000,
    deposit_percent: 50,
    price_cents: 20000,
  };
  assert.equal(depositFromServicePolicy(svc), 0);
});

test("depositFromServicePolicy: fixed", () => {
  const svc: ServiceDepositPolicy = {
    deposit_type: "fixed",
    deposit_amount_cents: 7500,
    deposit_percent: null,
    price_cents: 20000,
  };
  assert.equal(depositFromServicePolicy(svc), 7500);
});

test("depositFromServicePolicy: fixed with missing amount -> 0", () => {
  const svc: ServiceDepositPolicy = {
    deposit_type: "fixed",
    deposit_amount_cents: null,
    deposit_percent: null,
    price_cents: 20000,
  };
  assert.equal(depositFromServicePolicy(svc), 0);
});

test("depositFromServicePolicy: percent (numeric string from pg)", () => {
  const svc: ServiceDepositPolicy = {
    deposit_type: "percent",
    deposit_amount_cents: null,
    deposit_percent: "25.00", // numeric(5,2) arrives as string
    price_cents: 20000,
  };
  assert.equal(depositFromServicePolicy(svc), 5000); // 25% of $200
});

test("depositFromServicePolicy: percent rounds", () => {
  const svc: ServiceDepositPolicy = {
    deposit_type: "percent",
    deposit_amount_cents: null,
    deposit_percent: 33.33,
    price_cents: 10000,
  };
  assert.equal(depositFromServicePolicy(svc), 3333);
});

test("depositFromServicePolicy: percent with no price -> 0", () => {
  const svc: ServiceDepositPolicy = {
    deposit_type: "percent",
    deposit_amount_cents: null,
    deposit_percent: 25,
    price_cents: null,
  };
  assert.equal(depositFromServicePolicy(svc), 0);
});

test("resolveDepositCents: session deposit is authoritative", () => {
  const service: ServiceDepositPolicy = {
    deposit_type: "percent",
    deposit_amount_cents: null,
    deposit_percent: 50,
    price_cents: 20000,
  };
  const deposit = resolveDepositCents({
    session: { deposit_cents: 6000, deposit_paid: false },
    service,
  });
  assert.equal(deposit, 6000); // session wins over the 10000 policy value
});

test("resolveDepositCents: falls back to service policy", () => {
  const service: ServiceDepositPolicy = {
    deposit_type: "fixed",
    deposit_amount_cents: 4000,
    deposit_percent: null,
    price_cents: 20000,
  };
  const deposit = resolveDepositCents({
    session: { deposit_cents: 0, deposit_paid: false },
    service,
  });
  assert.equal(deposit, 4000);
});

test("resolveDepositCents: no session deposit and no service -> 0", () => {
  const deposit = resolveDepositCents({
    session: { deposit_cents: null, deposit_paid: false },
    service: null,
  });
  assert.equal(deposit, 0);
});

test("STRIPE_MIN_CHARGE_CENTS is the Stripe floor", () => {
  assert.equal(STRIPE_MIN_CHARGE_CENTS, 50);
});
