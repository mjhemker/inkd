-- Migration: aftercare
-- Aftercare healing timeline + healed-photo loop (Wave 2, founder spec).
--
-- Founder cadence: check-ins at 3 DAYS, 1 WEEK, 3 WEEKS after a session
-- completes (deliberately NOT 1/3/7). Each check-in prompts the client for a
-- healing rating, an optional note, and an OPTIONAL healed photo. Healed photos
-- are SENSITIVE: they live in a private, artist+client-only bucket and only
-- ever become a public portfolio piece after the client explicitly opts in
-- (consent_to_share) AND the artist shares it.
--
-- What this adds:
--   1. enums aftercare_checkin_kind (day_3|week_1|week_3) + aftercare_checkin_status.
--   2. artist_profiles.aftercare_enabled — a simple always-on-by-default toggle
--      (aftercare is tier-1/low-risk; decoupled from the agent autonomy slider so
--      every artist gets it unless they turn it off in settings).
--   3. aftercare_checkins — one row per (session, kind). RLS: client + owning
--      artist only.
--   4. schedule trigger — on a session flipping to COMPLETED, insert the 3
--      check-ins at +3d / +7d / +21d (idempotent, gated on aftercare_enabled).
--   5. notify-artist-on-response trigger — when the client submits a response,
--      the artist gets an in-app notification.
--   6. aftercare-photos storage bucket — private; client owns their folder, the
--      linked artist may READ. The healed photo only enters the PUBLIC media
--      bucket when the artist runs the share-to-portfolio flow (app-side).
--   7. agent_scheduled_tick() replaced so the existing daily cron ALSO wakes the
--      agent-scheduled edge function when aftercare check-ins are due — even if
--      no Studio Manager scan jobs are queued. Delivery itself happens in the
--      edge function (supabase/functions/agent-scheduled), which scans due
--      check-ins directly and inserts an 'aftercare_check_in' notification
--      (already mapped to the 'aftercare' delivery category in Wave 1).

-- ===========================================================================
-- 1. Enums.
-- ===========================================================================
do $$ begin
  create type public.aftercare_checkin_kind as enum ('day_3', 'week_1', 'week_3');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.aftercare_checkin_status as enum ('pending', 'sent', 'responded', 'skipped');
exception when duplicate_object then null; end $$;

-- ===========================================================================
-- 2. artist_profiles.aftercare_enabled — always-on-by-default toggle.
-- ===========================================================================
alter table public.artist_profiles
  add column if not exists aftercare_enabled boolean not null default true;

-- ===========================================================================
-- 3. aftercare_checkins — the healing timeline.
--    booking_id is denormalized (nullable) so the week_3 review-nudge and the
--    healed-photo -> portfolio attribution can find the booking cheaply.
-- ===========================================================================
create table public.aftercare_checkins (
  id                           uuid primary key default gen_random_uuid(),
  session_id                   uuid not null references public.sessions (id) on delete cascade,
  booking_id                   uuid references public.bookings (id) on delete set null,
  client_id                    uuid not null references public.profiles (id) on delete cascade,
  artist_id                    uuid not null references public.artist_profiles (id) on delete cascade,
  scheduled_for                timestamptz not null,
  kind                         public.aftercare_checkin_kind not null,
  status                       public.aftercare_checkin_status not null default 'pending',
  sent_at                      timestamptz,
  responded_at                 timestamptz,
  healing_rating               smallint check (healing_rating is null or healing_rating between 1 and 5),
  note                         text,
  photo_path                   text,
  consent_to_share             boolean not null default false,
  shared_as_portfolio_piece_id uuid references public.portfolio_pieces (id) on delete set null,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now(),
  -- One check-in per (session, kind): makes the schedule trigger idempotent.
  unique (session_id, kind)
);
create index aftercare_checkins_session_id_idx on public.aftercare_checkins (session_id);
create index aftercare_checkins_booking_id_idx on public.aftercare_checkins (booking_id);
create index aftercare_checkins_client_id_idx on public.aftercare_checkins (client_id);
create index aftercare_checkins_artist_id_idx on public.aftercare_checkins (artist_id, created_at desc);
-- The due-finder scan: pending rows whose scheduled_for has passed.
create index aftercare_checkins_due_idx on public.aftercare_checkins (scheduled_for)
  where status = 'pending';
