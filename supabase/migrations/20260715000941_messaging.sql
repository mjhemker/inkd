-- Migration: messaging
-- threads (client<->artist) and messages (sender_kind client|artist|agent).
-- messages.agent_action_id is added here as a bare uuid; its FK to agent_actions
-- is attached later in the agent migration (that table does not exist yet).

create table public.threads (
  id                 uuid primary key default gen_random_uuid(),
  artist_id          uuid not null references public.artist_profiles (id) on delete cascade,
  client_id          uuid not null references public.profiles (id) on delete cascade,
  booking_request_id uuid references public.booking_requests (id) on delete set null,
  booking_id         uuid references public.bookings (id) on delete set null,
  subject            text,
  status             public.thread_status not null default 'active',
  last_message_at    timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index threads_artist_id_idx on public.threads (artist_id);
create index threads_client_id_idx on public.threads (client_id);
create index threads_booking_request_id_idx on public.threads (booking_request_id);
create index threads_booking_id_idx on public.threads (booking_id);
create index threads_last_message_at_idx on public.threads (artist_id, last_message_at desc);

create trigger threads_set_updated_at before update on public.threads
  for each row execute function public.set_updated_at();

create table public.messages (
  id                uuid primary key default gen_random_uuid(),
  thread_id         uuid not null references public.threads (id) on delete cascade,
  sender_kind       public.sender_kind not null,
  sender_profile_id uuid references public.profiles (id) on delete set null, -- null when agent-authored
  agent_action_id   uuid,               -- FK added in agent migration
  body              text,
  attachments       jsonb not null default '[]'::jsonb,
  drafted_by_agent  boolean not null default false,
  is_read           boolean not null default false,
  read_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index messages_thread_id_idx on public.messages (thread_id, created_at);
create index messages_sender_profile_id_idx on public.messages (sender_profile_id);
create index messages_agent_action_id_idx on public.messages (agent_action_id);

create trigger messages_set_updated_at before update on public.messages
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table public.threads  enable row level security;
alter table public.messages enable row level security;

-- threads: the two participants can read; either participant can create/update.
create policy threads_select on public.threads
  for select using (
    client_id = (select auth.uid()) or artist_id = (select public.current_artist_id())
  );
create policy threads_insert on public.threads
  for insert with check (
    client_id = (select auth.uid()) or artist_id = (select public.current_artist_id())
  );
create policy threads_update on public.threads
  for update using (
    client_id = (select auth.uid()) or artist_id = (select public.current_artist_id())
  ) with check (
    client_id = (select auth.uid()) or artist_id = (select public.current_artist_id())
  );

-- messages: visible to thread participants; a participant may post as themselves.
-- Agent-authored messages are written server-side (service role bypasses RLS).
create policy messages_select on public.messages
  for select using (
    exists (
      select 1 from public.threads t
      where t.id = messages.thread_id
        and (t.client_id = (select auth.uid()) or t.artist_id = (select public.current_artist_id()))
    )
  );
create policy messages_insert on public.messages
  for insert with check (
    exists (
      select 1 from public.threads t
      where t.id = messages.thread_id
        and (t.client_id = (select auth.uid()) or t.artist_id = (select public.current_artist_id()))
    )
  );
create policy messages_update on public.messages
  for update using (
    exists (
      select 1 from public.threads t
      where t.id = messages.thread_id
        and (t.client_id = (select auth.uid()) or t.artist_id = (select public.current_artist_id()))
    )
  ) with check (
    exists (
      select 1 from public.threads t
      where t.id = messages.thread_id
        and (t.client_id = (select auth.uid()) or t.artist_id = (select public.current_artist_id()))
    )
  );
