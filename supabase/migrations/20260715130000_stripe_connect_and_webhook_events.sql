-- Migration: stripe_connect_and_webhook_events
-- Adds the Stripe Connect account-status fields the onboarding + webhook flow
-- needs on artist_profiles, and a stripe_events dedupe table so the webhook
-- handler is idempotent (Stripe delivers events at-least-once).
--
-- artist_profiles.stripe_account_id already exists (identity_and_taxonomy).
-- Here we add the capability flags surfaced by the `account.updated` webhook so
-- the app can gate deposit collection on a fully-onboarded connected account.

-- ---------------------------------------------------------------------------
-- artist_profiles: Stripe Connect Express account capability flags.
-- ---------------------------------------------------------------------------
alter table public.artist_profiles
  add column if not exists stripe_charges_enabled  boolean not null default false,
  add column if not exists stripe_payouts_enabled  boolean not null default false,
  add column if not exists stripe_details_submitted boolean not null default false,
  add column if not exists stripe_onboarding_completed_at timestamptz;

-- Look up an artist by their connected-account id when handling `account.updated`.
create index if not exists artist_profiles_stripe_account_id_idx
  on public.artist_profiles (stripe_account_id)
  where stripe_account_id is not null;

-- ---------------------------------------------------------------------------
-- payments: extra lookup index for refund handling (charge.refunded arrives
-- keyed by charge id / payment_intent).
-- ---------------------------------------------------------------------------
create index if not exists payments_stripe_charge_idx
  on public.payments (stripe_charge_id)
  where stripe_charge_id is not null;

-- ---------------------------------------------------------------------------
-- stripe_events: idempotency ledger for the webhook. The primary key is the
-- Stripe event id (evt_...). The handler inserts a row on first receipt and
-- skips any event whose id is already present, so retried deliveries are no-ops.
--
-- Written ONLY by the webhook edge function via the service role. RLS is enabled
-- with NO policies, which denies all anon/authenticated access; the service role
-- bypasses RLS. No user ever needs to read this table.
-- ---------------------------------------------------------------------------
create table if not exists public.stripe_events (
  id           text primary key,          -- Stripe event id, e.g. evt_1AbC...
  type         text not null,             -- e.g. checkout.session.completed
  api_version  text,
  livemode     boolean,
  payload      jsonb,                     -- raw event, kept for audit/debug
  received_at  timestamptz not null default now()
);
create index if not exists stripe_events_type_idx on public.stripe_events (type);
create index if not exists stripe_events_received_at_idx on public.stripe_events (received_at);

alter table public.stripe_events enable row level security;
-- Intentionally no policies: locked to the service role only.

comment on table public.stripe_events is
  'Stripe webhook idempotency + audit ledger. Service-role writes only; RLS denies all other access.';
comment on column public.artist_profiles.stripe_charges_enabled is
  'Mirror of Stripe account.charges_enabled — true once the artist can accept destination charges.';
comment on column public.artist_profiles.stripe_payouts_enabled is
  'Mirror of Stripe account.payouts_enabled.';
comment on column public.artist_profiles.stripe_details_submitted is
  'Mirror of Stripe account.details_submitted — true once Express onboarding is complete.';
