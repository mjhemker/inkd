-- Migration: services_and_availability
-- services, availability_rules, availability_blocks, booking_policies.

-- ---------------------------------------------------------------------------
-- services: preset + custom bookable services.
-- ---------------------------------------------------------------------------
create table public.services (
  id                   uuid primary key default gen_random_uuid(),
  artist_id            uuid not null references public.artist_profiles (id) on delete cascade,
  location_id          uuid references public.studio_locations (id) on delete set null,
  name                 text not null,
  description          text,
  duration_minutes     int,
  price_type           public.service_price_type not null default 'fixed',
  price_cents          int,
  deposit_type         public.deposit_type not null default 'fixed',
  deposit_amount_cents int,
  deposit_percent      numeric(5,2),
  break_time_minutes   int not null default 0,
  lead_time_hours      int not null default 0,
  is_public            boolean not null default true,
  video_conferencing   boolean not null default false,
  add_ons              jsonb not null default '[]'::jsonb,
  calendar_ref         text,
  is_preset            boolean not null default false,
  preset_key           text,
  sort_order           int not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index services_artist_id_idx on public.services (artist_id);
create index services_location_id_idx on public.services (location_id);
create index services_public_idx on public.services (artist_id) where is_public;

create trigger services_set_updated_at before update on public.services
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- availability_rules: weekly recurring business hours (per location optional).
-- ---------------------------------------------------------------------------
create table public.availability_rules (
  id          uuid primary key default gen_random_uuid(),
  artist_id   uuid not null references public.artist_profiles (id) on delete cascade,
  location_id uuid references public.studio_locations (id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time  time not null,
  end_time    time not null,
  is_open     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (end_time > start_time)
);
create index availability_rules_artist_id_idx on public.availability_rules (artist_id);
create index availability_rules_location_id_idx on public.availability_rules (location_id);

create trigger availability_rules_set_updated_at before update on public.availability_rules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- availability_blocks: planned-ahead exceptions (vacations, holidays, etc.).
-- ---------------------------------------------------------------------------
create table public.availability_blocks (
  id           uuid primary key default gen_random_uuid(),
  artist_id    uuid not null references public.artist_profiles (id) on delete cascade,
  location_id  uuid references public.studio_locations (id) on delete cascade,
  block_type   public.availability_block_type not null default 'vacation',
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  is_available boolean not null default false, -- false = blocked; true = extra open hours
  reason       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index availability_blocks_artist_id_idx on public.availability_blocks (artist_id);
create index availability_blocks_location_id_idx on public.availability_blocks (location_id);
create index availability_blocks_range_idx on public.availability_blocks (artist_id, starts_at, ends_at);

create trigger availability_blocks_set_updated_at before update on public.availability_blocks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- booking_policies: one per artist; controls booking window + intake options.
-- ---------------------------------------------------------------------------
create table public.booking_policies (
  id                          uuid primary key default gen_random_uuid(),
  artist_id                   uuid not null unique references public.artist_profiles (id) on delete cascade,
  booking_window              public.booking_window not null default '2_3mo',
  allow_image_uploads         boolean not null default true,
  allow_document_uploads      boolean not null default true,
  require_medical_disclosure  boolean not null default false,
  min_notice_hours            int not null default 24,
  max_active_requests         int,
  auto_decline_when_closed    boolean not null default true,
  custom_intake_fields        jsonb not null default '[]'::jsonb,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index booking_policies_artist_id_idx on public.booking_policies (artist_id);

create trigger booking_policies_set_updated_at before update on public.booking_policies
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table public.services            enable row level security;
alter table public.availability_rules  enable row level security;
alter table public.availability_blocks enable row level security;
alter table public.booking_policies    enable row level security;

-- services: public services readable by anyone; owner full access.
create policy services_select on public.services
  for select using (is_public or artist_id = (select public.current_artist_id()));
create policy services_insert on public.services
  for insert with check (artist_id = (select public.current_artist_id()));
create policy services_update on public.services
  for update using (artist_id = (select public.current_artist_id()))
  with check (artist_id = (select public.current_artist_id()));
create policy services_delete on public.services
  for delete using (artist_id = (select public.current_artist_id()));

-- availability_rules: public read (needed for client-side slot display); owner writes.
create policy availability_rules_select on public.availability_rules
  for select using (true);
create policy availability_rules_insert on public.availability_rules
  for insert with check (artist_id = (select public.current_artist_id()));
create policy availability_rules_update on public.availability_rules
  for update using (artist_id = (select public.current_artist_id()))
  with check (artist_id = (select public.current_artist_id()));
create policy availability_rules_delete on public.availability_rules
  for delete using (artist_id = (select public.current_artist_id()));

-- availability_blocks: public read (so clients can't request blocked days); owner writes.
create policy availability_blocks_select on public.availability_blocks
  for select using (true);
create policy availability_blocks_insert on public.availability_blocks
  for insert with check (artist_id = (select public.current_artist_id()));
create policy availability_blocks_update on public.availability_blocks
  for update using (artist_id = (select public.current_artist_id()))
  with check (artist_id = (select public.current_artist_id()));
create policy availability_blocks_delete on public.availability_blocks
  for delete using (artist_id = (select public.current_artist_id()));

-- booking_policies: public read (clients need the booking window); owner writes.
create policy booking_policies_select on public.booking_policies
  for select using (true);
create policy booking_policies_insert on public.booking_policies
  for insert with check (artist_id = (select public.current_artist_id()));
create policy booking_policies_update on public.booking_policies
  for update using (artist_id = (select public.current_artist_id()))
  with check (artist_id = (select public.current_artist_id()));
create policy booking_policies_delete on public.booking_policies
  for delete using (artist_id = (select public.current_artist_id()));
