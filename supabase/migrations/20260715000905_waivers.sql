-- Migration: waivers
-- waiver_templates (artist or INKD-global; MD/PA aware) and signed_waivers
-- (e-signature records, immutable after signing).

create table public.waiver_templates (
  id              uuid primary key default gen_random_uuid(),
  artist_id       uuid references public.artist_profiles (id) on delete cascade, -- null = INKD global template
  title           text not null,
  body            text not null,
  state           public.us_state,
  version         int not null default 1,
  is_active       boolean not null default true,
  required_fields jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index waiver_templates_artist_id_idx on public.waiver_templates (artist_id);
create index waiver_templates_state_idx on public.waiver_templates (state);

create trigger waiver_templates_set_updated_at before update on public.waiver_templates
  for each row execute function public.set_updated_at();

-- signed_waivers: append-only legal record. content_snapshot freezes the exact
-- text signed; no updated_at because rows never change after insert.
create table public.signed_waivers (
  id                  uuid primary key default gen_random_uuid(),
  template_id         uuid references public.waiver_templates (id) on delete set null,
  artist_id           uuid not null references public.artist_profiles (id) on delete cascade,
  client_id           uuid references public.profiles (id) on delete set null,
  booking_id          uuid references public.bookings (id) on delete set null,
  session_id          uuid references public.sessions (id) on delete set null,
  signer_name         text not null,
  signer_email        text,
  signer_dob          date,
  state               public.us_state not null,
  signature_type      text,             -- 'drawn' | 'typed'
  signature_data      text,             -- storage path or base64 of signature
  signed_document_url text,             -- rendered PDF in storage
  content_snapshot    text not null,    -- exact waiver text at signing time
  ip_address          inet,
  user_agent          text,
  signed_at           timestamptz not null default now(),
  retention_until     timestamptz,      -- MD/PA retention deadline
  created_at          timestamptz not null default now()
);
create index signed_waivers_artist_id_idx on public.signed_waivers (artist_id);
create index signed_waivers_client_id_idx on public.signed_waivers (client_id);
create index signed_waivers_template_id_idx on public.signed_waivers (template_id);
create index signed_waivers_booking_id_idx on public.signed_waivers (booking_id);
create index signed_waivers_session_id_idx on public.signed_waivers (session_id);

-- Hard immutability: block UPDATE/DELETE for everyone (defense in depth).
create trigger signed_waivers_immutable
  before update or delete on public.signed_waivers
  for each row execute function public.prevent_mutation();

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table public.waiver_templates enable row level security;
alter table public.signed_waivers   enable row level security;

-- waiver_templates: active INKD-global templates are readable by all; artists
-- fully manage their own.
create policy waiver_templates_select on public.waiver_templates
  for select using (
    (artist_id is null and is_active)
    or artist_id = (select public.current_artist_id())
  );
create policy waiver_templates_insert on public.waiver_templates
  for insert with check (artist_id = (select public.current_artist_id()));
create policy waiver_templates_update on public.waiver_templates
  for update using (artist_id = (select public.current_artist_id()))
  with check (artist_id = (select public.current_artist_id()));
create policy waiver_templates_delete on public.waiver_templates
  for delete using (artist_id = (select public.current_artist_id()));

-- signed_waivers: client and artist read; either party may create; no update or
-- delete policy exists (plus the immutability trigger) => permanently immutable.
create policy signed_waivers_select on public.signed_waivers
  for select using (
    client_id = (select auth.uid()) or artist_id = (select public.current_artist_id())
  );
create policy signed_waivers_insert on public.signed_waivers
  for insert with check (
    client_id = (select auth.uid()) or artist_id = (select public.current_artist_id())
  );
