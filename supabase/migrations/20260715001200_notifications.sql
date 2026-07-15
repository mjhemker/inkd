-- Migration: notifications
-- Per-recipient notifications. `type` is free text (extensible without enum
-- churn); data holds a typed payload for deep-linking.

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type       text not null,
  title      text,
  body       text,
  data       jsonb not null default '{}'::jsonb,
  action_url text,
  is_read    boolean not null default false,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_profile_id_idx on public.notifications (profile_id, created_at desc);
create index notifications_unread_idx on public.notifications (profile_id) where not is_read;

alter table public.notifications enable row level security;

-- Recipient-only access. System writes use the service role (bypasses RLS).
create policy notifications_select on public.notifications
  for select using (profile_id = (select auth.uid()));
create policy notifications_insert on public.notifications
  for insert with check (profile_id = (select auth.uid()));
create policy notifications_update on public.notifications
  for update using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));
create policy notifications_delete on public.notifications
  for delete using (profile_id = (select auth.uid()));
