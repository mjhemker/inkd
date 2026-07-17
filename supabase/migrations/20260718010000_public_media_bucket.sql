-- Round 4 avatar/profile fix — public-facing media bucket.
--
-- ROOT CAUSE this repairs: the `media` bucket was created private (public=false)
-- with an anon RLS SELECT policy on avatar/portfolio paths, intending
-- "per-path public read". But Supabase Storage's public download endpoint
-- (`/object/public/{bucket}/...`, which `getPublicUrl()` returns) gates on the
-- BUCKET's `public` flag, NOT on RLS. So every avatar/portfolio object served
-- via a public URL 404s regardless of the RLS policy. Chat/booking/aftercare
-- correctly use signed URLs and are unaffected — only the getPublicUrl consumers
-- (avatar, portfolio, posts, flash, IG import) were broken.
--
-- Fix: a dedicated PUBLIC bucket for public-facing media. Chat stays in the
-- private `media` bucket with signed URLs (privacy invariant preserved by
-- construction — public content and private content no longer share a bucket).
-- Path convention unchanged: {user_id}/avatar/…, {user_id}/portfolio/… ,
-- {user_id}/portfolio/posts/… , {user_id}/portfolio/flash/… — owner-scoped
-- writes anchored on the first path segment (= auth.uid()).
--
-- Idempotent: drop-if-exists guards on every policy; bucket upsert on conflict.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media-public',
  'media-public',
  true,
  15728640, -- 15 MB
  array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Read: anonymous public downloads are served by the bucket's `public` flag and
-- need NO RLS policy. We deliberately do NOT add a broad anon SELECT (that would
-- enable anon LISTING of the bucket — advisor `public_bucket_allows_listing`).
-- Only the owner gets a storage-API SELECT on their own folder.
drop policy if exists media_public_read_all on storage.objects;
drop policy if exists media_public_owner_read on storage.objects;
create policy media_public_owner_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'media-public'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Owner-scoped writes, anchored on the uid first path segment.
drop policy if exists media_public_owner_insert on storage.objects;
create policy media_public_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media-public'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists media_public_owner_update on storage.objects;
create policy media_public_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'media-public'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'media-public'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists media_public_owner_delete on storage.objects;
create policy media_public_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'media-public'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
