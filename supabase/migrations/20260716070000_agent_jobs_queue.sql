-- Migration: agent_jobs_queue
-- The event-driven work queue for the INKD agent runtime (SPEC §5). Inbound
-- client events (a new message on a thread, a new booking request) are enqueued
-- as `agent_jobs` rows by hardened SECURITY DEFINER triggers, gated on the
-- artist's autonomy (skip entirely when they've turned AI off). The `agent-run`
-- edge function drains the queue. Also attaches the deferred
-- `agent_actions.executed_message_id` column the trust UI + approval path need.
--
-- Hardening mirrors 20260716050000_notification_triggers.sql: every trigger
-- function is SECURITY DEFINER with a pinned empty search_path and fully
-- schema-qualified references, and EXECUTE is revoked from anon / authenticated /
-- public so it can never be invoked directly over PostgREST RPC — the functions
-- only ever run as trigger bodies (or, for the cron tick, as the cron worker).

-- ---------------------------------------------------------------------------
-- 0. agent_actions += executed_message_id  (deferred from the agent migration).
--    Set when a proposed/auto action actually posts a client-facing message, so
--    the audit row links to the message it produced. Nullable: internal actions
--    (note.log) and still-proposed actions have none.
-- ---------------------------------------------------------------------------
alter table public.agent_actions
  add column if not exists executed_message_id uuid
    references public.messages (id) on delete set null;
create index if not exists agent_actions_executed_message_id_idx
  on public.agent_actions (executed_message_id);

-- ---------------------------------------------------------------------------
-- 1. agent_jobs: the durable work queue. One row per triggering event; the
--    runner leases pending rows (status -> running), processes, and marks
--    done/failed/skipped. `dedupe_key` makes enqueue idempotent under retries
--    and double-fires. `attempts` is capped at `max_attempts` (default 3).
-- ---------------------------------------------------------------------------
create table public.agent_jobs (
  id                 uuid primary key default gen_random_uuid(),
  artist_id          uuid not null references public.artist_profiles (id) on delete cascade,
  trigger_kind       text not null check (trigger_kind in ('message', 'booking_request')),
  trigger_id         uuid not null,
  thread_id          uuid references public.threads (id) on delete cascade,
  booking_request_id uuid references public.booking_requests (id) on delete cascade,
  status             text not null default 'pending'
                       check (status in ('pending', 'running', 'done', 'failed', 'skipped')),
  attempts           int  not null default 0,
  max_attempts       int  not null default 3,
  dedupe_key         text not null,
  last_error         text,
  scheduled_at       timestamptz not null default now(),
  leased_at          timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
-- Idempotent enqueue: one job per triggering event.
create unique index agent_jobs_dedupe_key_key on public.agent_jobs (dedupe_key);
-- Fast "next pending" scan for the drainer.
create index agent_jobs_pending_idx on public.agent_jobs (scheduled_at)
  where status = 'pending';
create index agent_jobs_artist_id_idx on public.agent_jobs (artist_id, created_at desc);
-- Cover the FKs so an ON DELETE CASCADE from threads / booking_requests doesn't
-- seq-scan the queue.
create index agent_jobs_thread_id_idx on public.agent_jobs (thread_id)
  where thread_id is not null;
create index agent_jobs_booking_request_id_idx on public.agent_jobs (booking_request_id)
  where booking_request_id is not null;

create trigger agent_jobs_set_updated_at before update on public.agent_jobs
  for each row execute function public.set_updated_at();

-- RLS: default-deny. The queue is pure server-side infrastructure — only the
-- service role (which bypasses RLS) ever touches it, exactly like stripe_events.
-- No policies by design; the resulting `rls_enabled_no_policy` advisor INFO is
-- intentional (agent internals are never exposed to a browser session).
alter table public.agent_jobs enable row level security;

-- ---------------------------------------------------------------------------
-- 1b. Atomic batch lease for the runner. FOR UPDATE SKIP LOCKED lets concurrent
--     drains never grab the same job; each leased row moves pending -> running
--     and burns one attempt (a later failure re-queues it until max_attempts).
--     SECURITY DEFINER + granted to service_role only (the runner authenticates
--     with the service key); never reachable from a browser session.
-- ---------------------------------------------------------------------------
create or replace function public.agent_jobs_lease(p_limit int default 10)
returns setof public.agent_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.agent_jobs j
     set status = 'running',
         attempts = j.attempts + 1,
         leased_at = now(),
         updated_at = now()
   where j.id in (
     select c.id
     from public.agent_jobs c
     where c.status = 'pending' and c.attempts < c.max_attempts
     order by c.scheduled_at
     limit greatest(1, coalesce(p_limit, 10))
     for update skip locked
   )
  returning j.*;
end;
$$;

revoke execute on function public.agent_jobs_lease(int) from public;
revoke execute on function public.agent_jobs_lease(int) from anon;
revoke execute on function public.agent_jobs_lease(int) from authenticated;
grant execute on function public.agent_jobs_lease(int) to service_role;

-- ---------------------------------------------------------------------------
-- 2a. Enqueue on a new inbound client message. Fires only when the message's
--     sender is the thread's client AND the artist has not turned AI off
--     (autonomy <> 'no_ai'; a missing agent_settings row defaults to draft_only,
--     so we still enqueue). Agent- and artist-authored messages never enqueue.
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_agent_job_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
  v_artist_id uuid;
  v_autonomy  public.agent_autonomy;
begin
  if new.sender_kind <> 'client' then
    return new;
  end if;

  select t.client_id, t.artist_id
    into v_client_id, v_artist_id
  from public.threads t
  where t.id = new.thread_id;

  if v_client_id is null then
    return new;
  end if;

  -- Sender must actually be the thread's client (defensive; sender_kind alone
  -- could be spoofed by a mislabeled insert).
  if new.sender_profile_id is distinct from v_client_id then
    return new;
  end if;

  select s.autonomy
    into v_autonomy
  from public.agent_settings s
  where s.artist_id = v_artist_id;

  -- Gate: skip enqueue when the artist has explicitly disabled AI.
  if v_autonomy = 'no_ai' then
    return new;
  end if;

  insert into public.agent_jobs (artist_id, trigger_kind, trigger_id, thread_id, dedupe_key)
  values (v_artist_id, 'message', new.id, new.thread_id, 'message:' || new.id::text)
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_enqueue_agent_job_on_message on public.messages;
create trigger trg_enqueue_agent_job_on_message
  after insert on public.messages
  for each row execute function public.enqueue_agent_job_on_message();

