-- Migration: agent
-- agent_settings (autonomy + per-action-class overrides), agent_actions (audit
-- log, artist-only visibility), agent_playbooks (per-artist knowledge base).
-- Also attaches the deferred messages.agent_action_id foreign key.

-- ---------------------------------------------------------------------------
-- agent_settings: one row per artist; drives the deterministic policy engine.
-- ---------------------------------------------------------------------------
create table public.agent_settings (
  id                       uuid primary key default gen_random_uuid(),
  artist_id                uuid not null unique references public.artist_profiles (id) on delete cascade,
  autonomy                 public.agent_autonomy not null default 'draft_only',
  action_class_overrides   jsonb not null default '{}'::jsonb,
  front_desk_enabled       boolean not null default true,
  booking_manager_enabled  boolean not null default true,
  studio_manager_enabled   boolean not null default false,
  growth_advisor_enabled   boolean not null default false,
  client_disclosure_enabled boolean not null default false,
  escalation_keywords      text[] not null default '{}',
  quote_min_cents          int,
  quote_max_cents          int,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index agent_settings_artist_id_idx on public.agent_settings (artist_id);

create trigger agent_settings_set_updated_at before update on public.agent_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- agent_actions: append-heavy audit log of every agent tool call. tier is the
-- deterministic policy tier (1/2/3); status tracks the approval lifecycle.
-- ---------------------------------------------------------------------------
create table public.agent_actions (
  id                 uuid primary key default gen_random_uuid(),
  artist_id          uuid not null references public.artist_profiles (id) on delete cascade,
  agent_role         public.agent_role,
  thread_id          uuid references public.threads (id) on delete set null,
  booking_request_id uuid references public.booking_requests (id) on delete set null,
  booking_id         uuid references public.bookings (id) on delete set null,
  session_id         uuid references public.sessions (id) on delete set null,
  client_id          uuid references public.profiles (id) on delete set null,
  action_type        text not null,
  tier               smallint not null check (tier between 1 and 3),
  status             public.agent_action_status not null default 'proposed',
  reasoning_summary  text,
  data_consulted     jsonb not null default '[]'::jsonb,
  payload            jsonb not null default '{}'::jsonb,
  result             jsonb,
  approved_by        uuid references public.profiles (id) on delete set null,
  proposed_at        timestamptz not null default now(),
  approved_at        timestamptz,
  executed_at        timestamptz,
  rejected_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index agent_actions_artist_id_idx on public.agent_actions (artist_id, created_at desc);
create index agent_actions_thread_id_idx on public.agent_actions (thread_id);
create index agent_actions_booking_request_id_idx on public.agent_actions (booking_request_id);
create index agent_actions_booking_id_idx on public.agent_actions (booking_id);
create index agent_actions_session_id_idx on public.agent_actions (session_id);
create index agent_actions_client_id_idx on public.agent_actions (client_id);
create index agent_actions_approved_by_idx on public.agent_actions (approved_by);
create index agent_actions_status_idx on public.agent_actions (artist_id, status);

create trigger agent_actions_set_updated_at before update on public.agent_actions
  for each row execute function public.set_updated_at();

-- Now that agent_actions exists, wire up the messages FK deferred in migration 8.
alter table public.messages
  add constraint messages_agent_action_id_fkey
  foreign key (agent_action_id) references public.agent_actions (id) on delete set null;

-- ---------------------------------------------------------------------------
-- agent_playbooks: per-artist editable knowledge base entries agents cite.
-- ---------------------------------------------------------------------------
create table public.agent_playbooks (
  id         uuid primary key default gen_random_uuid(),
  artist_id  uuid not null references public.artist_profiles (id) on delete cascade,
  title      text,
  category   public.playbook_category not null default 'other',
  content    text not null,
  source     public.playbook_source not null default 'manual',
  is_active  boolean not null default true,
  priority   int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index agent_playbooks_artist_id_idx on public.agent_playbooks (artist_id, priority desc);

create trigger agent_playbooks_set_updated_at before update on public.agent_playbooks
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- RLS: agent internals are strictly artist-only (no client visibility).
-- ===========================================================================
alter table public.agent_settings  enable row level security;
alter table public.agent_actions   enable row level security;
alter table public.agent_playbooks enable row level security;

create policy agent_settings_select on public.agent_settings
  for select using (artist_id = (select public.current_artist_id()));
create policy agent_settings_insert on public.agent_settings
  for insert with check (artist_id = (select public.current_artist_id()));
create policy agent_settings_update on public.agent_settings
  for update using (artist_id = (select public.current_artist_id()))
  with check (artist_id = (select public.current_artist_id()));
create policy agent_settings_delete on public.agent_settings
  for delete using (artist_id = (select public.current_artist_id()));

-- agent_actions: visible ONLY to the owning artist. Runtime writes use the
-- service role (bypasses RLS); the artist approves/rejects via update.
create policy agent_actions_select on public.agent_actions
  for select using (artist_id = (select public.current_artist_id()));
create policy agent_actions_insert on public.agent_actions
  for insert with check (artist_id = (select public.current_artist_id()));
create policy agent_actions_update on public.agent_actions
  for update using (artist_id = (select public.current_artist_id()))
  with check (artist_id = (select public.current_artist_id()));

create policy agent_playbooks_select on public.agent_playbooks
  for select using (artist_id = (select public.current_artist_id()));
create policy agent_playbooks_insert on public.agent_playbooks
  for insert with check (artist_id = (select public.current_artist_id()));
create policy agent_playbooks_update on public.agent_playbooks
  for update using (artist_id = (select public.current_artist_id()))
  with check (artist_id = (select public.current_artist_id()));
create policy agent_playbooks_delete on public.agent_playbooks
  for delete using (artist_id = (select public.current_artist_id()));
