-- Migration: content_and_social
-- posts, post_styles, portfolio_pieces, flash_sheets, flash_items, reviews,
-- follows, post_likes.

-- ---------------------------------------------------------------------------
-- posts: feed content (Instagram-importable).
-- ---------------------------------------------------------------------------
create table public.posts (
  id                   uuid primary key default gen_random_uuid(),
  artist_id            uuid not null references public.artist_profiles (id) on delete cascade,
  caption              text,
  media                jsonb not null default '[]'::jsonb,
  cover_url            text,
  source               public.post_source not null default 'inkd',
  instagram_id         text,
  instagram_permalink  text,
  is_public            boolean not null default true,
  like_count           int not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index posts_artist_id_idx on public.posts (artist_id, created_at desc);
create index posts_public_idx on public.posts (created_at desc) where is_public;
create unique index posts_instagram_id_key on public.posts (artist_id, instagram_id) where instagram_id is not null;

create trigger posts_set_updated_at before update on public.posts
  for each row execute function public.set_updated_at();

-- post_styles: normalized post <-> style tags.
create table public.post_styles (
  post_id    uuid not null references public.posts (id) on delete cascade,
  style_id   uuid not null references public.styles (id) on delete cascade,
  artist_id  uuid not null references public.artist_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, style_id)
);
create index post_styles_style_id_idx on public.post_styles (style_id);
create index post_styles_artist_id_idx on public.post_styles (artist_id);

