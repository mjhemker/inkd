-- Migration: notification_delivery
-- Multi-channel delivery layer on top of the in-app notifications system
-- (SPEC — notifications; founder priority: real push + email). The 7 fan-out
-- triggers in 20260716050000_notification_triggers.sql already write rows into
-- `public.notifications` (the in-app inbox). This migration adds the pieces that
-- ALSO deliver those events as an Expo push + a Resend email, per the user's
-- per-category channel preferences:
--
--   1. device_push_tokens        — a user's registered Expo push tokens (RLS owner-only).
--   2. notification_preferences  — per-category in_app/push/email toggles (RLS owner-only).
--   3. notification_deliveries   — the durable delivery queue (service-role only,
--                                  mirrors agent_jobs). One row per (notification, channel).
--   4. helper functions          — category-for-type map + category email defaults.
--   5. enqueue trigger           — on notifications INSERT, fans a delivery row out
--                                  to push/email per prefs (in-app is the row itself).
--   6. lease RPC                 — FOR UPDATE SKIP LOCKED batch lease for the drainer.
--   7. pg_cron tick              — guarded/no-op-safe minute drain via pg_net -> the
--                                  notify-dispatch edge function (same shape as
--                                  agent-run-drain, 20260716070000).
--
-- Everything is safe to apply BEFORE the edge functions are deployed and BEFORE
-- any Expo/Resend config exists: the cron tick no-ops when the queue is empty or
-- the Vault secrets are absent, and dispatch itself no-ops gracefully with no
-- tokens / no RESEND_API_KEY (see docs/notifications.md).

-- ===========================================================================
-- 1. device_push_tokens — a user's Expo push tokens (one row per device).
-- ===========================================================================
create table public.device_push_tokens (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  expo_push_token text not null unique,
  platform        text not null check (platform in ('ios', 'android', 'web')),
  created_at      timestamptz not null default now(),
  last_seen       timestamptz not null default now()
);
create index device_push_tokens_user_id_idx on public.device_push_tokens (user_id);

alter table public.device_push_tokens enable row level security;

-- Owner-only, strictly. The dispatch edge function reads these with the service
-- role (bypasses RLS). Registration (including the device-handoff case, where a
-- phone that already has a token row logs into a different account) goes through
-- the SECURITY DEFINER `register_push_token` RPC below rather than a permissive
-- `using (true)` UPDATE policy — so a session can only ever touch its OWN rows.
create policy device_push_tokens_select on public.device_push_tokens
  for select using (user_id = (select auth.uid()));
create policy device_push_tokens_insert on public.device_push_tokens
  for insert with check (user_id = (select auth.uid()));
create policy device_push_tokens_update on public.device_push_tokens
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy device_push_tokens_delete on public.device_push_tokens
  for delete using (user_id = (select auth.uid()));

