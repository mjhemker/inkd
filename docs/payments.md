# INKD Payments — Stripe Connect (deposits + INKD fee)

Everything here is **code-complete against env placeholders**. No Stripe keys
exist yet — when Michael provides test keys, wiring them (one `secrets set` +
one webhook endpoint) is the ONLY remaining step. See
[§ When Michael has the keys](#when-michael-has-the-stripe-keys).

Reference: SPEC §0 (free now; INKD takes a % booking fee) and §1 (Stripe Connect
Express; deposits flow artist-direct minus INKD's application fee; test mode
until pilot).

---

## Money flow

INKD never holds the money. A deposit is a **Stripe destination charge** on the
INKD platform account that settles net into the artist's connected Express
account, with the INKD fee peeled off as `application_fee_amount`.

```
                        create-deposit-checkout  (POST { session_id } -> { url })
                                    │
  Client ── pays deposit ─▶ Stripe Checkout Session (mode: payment)
   (card)                          │  payment_intent_data:
                                   │    application_fee_amount = INKD fee (INKD_FEE_BPS)
                                   │    transfer_data.destination = artist.stripe_account_id
                                   ▼
                        ┌─────────────────────────┐
                        │  Destination charge on   │
                        │  INKD platform account   │
                        └───────────┬─────────────┘
                    application fee │ transfer (deposit − fee)
                   ┌────────────────┴───────────────┐
                   ▼                                 ▼
          INKD platform balance            Artist connected account
          (INKD_FEE_BPS of deposit)        (deposit minus INKD fee)

  Example — $50.00 deposit, INKD_FEE_BPS=1000 (10%):
    application_fee_amount = 500  ($5.00)  -> INKD
    artist receives        = 4500 ($45.00) -> artist's Stripe account
```

Stripe events then drive the `payments` ledger + session state via the webhook
(see [Webhook](#webhook-stripe-webhook)).

### Refund paths

- **Full or partial refund** of a deposit is issued from the original charge
  (Stripe Dashboard or a future refund function). Stripe emits `charge.refunded`;
  the webhook inserts a `kind='refund'` ledger row and flips the original deposit
  to `refunded` / `partially_refunded`.
- By default the **INKD application fee is NOT returned** on a refund. If a policy
  ever needs fee reversal, issue the refund with `refund_application_fee: true`
  (not wired yet — deposits are non-refundable of the platform fee for now).
- Because it's a destination charge, a refund pulls from the platform balance;
  ensure the connected account's transferred funds are reconciled (Stripe handles
  the balance mechanics for destination charges automatically).

### Chargeback notes

- On a destination charge, a **dispute is charged back to the platform** (INKD),
  not the artist, and Stripe debits the platform balance for the disputed amount
  plus the dispute fee. Operationally INKD absorbs/recovers this out-of-band with
  the artist; there is no automatic clawback from the connected account in this
  build. `charge.dispute.*` events are **not handled yet** — add a handler in
  `_shared/webhook.ts` when dispute automation is needed.
- Mitigation for pilot: deposits are small, test mode until launch, and the
  Express onboarding + Stripe Identity (SPEC §3 step 5) reduces fraud risk.

---

## Environment variables

Set as **Supabase function secrets** (never committed). Template:
`supabase/functions/.env.example`.

| Var | Required | Default | Purpose |
| --- | --- | --- | --- |
| `STRIPE_SECRET_KEY` | ✅ | — | Stripe API key (`sk_test_…`, later `sk_live_…`). |
| `STRIPE_WEBHOOK_SECRET` | ✅ | — | Signing secret for the webhook endpoint (`whsec_…`). |
| `INKD_FEE_BPS` | — | `1000` | INKD application fee in basis points (1000 = 10%). Clamped 0–5000. |
| `INKD_APP_URL` | — | `https://getinkd.co` | Base URL for Checkout success/cancel + Connect return/refresh redirects. |
| `STRIPE_CURRENCY` | — | `usd` | ISO currency for deposits. |
| `SUPABASE_URL` | auto | — | Injected by the Supabase runtime. |
| `SUPABASE_ANON_KEY` | auto | — | Injected; used to verify the caller's JWT. |
| `SUPABASE_SERVICE_ROLE_KEY` | auto | — | Injected; used for webhook ledger writes (bypasses RLS). |

The three `SUPABASE_*` vars are provided automatically to deployed functions — do
**not** set them by hand.

---

## Functions

All live under `supabase/functions/`. Shared code is in `_shared/`. JWT gateway
verification per function is declared in `supabase/config.toml`.

### `connect-onboarding-link`  (auth: artist)

`POST /functions/v1/connect-onboarding-link`  ·  body `{}` (optional
`{ return_url, refresh_url }`)  →  `{ url, account_id, charges_enabled }`

Creates or reuses the artist's Stripe Connect **Express** account, stores
`stripe_account_id` on `artist_profiles`, and returns a one-time Stripe
**account link** to complete onboarding (which also unlocks payouts).

### `create-deposit-checkout`  (auth: client) — **the booking-agent contract**

`POST /functions/v1/create-deposit-checkout`  ·  body `{ session_id }`  →
`{ url }`

Validates that the caller owns the session, that the artist's connected account
can accept charges, and resolves the deposit from the service's deposit policy
(`resolveDepositCents`). Opens a Checkout Session as a destination charge with
`application_fee_amount` = the INKD fee, and returns the redirect `url`.

Failure envelope (all functions): `{ "error": { "code", "message" } }` with the
matching HTTP status (`400/401/403/404/409/500`).

### `stripe-webhook`  (auth: Stripe signature — `verify_jwt = false`)

`POST /functions/v1/stripe-webhook`. Signature-verified with
`STRIPE_WEBHOOK_SECRET` via `constructEventAsync` (Deno needs the async path).
Idempotent through the `stripe_events` dedupe table. Handles:

| Event | Effect |
| --- | --- |
| `checkout.session.completed` | Upsert `payments` deposit row (by payment_intent); mark `sessions.deposit_paid = true`. |
| `payment_intent.succeeded` | Confirm the deposit payment `succeeded`; attach `stripe_charge_id`. |
| `charge.refunded` | Insert `kind='refund'` ledger row; set original to `refunded`/`partially_refunded`. |
| `account.updated` | Mirror `charges_enabled` / `payouts_enabled` / `details_submitted` onto `artist_profiles`. |

---

## Client helpers (`packages/core`)

`packages/core/src/api/payments.ts` + `packages/core/src/hooks/usePayments.ts`:

- `startConnectOnboarding(client, opts?)` / `useStartConnectOnboarding()`
- `requestDepositCheckout(client, sessionId)` / `useRequestDepositCheckout()`
  — the booking UI's contract: `mutateAsync(sessionId) -> { url }`.
- `listArtistPayments` / `useArtistPayments`, `getArtistEarnings` +
  `summarizeEarnings` / `useArtistEarnings` (gross, INKD fee, refunds, net,
  pending, count) — powers the artist earnings view.
- `listSessionPayments` / `useSessionPayments`, `refundStatusForSession`
  (`none | partial | full`).
- `getConnectStatus` / `useConnectStatus`, `connectStatusFromProfile`
  (`ready` = has account && charges enabled).

These call the edge functions via `supabase.functions.invoke` (JWT forwarded
automatically). No Stripe key ever reaches the client — only a redirect URL.

---

## Database

Migration `supabase/migrations/20260715130000_stripe_connect_and_webhook_events.sql`
(applied to project `khlpidflnvkqafkvkpfy`):

- `artist_profiles` += `stripe_charges_enabled`, `stripe_payouts_enabled`,
  `stripe_details_submitted`, `stripe_onboarding_completed_at`
  (`stripe_account_id` already existed).
- `stripe_events` — webhook idempotency/audit ledger. RLS enabled, **no policies**
  (service-role only; the `rls_enabled_no_policy` advisor INFO is intentional).
- Indexes for account-id + charge-id lookups.

Existing tables used: `payments` (ledger), `sessions` (`deposit_cents`,
`deposit_paid`), `services` (deposit policy), `bookings`.

---

## Tests (offline, zero dependencies)

Pure logic (fee math + webhook interpretation/idempotency) is unit-tested and
runs **without Stripe, Supabase, or network**, using Node's built-in runner with
TypeScript type-stripping (Node ≥ 22):

```bash
node --test supabase/functions/_shared/fees.test.ts \
            supabase/functions/_shared/webhook.test.ts
# 26 tests, all green
```

The same `_shared/fees.ts` + `_shared/webhook.ts` modules are imported by the
deployed Deno functions, so these tests cover the deployed logic. Under a real
Deno install the same suite intent is also exposed via `deno task test`
(`supabase/functions/deno.json`).

> Note: `deno check`/`deno test` on the function entrypoints requires the Deno
> CLI. In the build sandbox the Deno installer host was blocked by egress policy,
> so entrypoints were validated with `node --experimental-strip-types --check`
> (syntax) + the offline unit suite. Run `deno check` once locally before deploy.

---

## Deploying the functions

> Do **not** deploy until Stripe keys exist. Steps for when they do:

```bash
# 1. Set secrets (from a filled-in copy of supabase/functions/.env.example)
supabase secrets set --project-ref khlpidflnvkqafkvkpfy \
  --env-file supabase/functions/.env

# 2. Type-check locally
cd supabase/functions && deno task check

# 3. Deploy (config.toml controls verify_jwt per function)
supabase functions deploy connect-onboarding-link --project-ref khlpidflnvkqafkvkpfy
supabase functions deploy create-deposit-checkout  --project-ref khlpidflnvkqafkvkpfy
supabase functions deploy stripe-webhook           --project-ref khlpidflnvkqafkvkpfy --no-verify-jwt
```

`--no-verify-jwt` on the webhook lets Stripe (which has no Supabase JWT) reach it;
the function verifies the Stripe signature itself.

## Webhook setup

1. Stripe Dashboard → Developers → **Webhooks** → Add endpoint.
2. URL: `https://khlpidflnvkqafkvkpfy.functions.supabase.co/stripe-webhook`
3. Events: `checkout.session.completed`, `payment_intent.succeeded`,
   `charge.refunded`, `account.updated`.
4. Copy the endpoint's **Signing secret** (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`
   and re-run `supabase secrets set`.
5. For Connect account events, ensure the endpoint listens to **Connected
   accounts** for `account.updated` (or add a Connect webhook).

Local testing: `stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook`
prints a `whsec_…` to use as the secret while running `supabase functions serve`.

---

## When Michael has the Stripe keys

1. In the Stripe Dashboard (test mode) enable **Connect** (Express).
2. Fill `supabase/functions/.env` from `.env.example` with `sk_test_…`.
3. `supabase secrets set --env-file supabase/functions/.env` (sets
   `STRIPE_SECRET_KEY`; `INKD_FEE_BPS`/`INKD_APP_URL` optional).
4. Deploy the three functions (above).
5. Create the webhook endpoint, grab `whsec_…`, set `STRIPE_WEBHOOK_SECRET`,
   re-`secrets set`.
6. Test-mode walkthrough:
   - Artist: call `connect-onboarding-link`, finish Express onboarding with
     Stripe's test data → `account.updated` flips `stripe_charges_enabled`.
   - Client: `create-deposit-checkout { session_id }` → open `url`, pay with test
     card `4242 4242 4242 4242` (any future expiry/CVC) → `checkout.session.completed`
     + `payment_intent.succeeded` → `payments` deposit row `succeeded`,
     `sessions.deposit_paid = true`.
   - Refund from the Dashboard → `charge.refunded` → refund ledger row appears.

That's the whole wiring. Nothing else in the code needs to change to go live —
swap `sk_test_`/`whsec_` for live values at pilot.
