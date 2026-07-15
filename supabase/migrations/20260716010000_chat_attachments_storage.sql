-- Migration: chat_attachments_storage
-- Enables image attachments in chat.
--
-- `messages.attachments jsonb not null default '[]'` already exists (added in
-- the messaging migration) and is exactly the shape app code needs — an array
-- of `{path, width?, height?, kind}` objects — so no column change is needed
-- here. The real blocker (documented in the Composer TODO(media-bucket)
-- markers) was storage RLS: the `media` bucket only grants public SELECT on
-- `avatar`/`portfolio` path segments and owner-only SELECT elsewhere, so a
-- thread's *other* participant could never read a sender's uploaded
-- attachment.
--
-- This migration adds a `chat/{thread_id}/{sender_id}/...` path convention
-- to the same `media` bucket, with:
--   - INSERT allowed to either thread participant, writing only under their
--     own sender folder (sender_id = the uploading auth.uid(), i.e. their
--     profiles.id -- the same identity for both the client and artist side).
--   - SELECT allowed to either thread participant, for any attachment in
--     that thread (chat images must be visible to both sides regardless of
--     who sent them) -- deliberately NOT public, unlike avatar/portfolio.
--
-- Path-segment comparisons always cast the *table* uuid to text
-- (`t.id::text = (storage.foldername(name))[2]`) rather than casting the
-- untrusted path segment to uuid, so a malformed/foreign path segment (e.g.
-- an avatar/portfolio object where segment 2 is literally "avatar") can never
-- throw a cast error inside the policy -- it just fails the comparison, same
-- style already used by `booking_uploads_artist_read` in the booking_uploads
-- storage migration.
--
-- Idempotent: safe to (re-)apply against a database where this already ran
-- (drop-if-exists guards on every policy).

comment on column public.messages.attachments is
  'Array of {path, width?, height?, kind} -- kind is currently always "image". '
  '`path` is a media-bucket storage object key. Chat attachments live under '
  'chat/{thread_id}/{sender_id}/... (see chat_attachments_storage migration) '
  'and require a signed URL to render -- they are not publicly readable.';

-- INSERT: a thread participant may write into their own sender folder inside
-- that thread's chat/ prefix.
drop policy if exists media_chat_insert on storage.objects;
create policy media_chat_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'chat'
    and (storage.foldername(name))[3] = (select auth.uid())::text
    and exists (
      select 1 from public.threads t
      where t.id::text = (storage.foldername(name))[2]
        and (
          t.client_id = (select auth.uid())
          or t.artist_id = (select public.current_artist_id())
        )
    )
  );

-- SELECT: either thread participant can read any attachment in that thread,
-- regardless of who uploaded it.
drop policy if exists media_chat_select on storage.objects;
create policy media_chat_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'chat'
    and exists (
      select 1 from public.threads t
      where t.id::text = (storage.foldername(name))[2]
        and (
          t.client_id = (select auth.uid())
          or t.artist_id = (select public.current_artist_id())
        )
    )
  );
