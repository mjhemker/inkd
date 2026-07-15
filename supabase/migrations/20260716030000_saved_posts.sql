-- Migration: saved_posts
-- Client "save for later" bookmarks on feed posts. Mirrors the post_likes
-- shape (composite PK, liker/saver-scoped RLS). One row per (profile, post).

create table public.saved_posts (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  post_id    uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, post_id)
);
create index saved_posts_profile_id_idx on public.saved_posts (profile_id, created_at desc);
create index saved_posts_post_id_idx on public.saved_posts (post_id);

alter table public.saved_posts enable row level security;

-- Saver manages their own saves; only the saver can read them (private bookmarks).
create policy saved_posts_select on public.saved_posts
  for select using (profile_id = (select auth.uid()));
create policy saved_posts_insert on public.saved_posts
  for insert with check (profile_id = (select auth.uid()));
create policy saved_posts_delete on public.saved_posts
  for delete using (profile_id = (select auth.uid()));