-- Cover the portfolio FK so an ON DELETE SET NULL doesn't seq-scan.
create index aftercare_checkins_portfolio_piece_id_idx
  on public.aftercare_checkins (shared_as_portfolio_piece_id)
  where shared_as_portfolio_piece_id is not null;

create trigger aftercare_checkins_set_updated_at before update on public.aftercare_checkins
  for each row execute function public.set_updated_at();

alter table public.aftercare_checkins enable row level security;

-- Read: client + owning artist only. A photo/note is never visible to anyone
-- else while it lives here (it's public only once mirrored into a portfolio piece).
create policy aftercare_checkins_select on public.aftercare_checkins
  for select using (
    client_id = (select auth.uid()) or artist_id = (select public.current_artist_id())
  );

-- Insert: normally done by the schedule trigger (SECURITY DEFINER, bypasses
-- RLS). This policy lets the owning artist backfill/create a check-in manually.
create policy aftercare_checkins_insert on public.aftercare_checkins
  for insert with check (artist_id = (select public.current_artist_id()));

-- Update (client): the client responds to their own check-in (rating, note,
-- photo_path, consent, status -> responded).
create policy aftercare_checkins_client_update on public.aftercare_checkins
  for update using (client_id = (select auth.uid()))
  with check (client_id = (select auth.uid()));

-- Update (artist): the owning artist links a shared portfolio piece / skips.
create policy aftercare_checkins_artist_update on public.aftercare_checkins
  for update using (artist_id = (select public.current_artist_id()))
  with check (artist_id = (select public.current_artist_id()));

-- ===========================================================================
-- 4. Schedule trigger — on a session flipping to COMPLETED, schedule the three
--    check-ins at +3d / +7d / +21d from completion. Gated on the artist's
--    aftercare toggle; idempotent via the (session_id, kind) unique index.
--    SECURITY DEFINER + pinned empty search_path (mirrors the notification and
--    agent-job triggers). The offsets mirror generateAftercareSchedule() in
--    packages/core/src/aftercare/schedule.ts and _shared/aftercare-scheduled.ts.
-- ===========================================================================
create or replace function public.schedule_aftercare_on_session_complete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enabled boolean;
  v_base    timestamptz := now();
begin
  -- Only fire on a transition INTO 'completed'.
  if new.status <> 'completed' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  select ap.aftercare_enabled into v_enabled
  from public.artist_profiles ap
  where ap.id = new.artist_id;

  -- Missing artist or aftercare disabled -> no check-ins.
  if v_enabled is distinct from true then
    return new;
  end if;

  insert into public.aftercare_checkins
    (session_id, booking_id, client_id, artist_id, kind, scheduled_for)
  values
    (new.id, new.booking_id, new.client_id, new.artist_id, 'day_3',  v_base + interval '3 days'),
    (new.id, new.booking_id, new.client_id, new.artist_id, 'week_1', v_base + interval '7 days'),
    (new.id, new.booking_id, new.client_id, new.artist_id, 'week_3', v_base + interval '21 days')
  on conflict (session_id, kind) do nothing;

  return new;
end;
$$;

revoke execute on function public.schedule_aftercare_on_session_complete() from public;
revoke execute on function public.schedule_aftercare_on_session_complete() from anon;
revoke execute on function public.schedule_aftercare_on_session_complete() from authenticated;

drop trigger if exists trg_schedule_aftercare_on_complete on public.sessions;
create trigger trg_schedule_aftercare_on_complete
  after update of status on public.sessions
  for each row execute function public.schedule_aftercare_on_session_complete();

-- ===========================================================================
-- 5. Notify the artist when the client submits a response. In-app only
--    (type 'aftercare_response' is intentionally uncategorized -> no push/email
--    fan-out; low-value, keeps the artist inbox quiet). SECURITY DEFINER.
-- ===========================================================================
create or replace function public.notify_artist_on_aftercare_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_artist_profile_id uuid;
  v_client_name       text;
begin
  -- Only on the pending/sent -> responded transition.
  if new.status <> 'responded' or (old.status is not distinct from new.status) then
    return new;
  end if;

  select ap.profile_id into v_artist_profile_id
  from public.artist_profiles ap
  where ap.id = new.artist_id;
  if v_artist_profile_id is null then
    return new;
  end if;

  select coalesce(nullif(trim(p.display_name), ''), 'Your client') into v_client_name
  from public.profiles p
  where p.id = new.client_id;

  insert into public.notifications (profile_id, type, title, body, action_url, data)
  values (
    v_artist_profile_id,
    'aftercare_response',
    'Healing check-in reply',
    v_client_name || ' shared how their tattoo is healing.',
    '/bookings/' || coalesce(new.booking_id::text, ''),
    jsonb_build_object(
      'aftercare_checkin_id', new.id,
      'session_id', new.session_id,
      'booking_id', new.booking_id,
      'client_id', new.client_id,
      'healing_rating', new.healing_rating,
      'has_photo', (new.photo_path is not null),
      'consent_to_share', new.consent_to_share
    )
  );
  return new;
end;
$$;

revoke execute on function public.notify_artist_on_aftercare_response() from public;
revoke execute on function public.notify_artist_on_aftercare_response() from anon;
revoke execute on function public.notify_artist_on_aftercare_response() from authenticated;

drop trigger if exists trg_notify_artist_on_aftercare_response on public.aftercare_checkins;
create trigger trg_notify_artist_on_aftercare_response
  after update on public.aftercare_checkins
  for each row execute function public.notify_artist_on_aftercare_response();

-- ===========================================================================
-- 6. aftercare-photos storage bucket — private. Path convention:
--      aftercare-photos/<client_id>/<checkin_id>/<filename>
--    so the FIRST segment always identifies the owning client (RLS anchor,
--    mirrors booking-uploads). The client owns read/write/delete in their
--    folder; the linked artist may READ once an aftercare_checkins row ties
--    them together. The healed photo becomes public ONLY when the artist runs
--    the share-to-portfolio flow, which uploads a fresh copy into the public
--    `media` bucket — this private object is never itself made public.
-- ===========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'aftercare-photos',
  'aftercare-photos',
  false,
  15728640, -- 15 MB
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists aftercare_photos_client_read on storage.objects;
create policy aftercare_photos_client_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'aftercare-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists aftercare_photos_artist_read on storage.objects;
create policy aftercare_photos_artist_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'aftercare-photos'
    and exists (
      select 1
      from public.aftercare_checkins ac
      where ac.client_id::text = (storage.foldername(name))[1]
        and ac.artist_id = (select public.current_artist_id())
    )
  );

