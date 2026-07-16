-- Migration: shops
-- Wave 2 — Shops as an account-type capability.
--
-- A SHOP is an artist account that HOSTS other artists' accounts. The founder's
-- framing: "an artist count that is designated as a shop and hosts other
-- artists' accounts, kinda like a promotional tool. Also, it could be a
-- management layer. It could have those types of switches." So the shop↔artist
-- relationship is toggleable between two modes:
--   * promotional — the shop just showcases the artist; the artist keeps full
--     independence (nothing of theirs is exposed to the shop).
--   * managed     — the shop has a management layer over that artist: shop
--     owner/managers may read that artist's bookings/calendar (see the
--     shop_managed_member_agenda RPC), shop discovery groups them, etc. This is
--     gated behind the ARTIST accepting a managed invite (consent).
--
-- A shop is NOT a third mutually-exclusive account type — it is a capability of
-- an artist account (`profiles.is_artist = true` + an `artist_profiles` row).
-- A profile owns AT MOST ONE shop for now (enforced by a unique owner).
--
-- Tables: public.shops, public.shop_members.
-- Everything is RLS-guarded from creation. get_advisors is run after apply.

-- ===========================================================================
-- Enums
-- ===========================================================================
create type public.shop_member_role as enum (
  'owner', 'manager', 'resident', 'guest'
);

create type public.shop_membership_mode as enum (
  'promotional', 'managed'
);

create type public.shop_member_status as enum (
  'invited', 'active', 'removed'
);

