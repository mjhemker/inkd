-- Migration: discover_search
-- Local discovery backend (SPEC §4: "local map + filters that actually work —
-- style × city × price band × availability"). Adds:
--   1. geocode_cache — normalized-address -> lat/lng cache (service-role only;
--      populated by the `geocode-location` edge function, Nominatim-backed).
--   2. search_artists() — the RLS-respecting (SECURITY INVOKER) discovery RPC
--      returning artist cards computed over published artists + public
--      locations/services/styles/flash + booking_policies, with earthdistance
--      distance and pg_trgm text ranking.
--
-- Extensions in use (installed earlier): extensions.cube + extensions.earthdistance
-- (great-circle distance via a GiST ll_to_earth index on studio_locations),
-- extensions.pg_trgm (fuzzy text). No new extensions required here.

-- ---------------------------------------------------------------------------
-- geocode_cache: dedupes Nominatim lookups. Keyed by a normalized address
-- string. Written only by the service role (edge function); no anon/auth
-- policies, so RLS denies all PostgREST access — intentional (server-only).
-- ---------------------------------------------------------------------------
create table if not exists public.geocode_cache (
  id            uuid primary key default gen_random_uuid(),
  query         text not null unique,   -- normalized address key
  lat           double precision,
  lng           double precision,
  display_name  text,
  provider      text not null default 'nominatim',
  hit_count     int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger geocode_cache_set_updated_at before update on public.geocode_cache
  for each row execute function public.set_updated_at();

alter table public.geocode_cache enable row level security;
-- (no policies: only the service role — which bypasses RLS — may read/write)

-- ---------------------------------------------------------------------------
-- search_artists: the discovery query. SECURITY INVOKER so the caller's RLS
-- applies (published artists + public child rows are the only rows visible to
-- anon/authenticated). Returns one card per published artist that has a handle.
--
-- Params (all optional / nullable so the client sends only active filters):
--   p_lat, p_lng     search center (e.g. a city quick-pick or device location)
--   p_radius_km      max distance from center; ignored when no center
--   p_style_slugs    require overlap with the artist's tagged styles
--   p_price_min/max  bound the artist's cheapest public priced service (cents)
--   p_books_open     when true, only artists accepting new clients
--   p_state          'MD' | 'PA' — match a public location OR the profile state
--   p_query          fuzzy text over name / handle / city / styles
--   p_limit/p_offset pagination
-- ---------------------------------------------------------------------------
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
security invoker
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
  )
  select
    artist_id, handle, display_name, avatar_url, styles, min_price_cents,
    city, state, lat, lng, distance_km, classification,
    travel_fly_out, travel_house_calls, travel_at_home, books_open, has_active_flash
  from cand
  where
    -- style overlap
    (p_style_slugs is null or styles && p_style_slugs)
    -- price band (exclude artists with no priced service when a band is set)
    and (
      (p_price_min is null and p_price_max is null)
      or (
        min_price_cents is not null
        and (p_price_min is null or min_price_cents >= p_price_min)
        and (p_price_max is null or min_price_cents <= p_price_max)
      )
    )
    -- books open
    and (p_books_open is not true or books_open)
    -- state
    and (p_state is null or state = p_state)
    -- radius (only meaningful with a center; excludes artists without coords)
    and (
      p_radius_km is null or p_lat is null or p_lng is null
      or (distance_km is not null and distance_km <= p_radius_km)
    )
    -- text query: exact substring (ILIKE) OR fuzzy per-word match (word_similarity
    -- measures the best-matching extent, so a typo like "realsm" still hits
    -- "realism" without being diluted by the rest of the blob).
    and (
      p_query is null or length(trim(p_query)) = 0
      or search_blob ilike '%' || lower(trim(p_query)) || '%'
      or word_similarity(lower(trim(p_query)), search_blob) > 0.4
    )
  order by
    -- nearest-first when a center is given
    (case when p_lat is not null and p_lng is not null then distance_km else null end) asc nulls last,
    -- best text match next when searching
    (case when p_query is not null and length(trim(p_query)) > 0
          then word_similarity(lower(trim(p_query)), search_blob) else 0 end) desc,
    -- then surface active flash + open books, then name
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
