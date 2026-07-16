-- Migration: waitlist  (Wave 2 — cancellation waitlist + auto-fill)
--
-- Clients join an artist's waitlist for a desired window/service. When a booked
-- session is cancelled (or the artist manually opens a freed slot), INKD creates
-- an "opening" and cascades a short-lived OFFER to the best-matching entry;
-- decline/expire rolls to the next candidate (sequential, never a blast).
-- Accepting converts the offer into a real booking + session and voids siblings.
--
-- Three tables:
--   waitlist_entries   — a client's standing request to an artist (the demand).
--   waitlist_openings  — a freed slot actively being cascaded (the "opened_slot"
--                        ref; ties to a cancelled session OR an availability
--                        window). Drives the cascade state machine.
--   waitlist_offers    — one time-boxed offer of an opening to one entry's client.
--
-- Double-booking is guarded three ways (see claim_waitlist_offer):
--   1. a per-opening partial-unique index on the single PENDING offer + the
--      single ACCEPTED offer (sequential by construction),
--   2. a transaction-scoped advisory lock keyed on (artist, slot_start) so two
--      claims for the same physical slot serialize, and
--   3. an explicit overlap check against live sessions inside that lock.
--
-- Notifications reuse the Wave 1 in-app + delivery system by inserting a
-- `public.notifications` row (type 'waitlist_offer_new'); a new 'waitlist'
-- preference category (added additively below, mirrored in the three canonical
-- places) routes it to push + in-app.

-- ===========================================================================
-- 0. Enums + the artist enable toggle.
-- ===========================================================================
create type public.waitlist_entry_status as enum (
  'active', 'offered', 'claimed', 'expired', 'cancelled'
);
create type public.waitlist_offer_status as enum (
  'pending', 'accepted', 'declined', 'expired'
);
create type public.waitlist_opening_status as enum (
  'open', 'filled', 'exhausted', 'expired', 'cancelled'
);

alter table public.artist_profiles
  add column if not exists waitlist_enabled boolean not null default true;

-- ===========================================================================
-- 1. waitlist_entries — the client's standing demand.
-- ===========================================================================
create table public.waitlist_entries (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null references public.profiles (id) on delete cascade,
  artist_id            uuid not null references public.artist_profiles (id) on delete cascade,
  service_id           uuid references public.services (id) on delete set null,
  -- Desired window (all optional = "any"): a date range + preferred weekdays +
  -- a preferred time-of-day band. Matched against a freed slot's local wall time
  -- (America/New_York — the pilot is Baltimore + Philadelphia).
  earliest_date        date,
  latest_date          date,
  preferred_weekdays   smallint[],           -- 0=Sun..6=Sat; null/empty = any day
  preferred_time_start time,                 -- inclusive lower bound; null = any
  preferred_time_end   time,                 -- exclusive upper bound; null = any
  note                 text,
  status               public.waitlist_entry_status not null default 'active',
  priority             int not null default 0,   -- higher wins; ties break FIFO by created_at
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint waitlist_entries_date_range_ck
    check (earliest_date is null or latest_date is null or latest_date >= earliest_date),
  constraint waitlist_entries_time_range_ck
    check (preferred_time_start is null or preferred_time_end is null
           or preferred_time_end > preferred_time_start)
);
create index waitlist_entries_client_idx on public.waitlist_entries (client_id, status);
create index waitlist_entries_artist_idx on public.waitlist_entries (artist_id, status);
create index waitlist_entries_service_idx on public.waitlist_entries (service_id);
-- Cascade ordering probe.
create index waitlist_entries_match_idx
  on public.waitlist_entries (artist_id, priority desc, created_at)
  where status = 'active';

