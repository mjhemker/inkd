-- Migration: post_like_count_trigger
-- Make `public.posts.like_count` authoritative instead of client-maintained.
-- Feed cards read `posts.like_count` directly (packages/core api/feed.ts), and
-- the like/unlike helpers (api/social.ts) only insert/delete `post_likes` — so
-- without a server-side trigger the denormalized count drifts from reality.
-- This installs a SECURITY DEFINER trigger that increments/decrements
-- `posts.like_count` on every `post_likes` insert/delete, then backfills the
-- column from the true row counts to reconcile any pre-existing drift.
--
-- Hardening mirrors 20260715003100_harden_handle_new_user.sql and
-- 20260716050000_notification_triggers.sql: SECURITY DEFINER with pinned
-- `search_path = ''`, fully schema-qualified references, and EXECUTE revoked
-- from public/anon/authenticated (the function only ever runs as a trigger
-- body — the acting client's RLS session cannot UPDATE another artist's post
-- row directly, which is exactly why this must be definer-owned).

create or replace function public.sync_post_like_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts
      set like_count = like_count + 1
      where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.posts
      set like_count = greatest(0, like_count - 1)
      where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_sync_post_like_count_ins on public.post_likes;
create trigger trg_sync_post_like_count_ins
  after insert on public.post_likes
  for each row execute function public.sync_post_like_count();

drop trigger if exists trg_sync_post_like_count_del on public.post_likes;
create trigger trg_sync_post_like_count_del
  after delete on public.post_likes
  for each row execute function public.sync_post_like_count();

-- Reconcile the denormalized column with the authoritative row counts.
update public.posts p
  set like_count = coalesce(l.cnt, 0)
  from (
    select post_id, count(*)::int as cnt
    from public.post_likes
    group by post_id
  ) l
  where l.post_id = p.id;

update public.posts p
  set like_count = 0
  where not exists (
    select 1 from public.post_likes pl where pl.post_id = p.id
  ) and p.like_count <> 0;

-- Trigger-only definer function: never callable directly over PostgREST RPC.
revoke execute on function public.sync_post_like_count() from public;
revoke execute on function public.sync_post_like_count() from anon;
revoke execute on function public.sync_post_like_count() from authenticated;
