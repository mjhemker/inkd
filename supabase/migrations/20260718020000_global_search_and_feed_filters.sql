-- Migration: global_search_and_feed_filters
-- Round 4 — founder feedback. Two backend needs:
--
--   1. Global search overlay (top-bar ⌘K). It searches ARTISTS (reuses
--      search_artists) and SHOPS (search_shops). search_shops was declared
--      SECURITY INVOKER and joins `profiles`, whose RLS policy references
--      booking_requests/bookings — tables the `anon` role has NO select grant
--      on. So search_shops raised "permission denied for table booking_requests"
--      for signed-out callers (identical to the bug fixed for search_artists in
--      20260717030000_discover_search_public_read). The search overlay is a
--      PUBLIC surface (mobile feed/discover are browsable signed-out), so we
--      harden search_shops to SECURITY DEFINER with an explicit `op.is_public`
--      guard. It already exposes only published shops + public owner data, so
--      running it as owner is safe and makes anon == authenticated results.
--
--   2. Feed filter panel. Beyond the style chip row, the feed gains a filter
--      panel: multi-style, location (city / near-me), price range, books-open.
--      Styles keep filtering by POST style (post_styles) in JS to stay in sync
--      with the chip row. The ARTIST-level filters (city/distance/price band/
--      books-open/state) are resolved server-side by feed_filter_artist_ids():
--      a lightweight SECURITY DEFINER function returning just the eligible
--      published-artist ids, which the feed intersects with its candidate posts.
--      Keeping this out of the default feed path means an unfiltered feed makes
--      zero extra calls (fast/unchanged); the RPC only runs when a location/
--      price/books filter is actually set.
--
-- No new tables, no new extensions. get_advisors run after apply.

-- ===========================================================================
-- 1. Harden search_shops: SECURITY INVOKER -> SECURITY DEFINER (+ is_public
--    guard). Body is otherwise identical to 20260717080000_shops.sql.
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
security definer
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
      -- Only public owner profiles surface a shop (preserve the visibility the
      -- anon RLS path enforced before this became SECURITY DEFINER).
      and op.is_public
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
-- 2. feed_filter_artist_ids: the feed panel's artist-level prefilter.
--    Returns published + public artist ids matching location/price/books-open/
--    state. SECURITY DEFINER for the same reason as search_artists (its join to
--    profiles would otherwise trip the anon booking_requests grant), exposing
--    nothing but ids of already-public artists.
-- ===========================================================================
create or replace function public.feed_filter_artist_ids(
  p_lat        double precision default null,
  p_lng        double precision default null,
  p_radius_km  double precision default null,
  p_price_min  integer          default null,
  p_price_max  integer          default null,
  p_books_open boolean          default null,
  p_state      text             default null
)
returns setof uuid
language sql
stable
security definer
set search_path = public, extensions
as $$
  with cand as (
    select
      ap.id                                    as artist_id,
      ap.accepts_new_clients                   as books_open,
      coalesce(loc.state::text, p.state::text) as state,
      loc.dist_m                               as dist_m,
      price.min_price_cents                    as min_price_cents
    from artist_profiles ap
    join profiles p on p.id = ap.profile_id
    left join lateral (
      select
        sl.state,
        case
          when p_lat is not null and p_lng is not null and sl.lat is not null and sl.lng is not null
          then earth_distance(ll_to_earth(p_lat, p_lng), ll_to_earth(sl.lat, sl.lng))
          else null
        end as dist_m
      from studio_locations sl
      where sl.artist_id = ap.id and sl.is_public
      order by
        (case
          when p_lat is not null and p_lng is not null and sl.lat is not null and sl.lng is not null
          then earth_distance(ll_to_earth(p_lat, p_lng), ll_to_earth(sl.lat, sl.lng))
          else null
        end) asc nulls last,
        sl.is_primary desc, sl.created_at asc
      limit 1
    ) loc on true
    left join lateral (
      select min(s.price_cents) as min_price_cents
      from services s
      where s.artist_id = ap.id and s.is_public
        and s.price_cents is not null and s.price_cents > 0
    ) price on true
    where ap.is_published and p.is_public
  )
  select artist_id
  from cand
  where (p_books_open is not true or books_open)
    and (p_state is null or state = p_state)
    and (
      (p_price_min is null and p_price_max is null)
      or (
        min_price_cents is not null
        and (p_price_min is null or min_price_cents >= p_price_min)
        and (p_price_max is null or min_price_cents <= p_price_max)
      )
    )
    and (
      p_radius_km is null or p_lat is null or p_lng is null
      or (dist_m is not null and (dist_m / 1000.0) <= p_radius_km)
    );
$$;

grant execute on function public.feed_filter_artist_ids(
  double precision, double precision, double precision, integer, integer, boolean, text
) to anon, authenticated;
