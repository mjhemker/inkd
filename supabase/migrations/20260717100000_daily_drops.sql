-- Migration: daily_drops
-- The personalized "daily drop" (founder §engagement): once a day every user
-- gets ONE highlighted post or flash from an artist, picked for their taste —
-- "a daily boom to get people using the app day-to-day."
--
-- What it adds:
--   1. daily_drops        — one selected pick per (user, drop_date). Written by
--      the service-role `daily-drop` edge function (the daily job); the owner
--      may only read it + stamp seen/clicked/reacted. `unique(user_id,
--      drop_date)` makes generation idempotent (running the job twice a day is a
--      no-op).
--   2. user_style_affinity(user) — a SECURITY DEFINER "query approach" that
--      scores canonical style slugs for a user from their follows / likes /
--      saves / booking history, joined through the AI `image_tags` (so an
--      artist who never tags manually still contributes style signal) plus the
--      normalized post_styles / artist_styles tags. This is the personalization
--      substrate; the TS ranker (`_shared/daily-drop.ts`) mirrors these weights
--      and layers candidate scoring + day-to-day variety on top.
--   3. daily_drop_tick()  — a guarded pg_cron that wakes the `daily-drop` edge
--      function once a day. No-ops until the function is deployed AND the Vault
--      secrets exist, exactly like agent_run_tick / image_tag_run_tick, so it is
--      safe to schedule now.
--
-- TIMEZONE: the cron fires once daily at 13:00 UTC (= 9am ET / 6am PT), matching
-- the existing agent-scheduled cadence — one daily hour to reason about. A
-- "drop day" is the UTC calendar date (`drop_date`). Per-user local-morning
-- timing is a future enhancement (needs a user timezone column); see
-- docs/daily-drop.md.

-- ---------------------------------------------------------------------------
-- 1. daily_drops — the per-user daily pick.
--    subject_type is 'post' | 'flash' ('flash' => flash_items.id). artist_id is
--    denormalized for cheap variety checks + card hydration. reason is the
--    human "why" string ("Because you follow blackwork artists"); reason_style
--    is the canonical slug that drove the pick (used for day-to-day variety).
-- ---------------------------------------------------------------------------
create table public.daily_drops (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  drop_date     date not null,
  subject_type  text not null check (subject_type in ('post', 'flash')),
  subject_id    uuid not null,
  artist_id     uuid references public.artist_profiles (id) on delete set null,
  reason        text not null,
  reason_style  text,
  is_cold_start boolean not null default false,
  score         real,
  generated_at  timestamptz not null default now(),
  seen_at       timestamptz,
  clicked_at    timestamptz,
  reacted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, drop_date)
);
create index daily_drops_user_date_idx on public.daily_drops (user_id, drop_date desc);
create index daily_drops_artist_idx on public.daily_drops (artist_id);
create index daily_drops_subject_idx on public.daily_drops (subject_type, subject_id);

create trigger daily_drops_set_updated_at before update on public.daily_drops
  for each row execute function public.set_updated_at();

alter table public.daily_drops enable row level security;

-- Owner-only read. The daily job writes via the service role (bypasses RLS),
-- mirroring notifications — there is deliberately no user INSERT policy.
create policy daily_drops_select on public.daily_drops
  for select using (user_id = (select auth.uid()));
