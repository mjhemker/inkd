-- Migration: identity_and_taxonomy
-- profiles, artist_profiles, studio_locations, styles taxonomy, artist_styles.
-- Includes the current_artist_id() RLS helper, indexes, triggers, and RLS.

-- ---------------------------------------------------------------------------
-- profiles: 1:1 with auth.users. Dual-role (every user is a client; is_artist
-- flags those who also have an artist_profiles row).
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  handle        text,
  display_name  text,
  email         text,
  phone         text,
  avatar_url    text,
  bio           text,
  is_artist     boolean not null default false,
  is_public     boolean not null default false,
  city          text,
  state         public.us_state,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index profiles_handle_lower_key on public.profiles (lower(handle)) where handle is not null;
create index profiles_is_public_idx on public.profiles (is_public) where is_public;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- artist_profiles: extends a profile with the artist business identity.
-- ---------------------------------------------------------------------------
create table public.artist_profiles (
  id                        uuid primary key default gen_random_uuid(),
  profile_id                uuid not null unique references public.profiles (id) on delete cascade,
  bio                       text,
  tagline                   text,
  styles                    text[] not null default '{}',
  classification            public.artist_classification,
  travel_fly_out            boolean not null default false,
  travel_house_calls        boolean not null default false,
  travel_at_home            boolean not null default false,
  accepts_new_clients       boolean not null default true,
  years_experience          int,
  instagram_handle          text,
  onboarding_step           int not null default 0,
  onboarding_completed_at   timestamptz,
  is_published              boolean not null default false,
  stripe_account_id         text,
  stripe_identity_verified  boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index artist_profiles_profile_id_idx on public.artist_profiles (profile_id);
create index artist_profiles_is_published_idx on public.artist_profiles (is_published) where is_published;
create index artist_profiles_classification_idx on public.artist_profiles (classification);

create trigger artist_profiles_set_updated_at before update on public.artist_profiles
  for each row execute function public.set_updated_at();

-- RLS helper: the artist_profiles.id owned by the current auth user (or NULL).
-- SECURITY DEFINER so it bypasses RLS on artist_profiles (no policy recursion).
create or replace function public.current_artist_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.artist_profiles where profile_id = auth.uid() limit 1
$$;

-- ---------------------------------------------------------------------------
-- studio_locations: many per artist, geocoded for map/distance search.
-- ---------------------------------------------------------------------------
create table public.studio_locations (
  id             uuid primary key default gen_random_uuid(),
  artist_id      uuid not null references public.artist_profiles (id) on delete cascade,
  name           text,
  address_line1  text,
  address_line2  text,
  city           text,
  state          public.us_state,
  postal_code    text,
  country        text not null default 'US',
  lat            double precision,
  lng            double precision,
  is_primary     boolean not null default false,
  is_public      boolean not null default true,
  phone          text,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index studio_locations_artist_id_idx on public.studio_locations (artist_id);
-- Great-circle distance search index (earthdistance/cube).
create index studio_locations_earth_idx on public.studio_locations
  using gist (extensions.ll_to_earth(lat, lng))
  where lat is not null and lng is not null;
create index studio_locations_city_state_idx on public.studio_locations (city, state);

create trigger studio_locations_set_updated_at before update on public.studio_locations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- styles: canonical tattoo-style taxonomy (seeded separately).
-- ---------------------------------------------------------------------------
create table public.styles (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null,
  name         text not null,
  category     text,
  description  text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create unique index styles_slug_lower_key on public.styles (lower(slug));

-- ---------------------------------------------------------------------------
-- artist_styles: normalized artist <-> style tags.
-- ---------------------------------------------------------------------------
create table public.artist_styles (
  artist_id  uuid not null references public.artist_profiles (id) on delete cascade,
  style_id   uuid not null references public.styles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (artist_id, style_id)
);
create index artist_styles_style_id_idx on public.artist_styles (style_id);

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table public.profiles          enable row level security;
alter table public.artist_profiles   enable row level security;
alter table public.studio_locations  enable row level security;
alter table public.styles            enable row level security;
alter table public.artist_styles     enable row level security;

-- profiles: own row full access; public profiles readable by anyone.
create policy profiles_select on public.profiles
  for select using (is_public or id = (select auth.uid()));
create policy profiles_insert on public.profiles
  for insert with check (id = (select auth.uid()));
create policy profiles_update on public.profiles
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- artist_profiles: published readable by anyone; owner full access.
create policy artist_profiles_select on public.artist_profiles
  for select using (is_published or profile_id = (select auth.uid()));
create policy artist_profiles_insert on public.artist_profiles
  for insert with check (profile_id = (select auth.uid()));
create policy artist_profiles_update on public.artist_profiles
  for update using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy artist_profiles_delete on public.artist_profiles
  for delete using (profile_id = (select auth.uid()));

-- studio_locations: public ones readable by anyone; owner full access.
create policy studio_locations_select on public.studio_locations
  for select using (is_public or artist_id = (select public.current_artist_id()));
create policy studio_locations_insert on public.studio_locations
  for insert with check (artist_id = (select public.current_artist_id()));
create policy studio_locations_update on public.studio_locations
  for update using (artist_id = (select public.current_artist_id()))
  with check (artist_id = (select public.current_artist_id()));
create policy studio_locations_delete on public.studio_locations
  for delete using (artist_id = (select public.current_artist_id()));

-- styles: public read-only taxonomy (writes via service role only).
create policy styles_select on public.styles
  for select using (true);

-- artist_styles: tags are public; owning artist manages them.
create policy artist_styles_select on public.artist_styles
  for select using (true);
create policy artist_styles_insert on public.artist_styles
  for insert with check (artist_id = (select public.current_artist_id()));
create policy artist_styles_delete on public.artist_styles
  for delete using (artist_id = (select public.current_artist_id()));