-- ---------------------------------------------------------------------------
-- portfolio_pieces: curated healed/portfolio work (Instagram-importable).
-- ---------------------------------------------------------------------------
create table public.portfolio_pieces (
  id          uuid primary key default gen_random_uuid(),
  artist_id   uuid not null references public.artist_profiles (id) on delete cascade,
  post_id     uuid references public.posts (id) on delete set null,
  title       text,
  description text,
  image_url   text,
  placement   text,
  style_tags  text[] not null default '{}',
  is_healed   boolean,
  is_public   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index portfolio_pieces_artist_id_idx on public.portfolio_pieces (artist_id, sort_order);
create index portfolio_pieces_post_id_idx on public.portfolio_pieces (post_id);

create trigger portfolio_pieces_set_updated_at before update on public.portfolio_pieces
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- flash_sheets + flash_items: pre-drawn designs available to book.
-- ---------------------------------------------------------------------------
create table public.flash_sheets (
  id          uuid primary key default gen_random_uuid(),
  artist_id   uuid not null references public.artist_profiles (id) on delete cascade,
  title       text,
  description text,
  cover_url   text,
  is_public   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index flash_sheets_artist_id_idx on public.flash_sheets (artist_id);

create trigger flash_sheets_set_updated_at before update on public.flash_sheets
  for each row execute function public.set_updated_at();

create table public.flash_items (
  id                   uuid primary key default gen_random_uuid(),
  flash_sheet_id       uuid not null references public.flash_sheets (id) on delete cascade,
  artist_id            uuid not null references public.artist_profiles (id) on delete cascade,
  title                text,
  image_url            text,
  price_cents          int,
  is_repeatable        boolean not null default false,
  is_available         boolean not null default true,
  placement_suggestion text,
  size_inches          numeric(5,2),
  sort_order           int not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index flash_items_flash_sheet_id_idx on public.flash_items (flash_sheet_id, sort_order);
create index flash_items_artist_id_idx on public.flash_items (artist_id);

create trigger flash_items_set_updated_at before update on public.flash_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- reviews: client reviews of artists (one per completed booking).
-- ---------------------------------------------------------------------------
create table public.reviews (
  id              uuid primary key default gen_random_uuid(),
  artist_id       uuid not null references public.artist_profiles (id) on delete cascade,
  client_id       uuid not null references public.profiles (id) on delete cascade,
  booking_id      uuid references public.bookings (id) on delete set null,
  rating          smallint not null check (rating between 1 and 5),
  title           text,
  body            text,
  artist_response text,
  is_public       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index reviews_booking_id_key on public.reviews (booking_id) where booking_id is not null;
create index reviews_artist_id_idx on public.reviews (artist_id);
create index reviews_client_id_idx on public.reviews (client_id);

create trigger reviews_set_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- follows + post_likes: lightweight social graph.
-- ---------------------------------------------------------------------------
create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  artist_id   uuid not null references public.artist_profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, artist_id)
);
create index follows_artist_id_idx on public.follows (artist_id);

create table public.post_likes (
  post_id    uuid not null references public.posts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);
create index post_likes_profile_id_idx on public.post_likes (profile_id);

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table public.posts            enable row level security;
alter table public.post_styles      enable row level security;
alter table public.portfolio_pieces enable row level security;
alter table public.flash_sheets     enable row level security;
alter table public.flash_items      enable row level security;
alter table public.reviews          enable row level security;
alter table public.follows          enable row level security;
alter table public.post_likes       enable row level security;

-- posts
create policy posts_select on public.posts
  for select using (is_public or artist_id = (select public.current_artist_id()));
create policy posts_insert on public.posts
  for insert with check (artist_id = (select public.current_artist_id()));
create policy posts_update on public.posts
  for update using (artist_id = (select public.current_artist_id()))
  with check (artist_id = (select public.current_artist_id()));
create policy posts_delete on public.posts
  for delete using (artist_id = (select public.current_artist_id()));

-- post_styles (public tags; owning artist manages)
create policy post_styles_select on public.post_styles
  for select using (true);
create policy post_styles_insert on public.post_styles
  for insert with check (artist_id = (select public.current_artist_id()));
create policy post_styles_delete on public.post_styles
  for delete using (artist_id = (select public.current_artist_id()));

-- portfolio_pieces
create policy portfolio_pieces_select on public.portfolio_pieces
  for select using (is_public or artist_id = (select public.current_artist_id()));
create policy portfolio_pieces_insert on public.portfolio_pieces
  for insert with check (artist_id = (select public.current_artist_id()));
create policy portfolio_pieces_update on public.portfolio_pieces
  for update using (artist_id = (select public.current_artist_id()))
  with check (artist_id = (select public.current_artist_id()));
create policy portfolio_pieces_delete on public.portfolio_pieces
  for delete using (artist_id = (select public.current_artist_id()));

-- flash_sheets
create policy flash_sheets_select on public.flash_sheets
  for select using (is_public or artist_id = (select public.current_artist_id()));
create policy flash_sheets_insert on public.flash_sheets
  for insert with check (artist_id = (select public.current_artist_id()));
create policy flash_sheets_update on public.flash_sheets
  for update using (artist_id = (select public.current_artist_id()))
  with check (artist_id = (select public.current_artist_id()));
create policy flash_sheets_delete on public.flash_sheets
  for delete using (artist_id = (select public.current_artist_id()));

-- flash_items
create policy flash_items_select on public.flash_items
  for select using (is_available or artist_id = (select public.current_artist_id()));
create policy flash_items_insert on public.flash_items
  for insert with check (artist_id = (select public.current_artist_id()));
create policy flash_items_update on public.flash_items
  for update using (artist_id = (select public.current_artist_id()))
  with check (artist_id = (select public.current_artist_id()));
create policy flash_items_delete on public.flash_items
  for delete using (artist_id = (select public.current_artist_id()));

-- reviews: public reviews visible to all; client authors; both parties may edit
-- (client edits body, artist adds response).
create policy reviews_select on public.reviews
  for select using (
    is_public
    or client_id = (select auth.uid())
    or artist_id = (select public.current_artist_id())
  );
create policy reviews_insert on public.reviews
  for insert with check (client_id = (select auth.uid()));
create policy reviews_update on public.reviews
  for update using (
    client_id = (select auth.uid()) or artist_id = (select public.current_artist_id())
  ) with check (
    client_id = (select auth.uid()) or artist_id = (select public.current_artist_id())
  );
create policy reviews_delete on public.reviews
  for delete using (client_id = (select auth.uid()));

-- follows: follower and the followed artist can see; follower manages.
create policy follows_select on public.follows
  for select using (
    follower_id = (select auth.uid()) or artist_id = (select public.current_artist_id())
  );
create policy follows_insert on public.follows
  for insert with check (follower_id = (select auth.uid()));
create policy follows_delete on public.follows
  for delete using (follower_id = (select auth.uid()));

-- post_likes: liker manages their own likes; liker and post owner can read.
create policy post_likes_select on public.post_likes
  for select using (
    profile_id = (select auth.uid())
    or exists (
      select 1 from public.posts p
      where p.id = post_likes.post_id and p.artist_id = (select public.current_artist_id())
    )
  );
create policy post_likes_insert on public.post_likes
  for insert with check (profile_id = (select auth.uid()));
create policy post_likes_delete on public.post_likes
  for delete using (profile_id = (select auth.uid()));
