-- Migration: media_storage_bucket
-- Private `media` bucket for artist onboarding + settings uploads: avatars,
-- portfolio images, and misc studio media. Path convention is
--   {user_id}/avatar/<file>, {user_id}/portfolio/<file>, {user_id}/misc/<file>
-- so every object lives under the owner's uid folder (RLS anchor).
--
-- RLS: owners have full CRUD over their own {uid}/… folder; avatar + portfolio
-- paths are additionally world-readable (public artist profiles show them).
-- Writes are always owner-scoped; the bucket itself stays private (no listing).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  false,
  15728640, -- 15 MB
  array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Owner can read anything in their own folder.
drop policy if exists media_owner_read on storage.objects;
create policy media_owner_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Avatars + portfolio pieces are publicly readable (consumer discovery, SPEC §4).
drop policy if exists media_public_read on storage.objects;
create policy media_public_read on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[2] in ('avatar', 'portfolio')
  );

-- Owner-only writes, scoped to their {uid}/… folder.
drop policy if exists media_owner_insert on storage.objects;
create policy media_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists media_owner_update on storage.objects;
create policy media_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists media_owner_delete on storage.objects;
create policy media_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