create trigger waitlist_entries_set_updated_at before update on public.waitlist_entries
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- 2. waitlist_openings — a freed slot being cascaded (the opened_slot ref).
-- ===========================================================================
create table public.waitlist_openings (
  id           uuid primary key default gen_random_uuid(),
  artist_id    uuid not null references public.artist_profiles (id) on delete cascade,
  service_id   uuid references public.services (id) on delete set null,
  session_id   uuid references public.sessions (id) on delete set null, -- freed session, if any
  slot_start   timestamptz not null,
  slot_end     timestamptz,
  source       text not null default 'cancellation'
                 check (source in ('cancellation', 'manual', 'availability')),
  status       public.waitlist_opening_status not null default 'open',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index waitlist_openings_artist_idx on public.waitlist_openings (artist_id, status);
create index waitlist_openings_open_idx on public.waitlist_openings (slot_start)
  where status = 'open';
-- At most one live opening per freed session (idempotent re-cancellation).
create unique index waitlist_openings_session_open_uq
  on public.waitlist_openings (session_id)
  where session_id is not null and status = 'open';

create trigger waitlist_openings_set_updated_at before update on public.waitlist_openings
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- 3. waitlist_offers — one time-boxed offer of an opening to one entry.
-- ===========================================================================
create table public.waitlist_offers (
  id                uuid primary key default gen_random_uuid(),
  opening_id        uuid not null references public.waitlist_openings (id) on delete cascade,
  waitlist_entry_id uuid not null references public.waitlist_entries (id) on delete cascade,
  artist_id         uuid not null references public.artist_profiles (id) on delete cascade,
  client_id         uuid not null references public.profiles (id) on delete cascade, -- the offered client
  service_id        uuid references public.services (id) on delete set null,          -- denormalized from opening
  session_id        uuid references public.sessions (id) on delete set null,          -- denormalized from opening
  slot_start        timestamptz not null,                                             -- denormalized snapshot
  slot_end          timestamptz,
  offered_at        timestamptz not null default now(),
  expires_at        timestamptz not null,
  status            public.waitlist_offer_status not null default 'pending',
  responded_at      timestamptz,
  booking_id        uuid references public.bookings (id) on delete set null,          -- set on accept
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index waitlist_offers_entry_idx on public.waitlist_offers (waitlist_entry_id);
create index waitlist_offers_client_idx on public.waitlist_offers (client_id, status);
create index waitlist_offers_artist_idx on public.waitlist_offers (artist_id, status);
create index waitlist_offers_opening_idx on public.waitlist_offers (opening_id);
-- Expiry scan for the tick.
create index waitlist_offers_pending_idx on public.waitlist_offers (expires_at)
  where status = 'pending';
-- DOUBLE-BOOKING GUARD (structural): at most ONE pending and at most ONE accepted
-- offer per opening. The pending-unique makes the cascade sequential (never a
-- blast); the accepted-unique makes "claimed once" a hard DB invariant.
create unique index waitlist_offers_one_pending_per_opening
  on public.waitlist_offers (opening_id) where status = 'pending';
create unique index waitlist_offers_one_accepted_per_opening
  on public.waitlist_offers (opening_id) where status = 'accepted';

create trigger waitlist_offers_set_updated_at before update on public.waitlist_offers
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- 4. Notification taxonomy — extend additively for the 'waitlist' category so
--    the offer notification fans out to push (+ in-app). Mirrored in
--    packages/core/src/notifications/categories.ts and
--    supabase/functions/_shared/notification-categories.ts (kept in sync).
--    Email default stays OFF (push is the timely channel for "a spot opened").
-- ===========================================================================
alter table public.notification_preferences
  drop constraint if exists notification_preferences_category_check;
alter table public.notification_preferences
  add constraint notification_preferences_category_check
    check (category in (
      'booking_request', 'booking_accepted', 'booking_declined', 'session_reminder',
      'deposit', 'message', 'review', 'review_response', 'ai_approval', 'aftercare',
      'waitlist'
    ));

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
    when 'waitlist_offer_new'       then 'waitlist'
    else null
  end;
$$;

-- ===========================================================================
-- 5. RLS
-- ===========================================================================
alter table public.waitlist_entries  enable row level security;
alter table public.waitlist_openings enable row level security;
alter table public.waitlist_offers   enable row level security;

-- entries: the client manages their own; the owning artist may read theirs.
create policy waitlist_entries_select on public.waitlist_entries
  for select using (
    client_id = (select auth.uid()) or artist_id = (select public.current_artist_id())
  );
create policy waitlist_entries_insert on public.waitlist_entries
  for insert with check (client_id = (select auth.uid()));
create policy waitlist_entries_update on public.waitlist_entries
  for update using (client_id = (select auth.uid()))
  with check (client_id = (select auth.uid()));
create policy waitlist_entries_delete on public.waitlist_entries
  for delete using (client_id = (select auth.uid()));

-- openings: the owning artist reads theirs; clients never read openings directly
-- (offers carry a denormalized slot snapshot). Writes only via SECURITY DEFINER.
create policy waitlist_openings_select on public.waitlist_openings
  for select using (artist_id = (select public.current_artist_id()));

-- offers: the offered client + the owning artist read; state changes only ever
-- happen through the SECURITY DEFINER RPCs below (no direct client/artist write).
create policy waitlist_offers_select on public.waitlist_offers
  for select using (
    client_id = (select auth.uid()) or artist_id = (select public.current_artist_id())
  );

-- ===========================================================================
-- 6. Matching — the best next candidate for an opening (pure read helper).
--    Local wall time (America/New_York) drives weekday/time/date comparisons.
-- ===========================================================================
create or replace function public.waitlist_match_next(p_opening_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  with o as (
    select * from public.waitlist_openings where id = p_opening_id
  ),
  loc as (
    select (o.slot_start at time zone 'America/New_York') as local_ts, o.* from o
  )
  select e.id
  from public.waitlist_entries e
  join public.artist_profiles ap on ap.id = e.artist_id
  cross join loc
  where e.artist_id = loc.artist_id
    and e.status = 'active'
    and ap.waitlist_enabled
    -- service: a service-specific entry only matches an opening of that service.
    and (e.service_id is null or e.service_id = loc.service_id)
    -- date window
    and (e.earliest_date is null or (loc.local_ts)::date >= e.earliest_date)
    and (e.latest_date  is null or (loc.local_ts)::date <= e.latest_date)
    -- preferred weekdays (0=Sun..6=Sat)
    and (e.preferred_weekdays is null
         or array_length(e.preferred_weekdays, 1) is null
         or extract(dow from loc.local_ts)::smallint = any(e.preferred_weekdays))
    -- preferred time-of-day band
    and (e.preferred_time_start is null or (loc.local_ts)::time >= e.preferred_time_start)
    and (e.preferred_time_end   is null or (loc.local_ts)::time <  e.preferred_time_end)
    -- never re-offer the same opening to an entry that already saw it
    and not exists (
      select 1 from public.waitlist_offers wo
      where wo.opening_id = p_opening_id and wo.waitlist_entry_id = e.id
    )
  order by e.priority desc, e.created_at asc
  limit 1;
$$;

revoke execute on function public.waitlist_match_next(uuid) from public, anon, authenticated;

-- ===========================================================================
-- 7. Create one offer (internal) — sets entry->offered, writes the notification.
-- ===========================================================================
create or replace function public.waitlist_create_offer(p_opening_id uuid, p_entry_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_opening    public.waitlist_openings;
  v_entry      public.waitlist_entries;
  v_expires    timestamptz;
  v_offer_id   uuid;
  v_artist_nm  text;
  v_when       text;
begin
  select * into v_opening from public.waitlist_openings where id = p_opening_id;
  select * into v_entry   from public.waitlist_entries  where id = p_entry_id;
  if v_opening.id is null or v_entry.id is null then
    return null;
  end if;

  -- Offer TTL: 3 hours, but never past the slot itself.
  v_expires := least(now() + interval '3 hours', v_opening.slot_start);
  if v_expires <= now() then
    return null; -- slot too imminent / already gone
  end if;

  insert into public.waitlist_offers (
    opening_id, waitlist_entry_id, artist_id, client_id,
    service_id, session_id, slot_start, slot_end, expires_at
  ) values (
    v_opening.id, v_entry.id, v_opening.artist_id, v_entry.client_id,
    v_opening.service_id, v_opening.session_id, v_opening.slot_start, v_opening.slot_end, v_expires
  ) returning id into v_offer_id;

  update public.waitlist_entries set status = 'offered' where id = v_entry.id;

  select coalesce(p.display_name, 'An artist') into v_artist_nm
  from public.artist_profiles ap join public.profiles p on p.id = ap.profile_id
  where ap.id = v_opening.artist_id;

  v_when := to_char(v_opening.slot_start at time zone 'America/New_York', 'FMDay, FMMon FMDD at FMHH12:MIam');

  insert into public.notifications (profile_id, type, title, body, action_url, data)
  values (
    v_entry.client_id,
    'waitlist_offer_new',
    'A spot opened up',
    'A spot opened with ' || v_artist_nm || ' on ' || v_when || ' — claim it before it expires.',
    '/bookings/waitlist',
    jsonb_build_object(
      'offer_id', v_offer_id,
      'opening_id', v_opening.id,
      'waitlist_entry_id', v_entry.id,
      'artist_id', v_opening.artist_id,
      'slot_start', v_opening.slot_start,
      'expires_at', v_expires
    )
  );

  return v_offer_id;
end;
$$;

revoke execute on function public.waitlist_create_offer(uuid, uuid) from public, anon, authenticated;

-- ===========================================================================
-- 8. Cascade one step for an opening — offer the next candidate, or resolve.
-- ===========================================================================
create or replace function public.waitlist_cascade(p_opening_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_opening   public.waitlist_openings;
  v_next      uuid;
begin
  select * into v_opening from public.waitlist_openings
    where id = p_opening_id for update;
  if v_opening.id is null or v_opening.status <> 'open' then
    return;
  end if;

  -- Already an accepted offer -> the opening is filled.
  if exists (select 1 from public.waitlist_offers
             where opening_id = p_opening_id and status = 'accepted') then
    update public.waitlist_openings set status = 'filled' where id = p_opening_id;
    return;
  end if;

  -- A pending offer is outstanding -> wait for it to resolve.
  if exists (select 1 from public.waitlist_offers
             where opening_id = p_opening_id and status = 'pending') then
    return;
  end if;

  -- Slot has passed -> expire the opening.
  if v_opening.slot_start <= now() then
    update public.waitlist_openings set status = 'expired' where id = p_opening_id;
    return;
  end if;

  v_next := public.waitlist_match_next(p_opening_id);
  if v_next is null then
    update public.waitlist_openings set status = 'exhausted' where id = p_opening_id;
    return;
  end if;

  perform public.waitlist_create_offer(p_opening_id, v_next);
end;
$$;

revoke execute on function public.waitlist_cascade(uuid) from public, anon, authenticated;

-- ===========================================================================
-- 9. Open a freed slot — create (or reuse) an opening and kick the cascade.
-- ===========================================================================
create or replace function public.waitlist_open_slot(
  p_artist_id  uuid,
  p_service_id uuid,
  p_session_id uuid,
  p_slot_start timestamptz,
  p_slot_end   timestamptz,
  p_source     text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_opening_id uuid;
  v_enabled    boolean;
begin
  if p_slot_start is null or p_slot_start <= now() then
    return null; -- nothing to offer for a past/unknown slot
  end if;

  select waitlist_enabled into v_enabled
    from public.artist_profiles where id = p_artist_id;
  if not coalesce(v_enabled, false) then
    return null;
  end if;

  -- Reuse an existing open opening for the same freed session (idempotent).
  if p_session_id is not null then
    select id into v_opening_id from public.waitlist_openings
      where session_id = p_session_id and status = 'open' limit 1;
  end if;

  if v_opening_id is null then
    insert into public.waitlist_openings (
      artist_id, service_id, session_id, slot_start, slot_end, source
    ) values (
      p_artist_id, p_service_id, p_session_id, p_slot_start, p_slot_end,
      coalesce(p_source, 'cancellation')
    ) returning id into v_opening_id;
  end if;

  perform public.waitlist_cascade(v_opening_id);
  return v_opening_id;
end;
$$;

revoke execute on function public.waitlist_open_slot(uuid, uuid, uuid, timestamptz, timestamptz, text)
  from public, anon, authenticated;

-- ===========================================================================
-- 10. Cancellation trigger — a session cancelled in the future opens the slot.
-- ===========================================================================
create or replace function public.on_session_cancelled_waitlist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service_id uuid;
begin
  if new.scheduled_start is null or new.scheduled_start <= now() then
    return new;
  end if;

  select service_id into v_service_id from public.bookings where id = new.booking_id;

  perform public.waitlist_open_slot(
    new.artist_id, v_service_id, new.id,
    new.scheduled_start, new.scheduled_end, 'cancellation'
  );
  return new;
end;
$$;

revoke execute on function public.on_session_cancelled_waitlist() from public, anon, authenticated;

drop trigger if exists trg_on_session_cancelled_waitlist on public.sessions;
create trigger trg_on_session_cancelled_waitlist
  after update on public.sessions
  for each row
  when (new.status = 'cancelled' and old.status is distinct from 'cancelled')
  execute function public.on_session_cancelled_waitlist();

-- ===========================================================================
-- 11. Scheduled tick — expire stale offers/openings, then cascade every open
--     opening to the next candidate. Pure SQL, no external deps: safe to run
--     unconditionally on a minute cron.
-- ===========================================================================
create or replace function public.waitlist_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  -- (a) Expire pending offers past their TTL; free their entries.
  with expired as (
    update public.waitlist_offers
       set status = 'expired', responded_at = now()
     where status = 'pending' and expires_at <= now()
    returning waitlist_entry_id
  )
  update public.waitlist_entries e
     set status = 'active'
    from expired x
   where e.id = x.waitlist_entry_id and e.status = 'offered';

  -- (b) Expire openings whose slot has passed.
  update public.waitlist_openings
     set status = 'expired'
   where status = 'open' and slot_start <= now();

  -- (c) Cascade every still-open opening (offers next candidate or resolves).
  for v_id in
    select id from public.waitlist_openings where status = 'open'
  loop
    perform public.waitlist_cascade(v_id);
  end loop;
end;
$$;

revoke execute on function public.waitlist_tick() from public, anon, authenticated;

-- ===========================================================================
-- 12. Client RPC — decline an offer (rolls to the next candidate).
-- ===========================================================================
create or replace function public.decline_waitlist_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.waitlist_offers;
begin
  select * into v_offer from public.waitlist_offers where id = p_offer_id for update;
  if v_offer.id is null then
    raise exception 'offer not found';
  end if;
  if v_offer.client_id <> (select auth.uid()) then
    raise exception 'not your offer';
  end if;
  if v_offer.status <> 'pending' then
    raise exception 'offer is no longer open';
  end if;

  update public.waitlist_offers
     set status = 'declined', responded_at = now() where id = p_offer_id;
  -- Free the entry so it stays eligible for FUTURE openings.
  update public.waitlist_entries
     set status = 'active' where id = v_offer.waitlist_entry_id and status = 'offered';
  -- Roll to the next candidate immediately.
  perform public.waitlist_cascade(v_offer.opening_id);
end;
$$;

revoke execute on function public.decline_waitlist_offer(uuid) from public, anon;
grant execute on function public.decline_waitlist_offer(uuid) to authenticated;

-- ===========================================================================
-- 13. Client RPC — CLAIM an offer -> booking + session. The double-booking
--     guard lives here: advisory lock on (artist, slot) + live-session overlap
--     check + the accepted-offer unique index.
-- ===========================================================================
create or replace function public.claim_waitlist_offer(p_offer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer    public.waitlist_offers;
  v_uid      uuid := (select auth.uid());
  v_service  public.services;
  v_orig     public.sessions;
  v_slot_end timestamptz;
  v_booking  uuid;
  v_deposit  int := 0;
  v_total    int;
begin
  -- Read once (unlocked) to learn the slot key for the advisory lock.
  select * into v_offer from public.waitlist_offers where id = p_offer_id;
  if v_offer.id is null then
    raise exception 'offer not found';
  end if;
  if v_offer.client_id <> v_uid then
    raise exception 'not your offer';
  end if;

  -- Serialize every claim for the same physical slot (artist + start).
  perform pg_advisory_xact_lock(
    hashtext(v_offer.artist_id::text), hashtext(v_offer.slot_start::text)
  );

  -- Re-read under the lock + row lock; re-validate.
  select * into v_offer from public.waitlist_offers where id = p_offer_id for update;
  if v_offer.status <> 'pending' then
    raise exception 'offer is no longer available';
  end if;
  if v_offer.expires_at <= now() then
    raise exception 'offer has expired';
  end if;

  v_slot_end := coalesce(v_offer.slot_end, v_offer.slot_start + interval '60 minutes');

  -- OVERLAP GUARD: no live session may occupy this slot for the artist.
  if exists (
    select 1 from public.sessions s
    where s.artist_id = v_offer.artist_id
      and s.status in ('scheduled', 'confirmed')
      and s.scheduled_start is not null
      and s.scheduled_start < v_slot_end
      and coalesce(s.scheduled_end, s.scheduled_start + interval '60 minutes') > v_offer.slot_start
  ) then
    raise exception 'slot no longer available';
  end if;

  -- Carry over service pricing + original session location/duration if present.
  if v_offer.service_id is not null then
    select * into v_service from public.services where id = v_offer.service_id;
  end if;
  if v_offer.session_id is not null then
    select * into v_orig from public.sessions where id = v_offer.session_id;
  end if;

  v_deposit := coalesce(v_service.deposit_amount_cents, 0);
  v_total   := v_service.price_cents;

  insert into public.bookings (request_id, artist_id, client_id, service_id, status,
                               title, total_price_cents, deposit_cents, notes)
  values (null, v_offer.artist_id, v_uid, v_offer.service_id, 'pending',
          coalesce(v_service.name, 'Waitlist booking'), v_total, v_deposit,
          'Booked from the cancellation waitlist.')
  returning id into v_booking;

  insert into public.sessions (booking_id, artist_id, client_id, location_id,
                               session_number, status, scheduled_start, scheduled_end,
                               duration_minutes, deposit_cents)
  values (v_booking, v_offer.artist_id, v_uid, v_orig.location_id,
          1, 'scheduled', v_offer.slot_start, v_slot_end,
          coalesce(v_service.duration_minutes,
                   (extract(epoch from (v_slot_end - v_offer.slot_start)) / 60)::int),
          v_deposit);

  -- Accept this offer (accepted-per-opening unique index is the hard guard).
  update public.waitlist_offers
     set status = 'accepted', responded_at = now(), booking_id = v_booking
   where id = p_offer_id;

  update public.waitlist_entries set status = 'claimed' where id = v_offer.waitlist_entry_id;
  update public.waitlist_openings set status = 'filled'  where id = v_offer.opening_id;

  -- Void any sibling pending offers for this opening; free their entries.
  with voided as (
    update public.waitlist_offers
       set status = 'declined', responded_at = now()
     where opening_id = v_offer.opening_id and id <> p_offer_id and status = 'pending'
    returning waitlist_entry_id
  )
  update public.waitlist_entries e
     set status = 'active'
    from voided v
   where e.id = v.waitlist_entry_id and e.status = 'offered';

  return v_booking;
end;
$$;

revoke execute on function public.claim_waitlist_offer(uuid) from public, anon;
grant execute on function public.claim_waitlist_offer(uuid) to authenticated;

-- ===========================================================================
-- 14. Artist RPC — manually open a freed session slot to the waitlist.
-- ===========================================================================
create or replace function public.waitlist_artist_open_session(p_session_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sess    public.sessions;
  v_service uuid;
  v_artist  uuid := (select public.current_artist_id());
begin
  if v_artist is null then
    raise exception 'not an artist';
  end if;
  select * into v_sess from public.sessions where id = p_session_id;
  if v_sess.id is null or v_sess.artist_id <> v_artist then
    raise exception 'session not found';
  end if;
  select service_id into v_service from public.bookings where id = v_sess.booking_id;
  return public.waitlist_open_slot(
    v_artist, v_service, v_sess.id, v_sess.scheduled_start, v_sess.scheduled_end, 'manual'
  );
end;
$$;

revoke execute on function public.waitlist_artist_open_session(uuid) from public, anon;
grant execute on function public.waitlist_artist_open_session(uuid) to authenticated;

-- ===========================================================================
-- 15. Cron — run the tick every minute (guard the schedule on pg_cron presence).
-- ===========================================================================
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'waitlist-tick') then
      perform cron.unschedule('waitlist-tick');
    end if;
    perform cron.schedule('waitlist-tick', '* * * * *', 'select public.waitlist_tick();');
  end if;
end $$;
