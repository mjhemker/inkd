-- Migration: discover_search_public_read
-- Fixes discovery returning ZERO artists for logged-out visitors (SPEC §4:
-- discovery is a public surface — anyone can browse the local map + list).
--
-- ROOT CAUSE: search_artists() was SECURITY INVOKER, so it ran under the
-- caller's RLS. Its join to `profiles` triggers the `profiles_select` policy,
-- whose USING clause references `booking_requests` and `bookings`:
--   is_public OR id = auth.uid()
--     OR EXISTS (SELECT 1 FROM booking_requests br WHERE ... )
--     OR EXISTS (SELECT 1 FROM bookings b WHERE ... )
-- The `anon` role has NO SELECT grant on booking_requests / bookings, so the
-- planner's privilege check on those tables raised
--   "permission denied for table booking_requests"
-- and the whole RPC errored for anon — surfaced in the UI as "0 artists / no
-- artists match". Authenticated users (who DO hold those grants) were fine, so
-- the bug only bit signed-out visitors and was easy to miss in dev.
--
-- FIX: make search_artists SECURITY DEFINER. The function is already written to
-- expose ONLY the public discovery card — published artists (ap.is_published),
-- public profiles (added below: p.is_public), and public child rows
-- (studio_locations.is_public, services.is_public, flash_sheets.is_public). It
-- returns no private data, so running it as owner is safe and makes anon and
-- authenticated return IDENTICAL results without depending on per-role grants
-- to unrelated booking tables. search_path stays pinned (DEFINER hardening).
--
-- The p.is_public guard is added so DEFINER preserves the exact visibility the
-- anon RLS path intended (only public profiles are discoverable) — it does not
-- widen exposure.

create or replace function public.search_artists(
  p_lat         double precision default null,
  p_lng         double precision default null,
  p_radius_km   double precision default null,
  p_style_slugs text[]           default null,
  p_price_min   integer          default null,
  p_price_max   integer          default null,
  p_books_open  boolean          default null,
  p_state       text             default null,
  p_query       text             default null,
  p_limit       integer          default 40,
  p_offset      integer          default 0
)
returns table (
  artist_id          uuid,
  handle             text,
  display_name       text,
  avatar_url         text,
  styles             text[],
  min_price_cents    integer,
  city               text,
  state              text,
  lat                double precision,
  lng                double precision,
  distance_km        double precision,
  classification     public.artist_classification,
  travel_fly_out     boolean,
  travel_house_calls boolean,
  travel_at_home     boolean,
  books_open         boolean,
  has_active_flash   boolean
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with cand as (
    select
      ap.id                             as artist_id,
      p.handle                          as handle,
      coalesce(p.display_name, p.handle) as display_name,
      p.avatar_url                      as avatar_url,
      coalesce(sty.slugs, '{}')         as styles,
      price.min_price_cents             as min_price_cents,
      coalesce(loc.city, p.city)        as city,
      coalesce(loc.state::text, p.state::text) as state,
      loc.lat                           as lat,
      loc.lng                           as lng,
      case
        when loc.dist_m is not null then round((loc.dist_m / 1000.0)::numeric, 2)::double precision
        else null
      end                               as distance_km,
      ap.classification                 as classification,
      ap.travel_fly_out                 as travel_fly_out,
      ap.travel_house_calls             as travel_house_calls,
      ap.travel_at_home                 as travel_at_home,
      ap.accepts_new_clients            as books_open,
      exists (
        select 1
        from flash_items fi
        join flash_sheets fs on fs.id = fi.flash_sheet_id
        where fi.artist_id = ap.id and fi.is_available and fs.is_public
      )                                 as has_active_flash,
      lower(
        concat_ws(' ',
          coalesce(p.display_name, ''), coalesce(p.handle, ''),
          coalesce(loc.city, p.city, ''), array_to_string(coalesce(sty.slugs, '{}'), ' '))
      )                                 as search_blob
    from artist_profiles ap
    join profiles p on p.id = ap.profile_id
    left join lateral (
      select
        sl.city, sl.state, sl.lat, sl.lng,
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
    left join lateral (
      select array_agg(st.slug order by st.slug) as slugs
      from artist_styles asx
      join styles st on st.id = asx.style_id
      where asx.artist_id = ap.id
    ) sty on true
    where ap.is_published
      and p.handle is not null
      -- Only public profiles are discoverable. Preserves the visibility the
      -- anon RLS path enforced before this function became SECURITY DEFINER.
      and p.is_public
  )
  select
    artist_id, handle, display_name, avatar_url, styles, min_price_cents,
    city, state, lat, lng, distance_km, classification,
    travel_fly_out, travel_house_calls, travel_at_home, books_open, has_active_flash
  from cand
  where
    (p_style_slugs is null or styles && p_style_slugs)
    and (
      (p_price_min is null and p_price_max is null)
      or (
        min_price_cents is not null
        and (p_price_min is null or min_price_cents >= p_price_min)
        and (p_price_max is null or min_price_cents <= p_price_max)
      )
    )
    and (p_books_open is not true or books_open)
    and (p_state is null or state = p_state)
    and (
      p_radius_km is null or p_lat is null or p_lng is null
      or (distance_km is not null and distance_km <= p_radius_km)
    )
    and (
      p_query is null or length(trim(p_query)) = 0
      or search_blob ilike '%' || lower(trim(p_query)) || '%'
      or word_similarity(lower(trim(p_query)), search_blob) > 0.4
    )
  order by
    (case when p_lat is not null and p_lng is not null then distance_km else null end) asc nulls last,
    (case when p_query is not null and length(trim(p_query)) > 0
          then word_similarity(lower(trim(p_query)), search_blob) else 0 end) desc,
    has_active_flash desc,
    books_open desc,
    display_name asc
  limit greatest(coalesce(p_limit, 40), 0)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.search_artists(
  double precision, double precision, double precision, text[], integer, integer,
  boolean, text, text, integer, integer
) to anon, authenticated;