-- Owner may stamp their own row (seen / clicked / reacted engagement signals).
create policy daily_drops_update on public.daily_drops
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. user_style_affinity — weighted style-slug affinity for a user.
--    SECURITY DEFINER (reads another user's-scoped social graph safely, like
--    search_artists / similar_works) with an explicit per-user filter. The
--    weights mirror computeStyleAffinity() in _shared/daily-drop.ts; keep them
--    in sync. Signals, strongest first:
--      saved posts (2.5) — an explicit "I want this" bookmark
--      followed artists (3.0 per artist-style) — the loudest taste signal
--      booking history (2.0 per booked-artist-style) — money-backed intent
--      liked posts (2.0)
--    Each signal contributes the style slugs found on the relevant image via
--    image_tags (AI-derived) UNION the normalized post_styles / artist_styles
--    tags, so it works whether or not anyone tagged manually.
-- ---------------------------------------------------------------------------
create or replace function public.user_style_affinity(p_user_id uuid)
returns table (style_slug text, weight real, top_source text)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with
  -- Artists the user follows -> their style slugs (AI tags on public images
  -- UNION artist_styles), each weighted 3.0.
  follow_styles as (
    select slug, 3.0::real as w, 'follow'::text as src
    from follows f
    join lateral (
      select st.slug
      from artist_styles asx
      join styles st on st.id = asx.style_id
      where asx.artist_id = f.artist_id
      union
      select s2 as slug
      from image_tags it
      cross join lateral unnest(it.styles) as s2
      where it.artist_id = f.artist_id
    ) s on true
    where f.follower_id = p_user_id
  ),
  -- Liked posts -> their style slugs (AI image tags UNION post_styles), 2.0.
  like_styles as (
    select slug, 2.0::real as w, 'like'::text as src
    from post_likes pl
    join lateral (
      select st.slug
      from post_styles ps
      join styles st on st.id = ps.style_id
      where ps.post_id = pl.post_id
      union
      select s2 as slug
      from image_tags it
      cross join lateral unnest(it.styles) as s2
      where it.subject_type = 'post' and it.subject_id = pl.post_id
    ) s on true
    where pl.profile_id = p_user_id
  ),
  -- Saved posts -> their style slugs, 2.5 (the strongest per-item signal).
  save_styles as (
    select slug, 2.5::real as w, 'save'::text as src
    from saved_posts sp
    join lateral (
      select st.slug
      from post_styles ps
      join styles st on st.id = ps.style_id
      where ps.post_id = sp.post_id
      union
      select s2 as slug
      from image_tags it
      cross join lateral unnest(it.styles) as s2
      where it.subject_type = 'post' and it.subject_id = sp.post_id
    ) s on true
    where sp.profile_id = p_user_id
  ),
  -- Booking history -> booked artists' style slugs, 2.0.
  booking_styles as (
    select slug, 2.0::real as w, 'booking'::text as src
    from bookings b
    join lateral (
      select st.slug
      from artist_styles asx
      join styles st on st.id = asx.style_id
      where asx.artist_id = b.artist_id
      union
      select s2 as slug
      from image_tags it
      cross join lateral unnest(it.styles) as s2
      where it.artist_id = b.artist_id
    ) s on true
    where b.client_id = p_user_id
  ),
  all_signals as (
    select * from follow_styles
    union all select * from like_styles
    union all select * from save_styles
    union all select * from booking_styles
  ),
  totals as (
    select slug, sum(w)::real as weight
    from all_signals
    where slug is not null
    group by slug
  ),
  -- Per-slug dominant source = the source with the largest summed contribution.
  ranked as (
    select slug, src,
           row_number() over (partition by slug order by sum(w) desc, src asc) as rn
    from all_signals
    where slug is not null
    group by slug, src
  )
  select t.slug as style_slug, t.weight, r.src as top_source
  from totals t
  join ranked r on r.slug = t.slug and r.rn = 1
  order by t.weight desc, t.slug asc;
$$;

grant execute on function public.user_style_affinity(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Guarded daily pg_cron tick. Wakes the `daily-drop` edge function (which
--    iterates active users and generates each one's pick). No-ops when the
--    Vault secrets are absent, so it is safe to schedule before the function is
--    deployed — nothing fires against a missing endpoint (mirrors
--    image_tag_run_tick / agent_scheduled_tick). Reuses the shared
--    agent_runner_service_key bearer; needs a new `daily_drop_url` Vault secret.
-- ---------------------------------------------------------------------------
create or replace function public.daily_drop_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_key text;
begin
  begin
    select decrypted_secret into v_url
      from vault.decrypted_secrets where name = 'daily_drop_url';
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

revoke execute on function public.daily_drop_tick() from public;
revoke execute on function public.daily_drop_tick() from anon;
revoke execute on function public.daily_drop_tick() from authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'daily-drop-generate') then
      perform cron.unschedule('daily-drop-generate');
    end if;
    -- Once a day at 13:00 UTC (= 9am ET / 6am PT): the morning "drop".
    perform cron.schedule('daily-drop-generate', '0 13 * * *', 'select public.daily_drop_tick();');
  end if;
end $$;