drop policy if exists aftercare_photos_client_insert on storage.objects;
create policy aftercare_photos_client_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'aftercare-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists aftercare_photos_client_update on storage.objects;
create policy aftercare_photos_client_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'aftercare-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'aftercare-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists aftercare_photos_client_delete on storage.objects;
create policy aftercare_photos_client_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'aftercare-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ===========================================================================
-- 7. Wake the agent-scheduled edge function on due aftercare check-ins too.
--    The daily cron (agent-scheduled-drain, 20260716090000) already runs
--    agent_scheduled_enqueue() + agent_scheduled_tick(). The tick previously
--    only POSTed when scheduled_scan agent_jobs were pending; replace it so it
--    ALSO fires when any aftercare check-in is due — otherwise a day with no
--    Studio Manager scans would never deliver aftercare. GUARDED exactly like
--    before (no-op when nothing is due OR the Vault secrets are absent).
-- ===========================================================================
create or replace function public.agent_scheduled_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url        text;
  v_key        text;
  v_pending    int;
  v_due_after  int;
begin
  select count(*)
    into v_pending
  from public.agent_jobs
  where status = 'pending' and attempts < max_attempts and trigger_kind = 'scheduled_scan';

  select count(*)
    into v_due_after
  from public.aftercare_checkins
  where status = 'pending' and scheduled_for <= now();

  if coalesce(v_pending, 0) = 0 and coalesce(v_due_after, 0) = 0 then
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
