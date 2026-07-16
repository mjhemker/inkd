-- Migration: ai_image_tagging
-- AI image-understanding infrastructure (powers discovery style filters, the
-- later match-my-inspiration wave, and the daily drop). Artists NEVER tag
-- manually, so the discovery style facet is only as good as what this produces.
--
-- What it adds:
--   1. pgvector (`vector` in the extensions schema).
--   2. image_tags        — one structured-tag + embedding row per artist image
--      (polymorphic to portfolio_pieces / posts / flash_items via
--      (subject_type, subject_id)). Written ONLY by the service-role tag-image
--      edge function. RLS: readable where the parent image is public (or by the
--      owning artist for their own private images).
--   3. image_tag_jobs    — the durable tagging work queue (mirrors agent_jobs):
--      seeded with every existing image now, and fed by INSERT/image-change
--      triggers on the three content tables so NEW uploads + IG imports auto-
--      enqueue. `image_tag_jobs_lease` is the FOR UPDATE SKIP LOCKED drainer RPC.
--   4. similar_works()   — SECURITY DEFINER cosine-KNN over PUBLIC tagged images
--      for the match-inspiration wave to call with a query image's embedding.
--   5. search_artists()  — REPLACED (same signature/return) so the style facet
--      now unions AI image tags with manually-assigned artist_styles. Additive:
--      broader matches only; no existing caller changes.
--   6. image_tag_run_tick() + a guarded pg_cron drain (no-op until deployed +
--      Vault-configured, exactly like agent_run_tick).
--
-- The embedding is a DETERMINISTIC "semantic fingerprint" built from the tags
-- (styles × placement × color × subject) — Anthropic has no embeddings API and
-- we refuse to require another paid key. vector(256) matches VECTOR_DIM in
-- supabase/functions/_shared/image-tagging.ts; swapping in a real CLIP/text
-- embedding later is a code+re-tag change with this schema untouched.

-- ---------------------------------------------------------------------------
-- 0. pgvector.
-- ---------------------------------------------------------------------------
create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Enums.
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.image_subject_type as enum ('portfolio_piece', 'post', 'flash_item');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.image_color_type as enum ('color', 'black_grey', 'both', 'unknown');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.image_size_estimate as enum ('small', 'medium', 'large', 'unknown');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. image_tags — the structured tags + embedding per image.
--    styles + style_confidences are PARALLEL arrays (styles[i] has confidence
--    style_confidences[i]); styles is a plain text[] so the discovery facet can
--    use array overlap (&&). artist_id is denormalized for cheap RLS + facet
--    aggregation. embedding is NULL for untaggable images (e.g. "not a tattoo").
-- ---------------------------------------------------------------------------
create table public.image_tags (
  id                uuid primary key default gen_random_uuid(),
  subject_type      public.image_subject_type not null,
  subject_id        uuid not null,
  artist_id         uuid references public.artist_profiles (id) on delete cascade,
  image_url         text,
  styles            text[]  not null default '{}',
  style_confidences real[]  not null default '{}',
  placement         text[]  not null default '{}',
  color_type        public.image_color_type   not null default 'unknown',
  size_estimate     public.image_size_estimate not null default 'unknown',
  subject_matter    text[]  not null default '{}',
  description        text,
  embedding         extensions.vector(256),
  model_version     text    not null,
  tagged_at         timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (subject_type, subject_id)
);
create index image_tags_artist_id_idx on public.image_tags (artist_id);
create index image_tags_styles_gin on public.image_tags using gin (styles);
create index image_tags_color_idx on public.image_tags (color_type);
-- Cosine-KNN index for similar_works. HNSW builds on an empty table (unlike
-- ivfflat, which needs rows to train lists) and gives strong recall out of the box.
create index image_tags_embedding_hnsw on public.image_tags
  using hnsw (embedding extensions.vector_cosine_ops);

create trigger image_tags_set_updated_at before update on public.image_tags
  for each row execute function public.set_updated_at();

alter table public.image_tags enable row level security;

