-- Migration: booking_pipeline
-- booking_requests -> bookings -> sessions, plus the payments ledger.
-- client_id references profiles(id) (= auth.uid()); artist_id references
-- artist_profiles(id). Both are denormalized onto child rows for simple RLS.

-- ---------------------------------------------------------------------------
-- booking_requests: client intake before an artist accepts.
-- ---------------------------------------------------------------------------
create table public.booking_requests (
  id                uuid primary key default gen_random_uuid(),
  artist_id         uuid not null references public.artist_profiles (id) on delete cascade,
  client_id         uuid not null references public.profiles (id) on delete cascade,
  service_id        uuid references public.services (id) on delete set null,
  location_id       uuid references public.studio_locations (id) on delete set null,
  status            public.booking_request_status not null default 'pending',
  placement         text,
  size_description  text,
  description       text,
  reference_uploads jsonb not null default '[]'::jsonb,
  budget_min_cents  int,
  budget_max_cents  int,
  has_medical_flags boolean not null default false,
  medical_notes     text,
  is_cover_up       boolean not null default false,
  is_first_tattoo   boolean,
  preferred_dates   jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index booking_requests_artist_id_idx on public.booking_requests (artist_id);
create index booking_requests_client_id_idx on public.booking_requests (client_id);
create index booking_requests_service_id_idx on public.booking_requests (service_id);
create index booking_requests_location_id_idx on public.booking_requests (location_id);
create index booking_requests_status_idx on public.booking_requests (artist_id, status);

create trigger booking_requests_set_updated_at before update on public.booking_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- bookings: accepted engagement (may span multiple sessions).
-- ---------------------------------------------------------------------------
create table public.bookings (
  id                uuid primary key default gen_random_uuid(),
  request_id        uuid references public.booking_requests (id) on delete set null,
  artist_id         uuid not null references public.artist_profiles (id) on delete cascade,
  client_id         uuid not null references public.profiles (id) on delete cascade,
  service_id        uuid references public.services (id) on delete set null,
  status            public.booking_status not null default 'pending',
  title             text,
  total_price_cents int,
  deposit_cents     int,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index bookings_request_id_idx on public.bookings (request_id);
create index bookings_artist_id_idx on public.bookings (artist_id);
create index bookings_client_id_idx on public.bookings (client_id);
create index bookings_service_id_idx on public.bookings (service_id);
create index bookings_status_idx on public.bookings (artist_id, status);

create trigger bookings_set_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- sessions: individual appointments within a booking; per-session money state.
-- ---------------------------------------------------------------------------
create table public.sessions (
  id               uuid primary key default gen_random_uuid(),
  booking_id       uuid not null references public.bookings (id) on delete cascade,
  artist_id        uuid not null references public.artist_profiles (id) on delete cascade,
  client_id        uuid not null references public.profiles (id) on delete cascade,
  location_id      uuid references public.studio_locations (id) on delete set null,
  session_number   int not null default 1,
  status           public.session_status not null default 'scheduled',
  scheduled_start  timestamptz,
  scheduled_end    timestamptz,
  duration_minutes int,
  deposit_cents    int not null default 0,
  deposit_paid     boolean not null default false,
  balance_cents    int not null default 0,
  balance_paid     boolean not null default false,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index sessions_booking_id_idx on public.sessions (booking_id);
create index sessions_artist_id_idx on public.sessions (artist_id);
create index sessions_client_id_idx on public.sessions (client_id);
create index sessions_location_id_idx on public.sessions (location_id);
create index sessions_scheduled_start_idx on public.sessions (artist_id, scheduled_start);

create trigger sessions_set_updated_at before update on public.sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- payments: money ledger (deposits, balances, refunds, fees, payouts).
-- Amounts are integer cents. Writes primarily via Stripe webhooks (service role).
-- ---------------------------------------------------------------------------
create table public.payments (
  id                        uuid primary key default gen_random_uuid(),
  booking_id                uuid references public.bookings (id) on delete set null,
  session_id                uuid references public.sessions (id) on delete set null,
  artist_id                 uuid not null references public.artist_profiles (id) on delete cascade,
  client_id                 uuid references public.profiles (id) on delete set null,
  kind                      public.payment_kind not null,
  status                    public.payment_status not null default 'pending',
  amount_cents              int not null,
  inkd_fee_cents            int not null default 0,
  currency                  text not null default 'usd',
  stripe_payment_intent_id  text,
  stripe_charge_id          text,
  stripe_refund_id          text,
  stripe_transfer_id        text,
  description               text,
  metadata                  jsonb not null default '{}'::jsonb,
  processed_at              timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index payments_booking_id_idx on public.payments (booking_id);
create index payments_session_id_idx on public.payments (session_id);
create index payments_artist_id_idx on public.payments (artist_id);
create index payments_client_id_idx on public.payments (client_id);
create index payments_stripe_pi_idx on public.payments (stripe_payment_intent_id);

create trigger payments_set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- RLS: both the client and the owning artist can see a row; each side writes
-- the parts it owns. Stripe/edge functions use the service role (bypasses RLS).
-- ===========================================================================
alter table public.booking_requests enable row level security;
alter table public.bookings         enable row level security;
alter table public.sessions         enable row level security;
alter table public.payments         enable row level security;

-- booking_requests: client creates + withdraws; artist triages.
create policy booking_requests_select on public.booking_requests
  for select using (
    client_id = (select auth.uid()) or artist_id = (select public.current_artist_id())
  );
create policy booking_requests_insert on public.booking_requests
  for insert with check (client_id = (select auth.uid()));
create policy booking_requests_update on public.booking_requests
  for update using (
    client_id = (select auth.uid()) or artist_id = (select public.current_artist_id())
  ) with check (
    client_id = (select auth.uid()) or artist_id = (select public.current_artist_id())
  );

-- bookings: artist creates/manages; both parties read.
create policy bookings_select on public.bookings
  for select using (
    client_id = (select auth.uid()) or artist_id = (select public.current_artist_id())
  );
create policy bookings_insert on public.bookings
  for insert with check (artist_id = (select public.current_artist_id()));
create policy bookings_update on public.bookings
  for update using (
    client_id = (select auth.uid()) or artist_id = (select public.current_artist_id())
  ) with check (
    client_id = (select auth.uid()) or artist_id = (select public.current_artist_id())
  );

-- sessions: artist manages scheduling; both parties read.
create policy sessions_select on public.sessions
  for select using (
    client_id = (select auth.uid()) or artist_id = (select public.current_artist_id())
  );
create policy sessions_insert on public.sessions
  for insert with check (artist_id = (select public.current_artist_id()));
create policy sessions_update on public.sessions
  for update using (
    client_id = (select auth.uid()) or artist_id = (select public.current_artist_id())
  ) with check (
    client_id = (select auth.uid()) or artist_id = (select public.current_artist_id())
  );

-- payments: both parties read their ledger; only the artist may write via API
-- (real writes are server-side through the service role).
create policy payments_select on public.payments
  for select using (
    client_id = (select auth.uid()) or artist_id = (select public.current_artist_id())
  );
create policy payments_insert on public.payments
  for insert with check (artist_id = (select public.current_artist_id()));
create policy payments_update on public.payments
  for update using (artist_id = (select public.current_artist_id()))
  with check (artist_id = (select public.current_artist_id()));