-- Atomic register/claim of an Expo token for the calling user. Upserts on the
-- unique token, reassigning ownership to the caller if the same physical device
-- previously registered under another account (device handoff / reinstall). Runs
-- as SECURITY DEFINER so the reassignment does not need a permissive UPDATE
-- policy; it always writes `auth.uid()` as the owner, so a caller can only ever
-- claim a token FOR themselves. Returns the token row id.
create or replace function public.register_push_token(p_token text, p_platform text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_token is null or p_token = '' then
    raise exception 'push token required';
  end if;
  if p_platform not in ('ios', 'android', 'web') then
    raise exception 'invalid platform: %', p_platform;
  end if;

  insert into public.device_push_tokens (user_id, expo_push_token, platform)
  values (v_uid, p_token, p_platform)
  on conflict (expo_push_token) do update
    set user_id = v_uid,
        platform = excluded.platform,
        last_seen = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.register_push_token(text, text) from public;
revoke execute on function public.register_push_token(text, text) from anon;
grant execute on function public.register_push_token(text, text) to authenticated;

-- ===========================================================================
-- 2. notification_preferences — per-category channel toggles. One row per
--    (user, category); a MISSING row means "use the category default" (see the
--    enqueue trigger + notification_category_default_email below), so we never
--    have to backfill a row for every user × category up front.
-- ===========================================================================
create table public.notification_preferences (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  category   text not null check (category in (
    'booking_request', 'booking_accepted', 'booking_declined', 'session_reminder',
    'deposit', 'message', 'review', 'review_response', 'ai_approval', 'aftercare'
  )),
  in_app     boolean not null default true,
  push       boolean not null default true,
  email      boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

alter table public.notification_preferences enable row level security;

create policy notification_preferences_select on public.notification_preferences
  for select using (user_id = (select auth.uid()));
create policy notification_preferences_insert on public.notification_preferences
  for insert with check (user_id = (select auth.uid()));
create policy notification_preferences_update on public.notification_preferences
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy notification_preferences_delete on public.notification_preferences
  for delete using (user_id = (select auth.uid()));

create trigger notification_preferences_set_updated_at before update
  on public.notification_preferences
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- 3. notification_deliveries — the durable multi-channel delivery queue. One
--    row per (notification, channel). Pure server-side infrastructure: only the
--    service role (which bypasses RLS) ever touches it, exactly like agent_jobs
--    / stripe_events. RLS is enabled with NO policies by design (the resulting
--    rls_enabled_no_policy advisor INFO is intentional).
-- ===========================================================================
create table public.notification_deliveries (
  id              uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  channel         text not null check (channel in ('push', 'email')),
  status          text not null default 'pending'
                    check (status in ('pending', 'running', 'sent', 'failed', 'skipped')),
  attempts        int  not null default 0,
  max_attempts    int  not null default 3,
  last_error      text,
  provider_ref    text, -- Expo ticket id / Resend message id, for receipt lookup
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  sent_at         timestamptz
);
-- Fast "next pending" scan for the drainer.
create index notification_deliveries_pending_idx on public.notification_deliveries (created_at)
  where status = 'pending';
-- Cover the FKs so an ON DELETE CASCADE from notifications / profiles doesn't
-- seq-scan the queue.
create index notification_deliveries_notification_id_idx
  on public.notification_deliveries (notification_id);
create index notification_deliveries_user_id_idx
  on public.notification_deliveries (user_id, created_at desc);

create trigger notification_deliveries_set_updated_at before update
  on public.notification_deliveries
  for each row execute function public.set_updated_at();

alter table public.notification_deliveries enable row level security;

-- ===========================================================================
-- 4. Helper functions — the canonical notification-type -> preference-category
--    map and the per-category email default. Kept in SQL (mirrored in
--    packages/core/src/notifications/categories.ts) so the enqueue trigger and
--    the client resolve categories identically. IMMUTABLE + no table access, so
--    safe to inline in the trigger.
-- ===========================================================================
create or replace function public.notification_category_for_type(p_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_type
    when 'booking_request_new'      then 'booking_request'
    when 'booking_request_accepted' then 'booking_accepted'
    when 'booking_request_declined' then 'booking_declined'
    when 'session_scheduled'        then 'session_reminder'
    when 'payment_deposit_received' then 'deposit'
    when 'message_new'              then 'message'
    when 'review_new'               then 'review'
    when 'review_response'          then 'review_response'
    when 'ai_approval_needed'       then 'ai_approval'
    when 'aftercare_check_in'       then 'aftercare'
    else null
  end;
$$;

-- Category email default: ON only for high-value transactional events (booking
-- lifecycle + money + a scheduled session), OFF for social/noisy categories.
-- Push + in-app default ON for every category (handled inline in the enqueue
-- trigger). Founder priority: "email for high-value only".
create or replace function public.notification_category_default_email(p_category text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_category in (
    'booking_request', 'booking_accepted', 'booking_declined',
    'session_reminder', 'deposit'
  );
$$;

-- ===========================================================================
-- 5. Enqueue trigger — on a new notifications row, fan out a delivery row per
--    enabled channel. in-app is the notification row itself (no delivery row).
--    A missing preference row falls back to the category defaults. Push is only
--    enqueued when the user actually has a device token; email only when the
--    profile has an address — so the queue never fills with rows that can only
--    ever be skipped. SECURITY DEFINER + pinned empty search_path, mirroring the
--    notification fan-out triggers.
-- ===========================================================================
create or replace function public.enqueue_notification_deliveries()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category      text;
  v_push_pref     boolean;
  v_email_pref    boolean;
  v_push_enabled  boolean;
  v_email_enabled boolean;
  v_has_token     boolean;
  v_has_email     boolean;
begin
  v_category := public.notification_category_for_type(new.type);

  -- Unknown/uncategorized notification types stay in-app only.
  if v_category is null then
    return new;
  end if;

  select np.push, np.email
    into v_push_pref, v_email_pref
  from public.notification_preferences np
  where np.user_id = new.profile_id and np.category = v_category;

  -- Missing row -> category default (push ON, email per high-value default).
  v_push_enabled  := coalesce(v_push_pref, true);
  v_email_enabled := coalesce(v_email_pref, public.notification_category_default_email(v_category));

  if v_push_enabled then
    select exists (
      select 1 from public.device_push_tokens t where t.user_id = new.profile_id
    ) into v_has_token;
    if v_has_token then
      insert into public.notification_deliveries (notification_id, user_id, channel)
      values (new.id, new.profile_id, 'push');
    end if;
  end if;

  if v_email_enabled then
    select exists (
      select 1 from public.profiles p
      where p.id = new.profile_id and p.email is not null and p.email <> ''
    ) into v_has_email;
    if v_has_email then
      insert into public.notification_deliveries (notification_id, user_id, channel)
      values (new.id, new.profile_id, 'email');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enqueue_notification_deliveries on public.notifications;
create trigger trg_enqueue_notification_deliveries
  after insert on public.notifications
  for each row execute function public.enqueue_notification_deliveries();

-- ===========================================================================
-- 6. Batch lease for the dispatch runner. FOR UPDATE SKIP LOCKED so concurrent
--    drains never grab the same delivery; each leased row moves pending ->
--    running and burns one attempt. SECURITY DEFINER, service_role only — same
--    shape as agent_jobs_lease (20260716070000).
-- ===========================================================================
create or replace function public.notification_deliveries_lease(p_limit int default 20)
returns setof public.notification_deliveries
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.notification_deliveries d
     set status = 'running',
         attempts = d.attempts + 1,
         updated_at = now()
   where d.id in (
     select c.id
     from public.notification_deliveries c
     where c.status = 'pending' and c.attempts < c.max_attempts
     order by c.created_at
     limit greatest(1, coalesce(p_limit, 20))
     for update skip locked
   )
  returning d.*;
end;
$$;

revoke execute on function public.notification_deliveries_lease(int) from public;
revoke execute on function public.notification_deliveries_lease(int) from anon;
revoke execute on function public.notification_deliveries_lease(int) from authenticated;
grant execute on function public.notification_deliveries_lease(int) to service_role;

-- ===========================================================================
-- Hardening: the enqueue trigger is a trigger-only SECURITY DEFINER function —
-- never callable directly via PostgREST RPC (mirrors the notification triggers
-- migration). The two IMMUTABLE helpers are pure and safe to leave callable.
-- ===========================================================================
revoke execute on function public.enqueue_notification_deliveries() from public;
revoke execute on function public.enqueue_notification_deliveries() from anon;
revoke execute on function public.enqueue_notification_deliveries() from authenticated;

-- ===========================================================================
-- 7. Scheduled drain via pg_cron. The minute tick reads the notify-dispatch URL
--    + the shared runner bearer from Vault and POSTs to the edge function via
--    pg_net. GUARDED: no-ops when the queue is empty OR when the Vault secrets
--    are absent — safe to apply now, before the function is deployed and before
--    any secret exists. When Michael deploys notify-dispatch + sets the two
--    Vault secrets (notify_dispatch_url + the existing agent_runner_service_key)
--    the same cron starts draining, no code change. See docs/notifications.md.
-- ===========================================================================
create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function public.notify_dispatch_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url     text;
  v_key     text;
  v_pending int;
begin
  select count(*)
    into v_pending
  from public.notification_deliveries
  where status = 'pending' and attempts < max_attempts;

  if coalesce(v_pending, 0) = 0 then
    return;
  end if;

  -- Config lives in Vault; absent until deploy -> no-op (never errors the cron).
  begin
    select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'notify_dispatch_url';
    select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'agent_runner_service_key';
  exception when others then
    return;
  end;

  if v_url is null or v_key is null then
    return;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object('source', 'pg_cron')
  );
end;
$$;

revoke execute on function public.notify_dispatch_tick() from public;
revoke execute on function public.notify_dispatch_tick() from anon;
revoke execute on function public.notify_dispatch_tick() from authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'notify-dispatch-drain') then
      perform cron.unschedule('notify-dispatch-drain');
    end if;
    perform cron.schedule('notify-dispatch-drain', '* * * * *', 'select public.notify_dispatch_tick();');
  end if;
end $$;