-- Readable where the parent image is public, or by the owning artist (their own
-- images, public or not). No write policies: only the service-role tag-image
-- function writes here (mirrors agent_jobs / stripe_events).
create policy image_tags_select on public.image_tags
  for select using (
    artist_id = (select public.current_artist_id())
    or (subject_type = 'portfolio_piece' and exists (
      select 1 from public.portfolio_pieces pp where pp.id = subject_id and pp.is_public))
    or (subject_type = 'post' and exists (
      select 1 from public.posts po where po.id = subject_id and po.is_public))
    or (subject_type = 'flash_item' and exists (
      select 1 from public.flash_items fi where fi.id = subject_id and fi.is_available))
  );

-- ---------------------------------------------------------------------------
-- 3. image_tag_jobs — durable tagging queue (mirrors agent_jobs). RLS default-
--    deny; only the service role touches it.
-- ---------------------------------------------------------------------------
create table public.image_tag_jobs (
  id            uuid primary key default gen_random_uuid(),
  subject_type  public.image_subject_type not null,
  subject_id    uuid not null,
  artist_id     uuid references public.artist_profiles (id) on delete cascade,
  image_url     text,
  status        text not null default 'pending'
                  check (status in ('pending', 'running', 'done', 'failed', 'skipped')),
  attempts      int  not null default 0,
  max_attempts  int  not null default 3,
  dedupe_key    text not null,
  last_error    text,
  scheduled_at  timestamptz not null default now(),
  leased_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index image_tag_jobs_dedupe_key_key on public.image_tag_jobs (dedupe_key);
create index image_tag_jobs_pending_idx on public.image_tag_jobs (scheduled_at)
  where status = 'pending';
create index image_tag_jobs_artist_id_idx on public.image_tag_jobs (artist_id);

create trigger image_tag_jobs_set_updated_at before update on public.image_tag_jobs
  for each row execute function public.set_updated_at();

alter table public.image_tag_jobs enable row level security;
-- (no policies by design; service role only — the rls_enabled_no_policy advisor
-- INFO is intentional, same as agent_jobs / instagram_connections.)

-- Atomic batch lease for the drainer (FOR UPDATE SKIP LOCKED). service_role only.
create or replace function public.image_tag_jobs_lease(p_limit int default 10)
returns setof public.image_tag_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.image_tag_jobs j
     set status = 'running',
         attempts = j.attempts + 1,
         leased_at = now(),
         updated_at = now()
   where j.id in (
     select c.id
     from public.image_tag_jobs c
     where c.status = 'pending' and c.attempts < c.max_attempts
     order by c.scheduled_at
     limit greatest(1, coalesce(p_limit, 10))
     for update skip locked
   )
  returning j.*;
end;
$$;

revoke execute on function public.image_tag_jobs_lease(int) from public;
revoke execute on function public.image_tag_jobs_lease(int) from anon;
revoke execute on function public.image_tag_jobs_lease(int) from authenticated;
grant execute on function public.image_tag_jobs_lease(int) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Auto-enqueue on new images + image changes. ONE generic SECURITY DEFINER
--    trigger via to_jsonb(new) so it works across all three content tables
--    (they use different image columns: image_url vs cover_url). Covers manual
--    uploads AND Instagram imports (both just INSERT rows) with zero edits to
--    either code path. Idempotent by dedupe_key; a changed image re-queues.
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_image_tag_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subject_type public.image_subject_type;
  v_image        text;
  v_row          jsonb := to_jsonb(new);
begin
  case tg_table_name
    when 'portfolio_pieces' then
      v_subject_type := 'portfolio_piece'; v_image := v_row->>'image_url';
    when 'posts' then
      v_subject_type := 'post';            v_image := v_row->>'cover_url';
    when 'flash_items' then
      v_subject_type := 'flash_item';      v_image := v_row->>'image_url';
    else
      return new;
  end case;

  if v_image is null or v_image = '' then
    return new;
  end if;

  insert into public.image_tag_jobs
    (subject_type, subject_id, artist_id, image_url, dedupe_key)
  values
    (v_subject_type, (v_row->>'id')::uuid, (v_row->>'artist_id')::uuid, v_image,
     v_subject_type::text || ':' || (v_row->>'id'))
  on conflict (dedupe_key) do update
    set image_url    = excluded.image_url,
        status       = 'pending',
        attempts     = 0,
        last_error   = null,
        scheduled_at = now(),
        updated_at   = now()
    where public.image_tag_jobs.image_url is distinct from excluded.image_url;

  return new;
end;
$$;

revoke execute on function public.enqueue_image_tag_job() from public;
revoke execute on function public.enqueue_image_tag_job() from anon;
revoke execute on function public.enqueue_image_tag_job() from authenticated;

create trigger trg_enqueue_image_tag_portfolio_ins
  after insert on public.portfolio_pieces
  for each row execute function public.enqueue_image_tag_job();
create trigger trg_enqueue_image_tag_portfolio_upd
  after update of image_url on public.portfolio_pieces
  for each row when (old.image_url is distinct from new.image_url)
  execute function public.enqueue_image_tag_job();

create trigger trg_enqueue_image_tag_post_ins
  after insert on public.posts
  for each row execute function public.enqueue_image_tag_job();
create trigger trg_enqueue_image_tag_post_upd
  after update of cover_url on public.posts
  for each row when (old.cover_url is distinct from new.cover_url)
  execute function public.enqueue_image_tag_job();

create trigger trg_enqueue_image_tag_flash_ins
  after insert on public.flash_items
  for each row execute function public.enqueue_image_tag_job();
create trigger trg_enqueue_image_tag_flash_upd
  after update of image_url on public.flash_items
  for each row when (old.image_url is distinct from new.image_url)
  execute function public.enqueue_image_tag_job();

-- ---------------------------------------------------------------------------
-- 5. Backfill helper + seed. enqueue_untagged_images() enqueues every image that
--    has no image_tags row yet and no live job — callable by ops / the batch
--    function on first deploy. service_role only. Then we seed it once now so
--    the queue is populated the moment tag-image is deployed with the key.
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_untagged_images()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with candidates as (
    select 'portfolio_piece'::public.image_subject_type as st, pp.id, pp.artist_id, pp.image_url as img
      from public.portfolio_pieces pp where pp.image_url is not null and pp.image_url <> ''
    union all
    select 'post'::public.image_subject_type, po.id, po.artist_id, po.cover_url
      from public.posts po where po.cover_url is not null and po.cover_url <> ''
    union all
    select 'flash_item'::public.image_subject_type, fi.id, fi.artist_id, fi.image_url
      from public.flash_items fi where fi.image_url is not null and fi.image_url <> ''
  ),
  ins as (
    insert into public.image_tag_jobs (subject_type, subject_id, artist_id, image_url, dedupe_key)
    select c.st, c.id, c.artist_id, c.img, c.st::text || ':' || c.id::text
    from candidates c
    where not exists (
      select 1 from public.image_tags it where it.subject_type = c.st and it.subject_id = c.id
    )
    on conflict (dedupe_key) do nothing
    returning 1
  )
  select count(*) into v_count from ins;
  return v_count;
end;
$$;

revoke execute on function public.enqueue_untagged_images() from public;
revoke execute on function public.enqueue_untagged_images() from anon;
revoke execute on function public.enqueue_untagged_images() from authenticated;
grant execute on function public.enqueue_untagged_images() to service_role;

-- Seed the queue now (idempotent — re-running the migration wouldn't duplicate).
select public.enqueue_untagged_images();

-- ---------------------------------------------------------------------------
-- 6. similar_works — cosine-KNN over PUBLIC tagged images for match-inspiration.
--    SECURITY DEFINER (like search_artists) with an EXPLICIT publicness filter,
--    so anon + authenticated get identical, safe results without depending on
--    per-role grants. Caller passes the query image's embedding (built by
--    tag-image / _shared/image-tagging.ts) as a pgvector literal.
-- ---------------------------------------------------------------------------
create or replace function public.similar_works(
  p_embedding      extensions.vector(256),
  p_limit          integer default 20,
  p_exclude_artist uuid    default null,
  p_style_slugs    text[]  default null
)
returns table (
  subject_type   public.image_subject_type,
  subject_id     uuid,
  artist_id      uuid,
  image_url      text,
  styles         text[],
  color_type     public.image_color_type,
  similarity     double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    it.subject_type,
    it.subject_id,
    it.artist_id,
    it.image_url,
    it.styles,
    it.color_type,
    (1 - (it.embedding <=> p_embedding))::double precision as similarity
  from image_tags it
  where it.embedding is not null
    and (p_exclude_artist is null or it.artist_id is distinct from p_exclude_artist)
    and (p_style_slugs is null or it.styles && p_style_slugs)
    and (
      (it.subject_type = 'portfolio_piece' and exists (
        select 1 from portfolio_pieces pp where pp.id = it.subject_id and pp.is_public))
      or (it.subject_type = 'post' and exists (
        select 1 from posts po where po.id = it.subject_id and po.is_public))
      or (it.subject_type = 'flash_item' and exists (
        select 1 from flash_items fi where fi.id = it.subject_id and fi.is_available))
    )
  order by it.embedding <=> p_embedding
  limit greatest(coalesce(p_limit, 20), 0);
$$;

grant execute on function public.similar_works(extensions.vector, integer, uuid, text[])
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. search_artists — REPLACED so the style facet unions AI image tags with the
--    manually-assigned artist_styles. Same signature + return shape; the ONLY
--    change is the `sty` lateral (now a union that also pulls distinct style
--    slugs from the artist's PUBLIC image_tags). Everything else is byte-for-
--    byte the prior definition (20260717030000_discover_search_public_read).
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
    -- STYLES: manually-assigned artist_styles UNION AI-derived tags from the
    -- artist's PUBLIC images. This is the whole point of the AI lane — an artist
    -- who never tags still becomes discoverable by the styles their work shows.
    left join lateral (
      select array_agg(distinct slug order by slug) as slugs
      from (
        select st.slug
        from artist_styles asx
        join styles st on st.id = asx.style_id
        where asx.artist_id = ap.id
        union
        select s2 as slug
        from image_tags it
        cross join lateral unnest(it.styles) as s2
        where it.artist_id = ap.id
          and (
            (it.subject_type = 'portfolio_piece' and exists (
              select 1 from portfolio_pieces pp where pp.id = it.subject_id and pp.is_public))
            or (it.subject_type = 'post' and exists (
              select 1 from posts po where po.id = it.subject_id and po.is_public))
            or (it.subject_type = 'flash_item' and exists (
              select 1 from flash_items fi where fi.id = it.subject_id and fi.is_available))
          )
      ) u
    ) sty on true
    where ap.is_published
      and p.handle is not null
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

-- ---------------------------------------------------------------------------
-- 8. Guarded pg_cron drain for the tagging queue (mirrors agent_run_tick). Safe
--    to schedule NOW: no-ops while the queue is empty OR the Vault secrets are
--    absent, so nothing fires against a missing endpoint before tag-image is
--    deployed. Reuses the `agent_runner_service_key` bearer; needs a new
--    `image_tagger_url` Vault secret (documented in docs/ai-image-tagging.md).
-- ---------------------------------------------------------------------------
create or replace function public.image_tag_run_tick()
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
  select count(*) into v_pending
  from public.image_tag_jobs
  where status = 'pending' and attempts < max_attempts;

  if coalesce(v_pending, 0) = 0 then
    return;
  end if;

  begin
    select decrypted_secret into v_url
      from vault.decrypted_secrets where name = 'image_tagger_url';
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
    body    := jsonb_build_object('mode', 'batch', 'source', 'pg_cron')
  );
end;
$$;

revoke execute on function public.image_tag_run_tick() from public;
revoke execute on function public.image_tag_run_tick() from anon;
revoke execute on function public.image_tag_run_tick() from authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'image-tag-drain') then
      perform cron.unschedule('image-tag-drain');
    end if;
    -- Every 2 minutes; the tick self-guards on empty queue / missing secrets.
    perform cron.schedule('image-tag-drain', '*/2 * * * *', 'select public.image_tag_run_tick();');
  end if;
end $$;