-- ===========================================================================
-- shops: one per owning artist_profile.
-- The shop's LOCATIONS are the owner artist's studio_locations (a shop IS an
-- artist account); `primary_location_id` optionally points at the headline one.
-- ===========================================================================
create table public.shops (
  id                  uuid primary key default gen_random_uuid(),
  owner_artist_id     uuid not null unique references public.artist_profiles (id) on delete cascade,
  name                text not null,
  handle              text not null,
  bio                 text,
  avatar_url          text,
  primary_location_id uuid references public.studio_locations (id) on delete set null,
  is_published        boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index shops_handle_lower_key on public.shops (lower(handle));
create index shops_owner_artist_id_idx on public.shops (owner_artist_id);
create index shops_is_published_idx on public.shops (is_published) where is_published;

create trigger shops_set_updated_at before update on public.shops
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- shop_members: the roster. The owner is materialized as a member row
-- (role='owner', status='active') at shop creation so the roster is complete.
-- ===========================================================================
create table public.shop_members (
  id                uuid primary key default gen_random_uuid(),
  shop_id           uuid not null references public.shops (id) on delete cascade,
  artist_profile_id uuid not null references public.artist_profiles (id) on delete cascade,
  role              public.shop_member_role     not null default 'resident',
  membership_mode   public.shop_membership_mode not null default 'promotional',
  status            public.shop_member_status   not null default 'invited',
  invited_by        uuid references public.profiles (id) on delete set null,
  invited_at        timestamptz not null default now(),
  joined_at         timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (shop_id, artist_profile_id)
);
create index shop_members_shop_id_idx on public.shop_members (shop_id);
create index shop_members_artist_profile_id_idx on public.shop_members (artist_profile_id);
create index shop_members_active_idx on public.shop_members (shop_id) where status = 'active';

create trigger shop_members_set_updated_at before update on public.shop_members
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- RLS helper functions (SECURITY DEFINER so they can read shops/shop_members
-- without tripping the very policies that call them — no recursion).
-- ===========================================================================

-- The shop id owned by the current auth user's artist profile (or NULL).
create or replace function public.current_owned_shop_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.id
  from public.shops s
  where s.owner_artist_id = public.current_artist_id()
  limit 1
$$;

-- True when the current auth user owns OR actively manages the given shop
-- (owner via shops.owner_artist_id, or an active member with role owner/manager).
create or replace function public.is_shop_manager(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shops s
    where s.id = p_shop_id
      and s.owner_artist_id = public.current_artist_id()
  ) or exists (
    select 1 from public.shop_members m
    where m.shop_id = p_shop_id
      and m.artist_profile_id = public.current_artist_id()
      and m.status = 'active'
      and m.role in ('owner', 'manager')
  )
$$;

revoke execute on function public.current_owned_shop_id() from public, anon;
revoke execute on function public.is_shop_manager(uuid) from public, anon;
grant execute on function public.current_owned_shop_id() to authenticated;
grant execute on function public.is_shop_manager(uuid) to authenticated;

-- ===========================================================================
-- shop_members state-machine guard (BEFORE INSERT/UPDATE).
--
-- Managers (owner / role manager) may set role, membership_mode and status
-- freely. A member acting on THEIR OWN row (not a manager) may only move their
-- own status along the accept/decline/leave edges and may never change their
-- role or membership_mode. This is what makes "no unilateral adding", "artist
-- must ACCEPT", and "mode is gated behind the artist's acceptance" true by
-- construction rather than by trusting the client.
-- ===========================================================================
create or replace function public.shop_members_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_manager boolean;
  v_is_self boolean;
begin
  v_is_manager := public.is_shop_manager(new.shop_id);
  v_is_self := (new.artist_profile_id = public.current_artist_id());

  if tg_op = 'INSERT' then
    -- Owner bootstrap row: the owner adds themselves as role='owner' when the
    -- shop is created. Otherwise only a manager may add someone, and only as an
    -- 'invited' row (no unilateral active adding).
    if v_is_self and new.role = 'owner' then
      return new;
    end if;
    if not v_is_manager then
      raise exception 'shop_members: only a shop manager may add members';
    end if;
    if new.status <> 'invited' then
      raise exception 'shop_members: new members must start as invited (the artist accepts)';
    end if;
    if new.role = 'owner' then
      raise exception 'shop_members: cannot invite a member as owner';
    end if;
    return new;
  end if;

  -- tg_op = 'UPDATE'
  if v_is_manager then
    -- Managers may change role/mode/status. Keep joined_at coherent.
    if new.status = 'active' and old.status <> 'active' and new.joined_at is null then
      new.joined_at := now();
    end if;
    return new;
  end if;

  if v_is_self then
    -- A member acting on their own row may not touch role or membership_mode.
    if new.role is distinct from old.role
       or new.membership_mode is distinct from old.membership_mode then
      raise exception 'shop_members: a member cannot change their own role or mode';
    end if;
    -- Allowed self status edges: accept (invited->active), decline
    -- (invited->removed), leave (active->removed). Anything else is rejected.
    if old.status = 'invited' and new.status = 'active' then
      if new.joined_at is null then new.joined_at := now(); end if;
      return new;
    elsif old.status = 'invited' and new.status = 'removed' then
      return new;
    elsif old.status = 'active' and new.status = 'removed' then
      return new;
    elsif new.status = old.status then
      return new;
    else
      raise exception 'shop_members: illegal status transition % -> %', old.status, new.status;
    end if;
  end if;

  raise exception 'shop_members: not permitted to modify this membership';
end;
$$;

revoke execute on function public.shop_members_guard() from public, anon, authenticated;

create trigger shop_members_guard_ins before insert on public.shop_members
  for each row execute function public.shop_members_guard();
create trigger shop_members_guard_upd before update on public.shop_members
  for each row execute function public.shop_members_guard();

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table public.shops        enable row level security;
alter table public.shop_members enable row level security;

-- shops: published shops are world-readable; owner + active managers read their
-- own (incl. drafts). Only the owning artist may create/delete; owner+managers
-- may edit the shop profile.
create policy shops_select on public.shops
  for select using (
    is_published
    or owner_artist_id = (select public.current_artist_id())
    or public.is_shop_manager(id)
  );
create policy shops_insert on public.shops
  for insert with check (owner_artist_id = (select public.current_artist_id()));
create policy shops_update on public.shops
  for update using (
    owner_artist_id = (select public.current_artist_id())
    or public.is_shop_manager(id)
  ) with check (
    owner_artist_id = (select public.current_artist_id())
    or public.is_shop_manager(id)
  );
create policy shops_delete on public.shops
  for delete using (owner_artist_id = (select public.current_artist_id()));

-- shop_members: active members of a PUBLISHED shop are world-readable (the
-- public roster); a member always sees their own row; managers see the whole
-- roster (incl. invited/removed). Writes are gated by the guard trigger above;
-- the policies here decide row VISIBILITY for the write.
create policy shop_members_select on public.shop_members
  for select using (
    (status = 'active' and exists (
      select 1 from public.shops s where s.id = shop_id and s.is_published
    ))
    or artist_profile_id = (select public.current_artist_id())
    or public.is_shop_manager(shop_id)
  );
create policy shop_members_insert on public.shop_members
  for insert with check (
    -- owner bootstrap (self as owner of a shop they own) OR a manager inviting.
    (
      artist_profile_id = (select public.current_artist_id())
      and role = 'owner'
      and exists (
        select 1 from public.shops s
        where s.id = shop_id and s.owner_artist_id = (select public.current_artist_id())
      )
    )
    or public.is_shop_manager(shop_id)
  );
create policy shop_members_update on public.shop_members
  for update using (
    public.is_shop_manager(shop_id)
    or artist_profile_id = (select public.current_artist_id())
  ) with check (
    public.is_shop_manager(shop_id)
    or artist_profile_id = (select public.current_artist_id())
  );
create policy shop_members_delete on public.shop_members
  for delete using (
    public.is_shop_manager(shop_id)
    or artist_profile_id = (select public.current_artist_id())
  );

-- ===========================================================================
-- shop_managed_member_agenda: the "management layer" read.
--
-- SECURITY DEFINER so it can read a managed member's bookings/sessions across
-- that member's own RLS — but it ONLY returns rows for members who have
-- CONSENTED by accepting a MANAGED membership (status='active',
-- membership_mode='managed') of a shop the CALLER manages. A promotional-only
-- member's private bookings are never returned; a caller who does not manage
-- the shop gets nothing. This is additive: it does not alter booking RLS.
-- ===========================================================================
create or replace function public.shop_managed_member_agenda(
  p_shop_id uuid,
  p_from    timestamptz default now(),
  p_limit   integer default 100
)
returns table (
  member_artist_id uuid,
  member_handle    text,
  member_name      text,
  session_id       uuid,
  booking_id       uuid,
  session_number   integer,
  scheduled_start  timestamptz,
  scheduled_end    timestamptz,
  session_status   public.session_status
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.artist_profile_id                 as member_artist_id,
    p.handle                            as member_handle,
    coalesce(p.display_name, p.handle)  as member_name,
    se.id                               as session_id,
    se.booking_id                       as booking_id,
    se.session_number                   as session_number,
    se.scheduled_start                  as scheduled_start,
    se.scheduled_end                    as scheduled_end,
    se.status                           as session_status
  from public.shop_members m
  join public.artist_profiles ap on ap.id = m.artist_profile_id
  join public.profiles p on p.id = ap.profile_id
  join public.sessions se on se.artist_id = m.artist_profile_id
  where m.shop_id = p_shop_id
    and m.status = 'active'
    and m.membership_mode = 'managed'
    and public.is_shop_manager(p_shop_id)          -- caller must manage this shop
    and (p_from is null or se.scheduled_start is null or se.scheduled_start >= p_from)
  order by se.scheduled_start asc nulls last
  limit greatest(coalesce(p_limit, 100), 0)
$$;

revoke execute on function public.shop_managed_member_agenda(uuid, timestamptz, integer) from public, anon;
grant execute on function public.shop_managed_member_agenda(uuid, timestamptz, integer) to authenticated;

-- ===========================================================================
-- search_shops: discovery dimension for shops. SECURITY INVOKER so the caller's
-- RLS applies (only published shops + their active members are visible). Additive
-- to search_artists — does not touch it.
-- ===========================================================================
create or replace function public.search_shops(
  p_state  text    default null,
  p_query  text    default null,
  p_limit  integer default 40,
  p_offset integer default 0
)
returns table (
  shop_id       uuid,
  handle        text,
  name          text,
  bio           text,
  avatar_url    text,
  city          text,
  state         text,
  member_count  integer
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with base as (
    select
      s.id                                        as shop_id,
      s.handle                                    as handle,
      s.name                                      as name,
      s.bio                                       as bio,
      s.avatar_url                                as avatar_url,
      coalesce(loc.city, op.city)                 as city,
      coalesce(loc.state::text, op.state::text)   as state,
      (
        select count(*)::int from public.shop_members m
        where m.shop_id = s.id and m.status = 'active'
      )                                           as member_count,
      lower(concat_ws(' ',
        coalesce(s.name, ''), coalesce(s.handle, ''),
        coalesce(loc.city, op.city, ''))) as search_blob
    from public.shops s
    join public.artist_profiles oap on oap.id = s.owner_artist_id
    join public.profiles op on op.id = oap.profile_id
    left join lateral (
      select sl.city, sl.state
      from public.studio_locations sl
      where sl.artist_id = s.owner_artist_id and sl.is_public
      order by (sl.id = s.primary_location_id) desc, sl.is_primary desc, sl.created_at asc
      limit 1
    ) loc on true
    where s.is_published
  )
  select shop_id, handle, name, bio, avatar_url, city, state, member_count
  from base
  where (p_state is null or state = p_state)
    and (
      p_query is null or length(trim(p_query)) = 0
      or search_blob ilike '%' || lower(trim(p_query)) || '%'
      or word_similarity(lower(trim(p_query)), search_blob) > 0.4
    )
  order by
    (case when p_query is not null and length(trim(p_query)) > 0
          then word_similarity(lower(trim(p_query)), search_blob) else 0 end) desc,
    member_count desc,
    name asc
  limit greatest(coalesce(p_limit, 40), 0)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.search_shops(text, text, integer, integer) to anon, authenticated;

-- ===========================================================================
-- Notification triggers — reuse the Wave 1 notifications inbox for shop invites
-- and acceptances. SECURITY DEFINER (writes a notification for a DIFFERENT
-- profile than the one whose session fired the write), hardened with a pinned
-- empty search_path and EXECUTE revoked (trigger-only). Mirrors
-- 20260716050000_notification_triggers.sql.
-- ===========================================================================

-- Invite created (a manager invites an artist) -> notify the invited artist.
create or replace function public.notify_shop_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_profile_id uuid;
  v_shop_name text;
begin
  if new.role = 'owner' then
    return new; -- owner bootstrap row is not an invite
  end if;

  select ap.profile_id into v_member_profile_id
  from public.artist_profiles ap
  where ap.id = new.artist_profile_id;

  if v_member_profile_id is null then
    return new;
  end if;

  select s.name into v_shop_name from public.shops s where s.id = new.shop_id;

  insert into public.notifications (profile_id, type, title, body, action_url, data)
  values (
    v_member_profile_id,
    'shop_invite',
    'Shop invite',
    coalesce(v_shop_name, 'A shop') || ' invited you to join as a ' ||
      new.membership_mode::text || ' member.',
    '/settings?tab=shop',
    jsonb_build_object(
      'shop_id', new.shop_id,
      'shop_member_id', new.id,
      'membership_mode', new.membership_mode,
      'role', new.role
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_shop_invite on public.shop_members;
create trigger trg_notify_shop_invite
  after insert on public.shop_members
  for each row execute function public.notify_shop_invite();

-- Invite accepted (invited -> active by the artist) -> notify the shop owner.
create or replace function public.notify_shop_invite_accepted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_profile_id uuid;
  v_member_name text;
  v_shop_name text;
begin
  select oap.profile_id, s.name into v_owner_profile_id, v_shop_name
  from public.shops s
  join public.artist_profiles oap on oap.id = s.owner_artist_id
  where s.id = new.shop_id;

  if v_owner_profile_id is null then
    return new;
  end if;

  select coalesce(p.display_name, p.handle, 'An artist') into v_member_name
  from public.artist_profiles ap
  join public.profiles p on p.id = ap.profile_id
  where ap.id = new.artist_profile_id;

  insert into public.notifications (profile_id, type, title, body, action_url, data)
  values (
    v_owner_profile_id,
    'shop_invite_accepted',
    'Shop invite accepted',
    v_member_name || ' joined ' || coalesce(v_shop_name, 'your shop') || '.',
    '/studio/shop',
    jsonb_build_object(
      'shop_id', new.shop_id,
      'shop_member_id', new.id,
      'artist_profile_id', new.artist_profile_id
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_shop_invite_accepted on public.shop_members;
create trigger trg_notify_shop_invite_accepted
  after update on public.shop_members
  for each row
  when (old.status = 'invited' and new.status = 'active')
  execute function public.notify_shop_invite_accepted();

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'notify_shop_invite()',
    'notify_shop_invite_accepted()'
  ]
  loop
    execute format('revoke execute on function public.%s from public', fn);
    execute format('revoke execute on function public.%s from anon', fn);
    execute format('revoke execute on function public.%s from authenticated', fn);
  end loop;
end $$;
