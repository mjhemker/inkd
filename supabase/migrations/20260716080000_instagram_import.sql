-- Migration: instagram_import
-- Instagram portfolio import scaffold (SPEC §0/§3). Key-gated: the schema is
-- real now; the edge functions that write to it (instagram-oauth,
-- instagram-import) only run once Michael sets IG_APP_ID/IG_APP_SECRET/
-- IG_REDIRECT_URL (see docs/instagram-integration.md).
--
--   instagram_connections  — one per artist, the OAuth token bundle. Pure
--     server-side infra (mirrors agent_jobs): RLS enabled, ZERO policies —
--     only the service-role edge functions ever touch it. The browser never
--     sees a raw token; instagram-oauth's `status` action returns a sanitized
--     view (username, timestamps) built by hand in code.
--   instagram_import_runs  — one row per import attempt, polled by the
--     settings UI for progress. Owner-select RLS (no secrets in this table).
--
-- portfolio_pieces gains an idempotency key so re-running an import never
-- duplicates a piece for the same IG media. `posts` already has
-- `instagram_id` + a unique (artist_id, instagram_id) index from
-- content_and_social — reused as-is for post idempotency.

create table public.instagram_connections (
  id                 uuid primary key default gen_random_uuid(),
  artist_id          uuid not null references public.artist_profiles (id) on delete cascade,
  ig_user_id         text not null,
  ig_username        text,
  access_token       text not null,
  token_expires_at   timestamptz not null,
  scopes             text[] not null default '{}',
  connected_at       timestamptz not null default now(),
  last_refreshed_at  timestamptz,
  last_synced_at     timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index instagram_connections_artist_id_key on public.instagram_connections (artist_id);

create trigger instagram_connections_set_updated_at before update on public.instagram_connections
  for each row execute function public.set_updated_at();

create table public.instagram_import_runs (
  id              uuid primary key default gen_random_uuid(),
  artist_id       uuid not null references public.artist_profiles (id) on delete cascade,
  status          text not null default 'pending'
                    check (status in ('pending', 'running', 'completed', 'failed')),
  media_seen      int not null default 0,
  posts_created   int not null default 0,
  pieces_created  int not null default 0,
  media_skipped   int not null default 0,
  already_imported int not null default 0,
  error_message   text,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);
create index instagram_import_runs_artist_id_idx on public.instagram_import_runs (artist_id, created_at desc);

alter table public.portfolio_pieces
  add column if not exists instagram_media_id text;
create unique index if not exists portfolio_pieces_instagram_media_id_key
  on public.portfolio_pieces (artist_id, instagram_media_id)
  where instagram_media_id is not null;

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table public.instagram_connections enable row level security;
alter table public.instagram_import_runs  enable row level security;

-- instagram_connections: default-deny, like agent_jobs. Only the service-role
-- edge functions read/write this table; no policy exposes it to a browser
-- session (the resulting rls_enabled_no_policy advisor INFO is intentional).

-- instagram_import_runs: owning artist may read their own import history
-- (no secrets in this table); all writes go through the service-role
-- instagram-import function.
create policy instagram_import_runs_select on public.instagram_import_runs
  for select using (artist_id = (select public.current_artist_id()));