-- ---------------------------------------------------------------------------
-- 2b. Enqueue on a new booking request. Same autonomy gate.
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_agent_job_on_booking_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_autonomy public.agent_autonomy;
begin
  select s.autonomy
    into v_autonomy
  from public.agent_settings s
  where s.artist_id = new.artist_id;

  if v_autonomy = 'no_ai' then
    return new;
  end if;

  insert into public.agent_jobs
    (artist_id, trigger_kind, trigger_id, booking_request_id, dedupe_key)
  values
    (new.artist_id, 'booking_request', new.id, new.id, 'booking_request:' || new.id::text)
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_enqueue_agent_job_on_booking_request on public.booking_requests;
create trigger trg_enqueue_agent_job_on_booking_request
  after insert on public.booking_requests
  for each row execute function public.enqueue_agent_job_on_booking_request();

-- ---------------------------------------------------------------------------
-- Hardening: these are trigger-only SECURITY DEFINER functions — never callable
-- directly via PostgREST RPC (mirrors the notification triggers migration).
-- ---------------------------------------------------------------------------
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'enqueue_agent_job_on_message()',
    'enqueue_agent_job_on_booking_request()'
  ]
  loop
    execute format('revoke execute on function public.%s from public', fn);
    execute format('revoke execute on function public.%s from anon', fn);
    execute format('revoke execute on function public.%s from authenticated', fn);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Scheduled drain via pg_cron (available on this project). The tick reads the
--    runner URL + a service key from Vault and POSTs to the `agent-run` edge
--    function via pg_net. Both are GUARDED: the tick no-ops when the queue is
--    empty OR when the Vault secrets are absent — so this is safe to apply now,
--    BEFORE the function is deployed and BEFORE any key exists. Nothing fires
--    against a missing endpoint. When Michael deploys + sets the two secrets
--    (see docs/agents-runtime.md) the same cron starts draining, no code change.
--
--    If pg_cron were unavailable, the manual/scheduled-invocation path (a plain
--    authenticated POST to the function, or an external scheduler) is documented
--    in docs/agents-runtime.md instead.
-- ---------------------------------------------------------------------------
create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function public.agent_run_tick()
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
  -- Nothing queued -> nothing to wake the runner for.
  select count(*)
    into v_pending
  from public.agent_jobs
  where status = 'pending' and attempts < max_attempts;

  if coalesce(v_pending, 0) = 0 then
    return;
  end if;

  -- Config lives in Vault; absent until deploy -> no-op (never errors the cron).
  begin
    select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'agent_runner_url';
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

revoke execute on function public.agent_run_tick() from public;
revoke execute on function public.agent_run_tick() from anon;
revoke execute on function public.agent_run_tick() from authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'agent-run-drain') then
      perform cron.unschedule('agent-run-drain');
    end if;
    perform cron.schedule('agent-run-drain', '* * * * *', 'select public.agent_run_tick();');
  end if;
end $$;
