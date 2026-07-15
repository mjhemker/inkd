-- Migration: studio_manager_scheduled_jobs_and_plan
-- Two additive pieces (SPEC §5 Studio Manager, §0 monetization):
--
-- 1. Scheduled Studio Manager jobs — deterministic templates, NO LLM required
--    (deposit_chase, rebook_nudge, weekly_digest). Reuses the existing
--    agent_jobs queue + agent_jobs_lease RPC (docs/agents-runtime.md); adds a
--    `job_kind` discriminator + a `scheduled_scan` trigger_kind, and a daily
--    pg_cron enqueue + drain-tick, guarded/no-op-safe exactly like the
--    existing agent-run-drain minute tick (20260716070000). Also adds
--    agent_actions.dedupe_key so the scan handlers can be idempotent
--    (`deposit_chase:<session_id>:<week>` etc.) without a full upsert dance.
--
-- 2. Premium tier scaffolding — artist_profiles.plan ('free' | 'pro'), no
--    enforcement yet (pilot artists get everything free; see api/plan.ts).

-- ===========================================================================
-- 1a. agent_jobs: job_kind discriminator + scheduled_scan trigger_kind.
-- ===========================================================================
alter table public.agent_jobs
  add column if not exists job_kind text
    check (job_kind is null or job_kind in ('deposit_chase', 'rebook_nudge', 'weekly_digest'));

alter table public.agent_jobs drop constraint if exists agent_jobs_trigger_kind_check;
alter table public.agent_jobs
  add constraint agent_jobs_trigger_kind_check
    check (trigger_kind in ('message', 'booking_request', 'scheduled_scan'));

create index if not exists agent_jobs_job_kind_idx on public.agent_jobs (job_kind)
  where job_kind is not null;

-- ===========================================================================
-- 1b. agent_actions.dedupe_key — app-level idempotency for the scan handlers
--     (mirrors agent_jobs.dedupe_key). Nullable: the message/booking_request
--     runtime path (agent-run) never sets it; ON CONFLICT DO NOTHING there is
--     unnecessary since dedup already happens at the agent_jobs layer.
-- ===========================================================================
alter table public.agent_actions
  add column if not exists dedupe_key text;

create unique index if not exists agent_actions_dedupe_key_key
  on public.agent_actions (dedupe_key)
  where dedupe_key is not null;

-- ===========================================================================
-- 1c. Daily enqueue: one 'deposit_chase' + 'rebook_nudge' scan job per artist
--     with Studio Manager enabled and AI not fully off (both jobs draft
--     client-facing text — they only ever propose, never auto-send, but the
--     draft itself is client-facing prep, so respect the same autonomy gate
--     the message/booking_request triggers use). 'weekly_digest' is an
--     internal-only rollup (like note.log, SPEC §5), so it only requires
--     Studio Manager to be enabled, and only enqueues on Mondays.
--     dedupe_key makes re-running the enqueue same-day/same-week a no-op.
-- ===========================================================================
create or replace function public.agent_scheduled_enqueue()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today text := to_char(now(), 'YYYY-MM-DD');
  v_week  text := to_char(now(), 'IYYY-"W"IW');
  v_is_monday boolean := extract(isodow from now()) = 1;
begin
  -- deposit_chase + rebook_nudge: Studio Manager on AND autonomy <> no_ai.
  insert into public.agent_jobs (artist_id, trigger_kind, trigger_id, job_kind, dedupe_key)
  select ap.id, 'scheduled_scan', ap.id, 'deposit_chase',
         'scheduled:deposit_chase:' || ap.id::text || ':' || v_today
  from public.artist_profiles ap
  join public.agent_settings s on s.artist_id = ap.id
  where s.studio_manager_enabled and s.autonomy <> 'no_ai'
  on conflict (dedupe_key) do nothing;

  insert into public.agent_jobs (artist_id, trigger_kind, trigger_id, job_kind, dedupe_key)
  select ap.id, 'scheduled_scan', ap.id, 'rebook_nudge',
         'scheduled:rebook_nudge:' || ap.id::text || ':' || v_today
  from public.artist_profiles ap
  join public.agent_settings s on s.artist_id = ap.id
  where s.studio_manager_enabled and s.autonomy <> 'no_ai'
  on conflict (dedupe_key) do nothing;

  -- weekly_digest: internal-only, Mondays, Studio Manager on (no autonomy gate
  -- — nothing client-facing, mirrors note.log's "always executes" rule).
  if v_is_monday then
    insert into public.agent_jobs (artist_id, trigger_kind, trigger_id, job_kind, dedupe_key)
    select ap.id, 'scheduled_scan', ap.id, 'weekly_digest',
           'scheduled:weekly_digest:' || ap.id::text || ':' || v_week
    from public.artist_profiles ap
    join public.agent_settings s on s.artist_id = ap.id
    where s.studio_manager_enabled
    on conflict (dedupe_key) do nothing;
  end if;
end;
$$;

revoke execute on function public.agent_scheduled_enqueue() from public;
revoke execute on function public.agent_scheduled_enqueue() from anon;
revoke execute on function public.agent_scheduled_enqueue() from authenticated;

-- ===========================================================================
-- 1d. Scheduled tick: guarded exactly like agent_run_tick() (20260716070000)
--     — no-ops when the queue is empty OR the Vault secrets are absent, so
--     it's safe to apply now, before `agent-scheduled` is deployed. Reuses
--     the same 'agent_runner_service_key' Vault secret as the bearer (it's
--     just the project's service-role key); a distinct URL secret
--     ('agent_scheduled_url') points at the sibling function.
-- ===========================================================================
create or replace function public.agent_scheduled_tick()
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
  from public.agent_jobs
  where status = 'pending' and attempts < max_attempts and trigger_kind = 'scheduled_scan';

  if coalesce(v_pending, 0) = 0 then
    return;
  end if;

  begin
    select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'agent_scheduled_url';
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

revoke execute on function public.agent_scheduled_tick() from public;
revoke execute on function public.agent_scheduled_tick() from anon;
revoke execute on function public.agent_scheduled_tick() from authenticated;

-- Daily cron: enqueue today's scan jobs, then wake the drainer (guarded/no-op
-- exactly like agent-run-drain until both the function is deployed and the
-- Vault secrets are set — see docs/agents-runtime.md).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'agent-scheduled-drain') then
      perform cron.unschedule('agent-scheduled-drain');
    end if;
    perform cron.schedule(
      'agent-scheduled-drain',
      '0 13 * * *', -- once a day, 13:00 UTC
      'select public.agent_scheduled_enqueue(); select public.agent_scheduled_tick();'
    );
  end if;
end $$;

-- ===========================================================================
-- 2. Premium tier scaffolding (SPEC §0: "subscription tiers later add premium
--    ops/AI features and remove client booking fees"). No enforcement yet —
--    pilot artists get everything free (api/plan.ts documents the mapping).
-- ===========================================================================
alter table public.artist_profiles
  add column if not exists plan text not null default 'free'
    check (plan in ('free', 'pro'));

create index if not exists artist_profiles_plan_idx on public.artist_profiles (plan);
