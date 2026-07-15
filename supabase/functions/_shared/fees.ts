// Pure money math for INKD deposits + the INKD application fee.
//
// All amounts are integer cents. These functions have NO IO and NO Stripe/
// Supabase dependency, which is what makes them unit-testable offline (see
// _shared/fees.test.ts). The edge functions call them with data already loaded
// from the DB.

/** Minimal shape of a `services` row needed to derive a deposit. */
export interface ServiceDepositPolicy {
  deposit_type: "none" | "fixed" | "percent";
  deposit_amount_cents: number | null;
  deposit_percent: number | string | null; // numeric(5,2) comes back as string
  price_cents: number | null;
}

/** Minimal shape of a `sessions` row. */
export interface SessionMoney {
  deposit_cents: number | null;
  deposit_paid: boolean | null;
}

/**
 * The INKD application fee, in cents, taken out of a deposit as a destination
 * charge's `application_fee_amount`. Rounded half-up. Never exceeds the deposit.
 *
 * @param amountCents the charge amount (the deposit) in cents
 * @param feeBps      INKD fee in basis points (1000 = 10%)
 */
export function computeInkdFeeCents(amountCents: number, feeBps: number): number {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return 0;
  if (!Number.isFinite(feeBps) || feeBps <= 0) return 0;
  const fee = Math.round((amountCents * feeBps) / 10_000);
  return Math.min(fee, amountCents);
}

/** The amount that lands in the artist's connected account after the INKD fee. */
export function computeArtistNetCents(amountCents: number, feeBps: number): number {
  return Math.max(0, amountCents - computeInkdFeeCents(amountCents, feeBps));
}

/**
 * Derive the deposit due, in cents, from a service's deposit policy.
 *   - none    → 0
 *   - fixed   → deposit_amount_cents
 *   - percent → round(price_cents * deposit_percent / 100)
 * Returns 0 when the inputs required for the chosen policy are absent.
 */
export function depositFromServicePolicy(service: ServiceDepositPolicy): number {
  switch (service.deposit_type) {
    case "fixed":
      return normalizeCents(service.deposit_amount_cents);
    case "percent": {
      const pct = toNumber(service.deposit_percent);
      const price = normalizeCents(service.price_cents);
      if (pct <= 0 || price <= 0) return 0;
      return Math.round((price * pct) / 100);
    }
    case "none":
    default:
      return 0;
  }
}

/**
 * Resolve the deposit to charge for a session. The session's stored
 * `deposit_cents` (set when the artist scheduled it) is authoritative; the
 * service policy is the fallback when the session has no explicit deposit.
 */
export function resolveDepositCents(args: {
  session: SessionMoney;
  service: ServiceDepositPolicy | null;
}): number {
  const sessionDeposit = normalizeCents(args.session.deposit_cents);
  if (sessionDeposit > 0) return sessionDeposit;
  return args.service ? depositFromServicePolicy(args.service) : 0;
}

/** Stripe requires charges of at least $0.50 USD; below that it rejects. */
export const STRIPE_MIN_CHARGE_CENTS = 50;

function normalizeCents(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

function toNumber(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === "string" ? Number.parseFloat(value) : value;
  return Number.isFinite(n) ? n : 0;
}
