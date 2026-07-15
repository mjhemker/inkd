-- Migration: booking_uploads_storage
-- Private Storage bucket for client reference uploads attached to booking
-- requests (images + documents, gated by the artist's upload-options policy).
--
-- Path convention: booking-uploads/<client_id>/<batch_id>/<filename>
-- so the FIRST path segment always identifies the owning client. RLS below is
-- built on that convention.
--
-- Access model (mirrors the booking_requests row RLS):
--   * a client may read/write/replace/delete files in their OWN folder;
--   * the target artist may READ a client's files once that client has sent
--     them a booking request (an existing booking_requests row links them).
-- Everything else is denied. The bucket is private; the app serves files via
-- short-lived signed URLs.

insert into storage.buckets (id, name, public)
values ('booking-uploads', 'booking-uploads', false)
on conflict (id) do nothing;

-- Client reads files in their own folder.
create policy "booking_uploads_client_read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'booking-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Target artist reads a client's files when a booking request links them.
create policy "booking_uploads_artist_read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'booking-uploads'
    and exists (
      select 1
      from public.booking_requests br
      where br.client_id::text = (storage.foldername(name))[1]
        and br.artist_id = (select public.current_artist_id())
    )
  );

-- Client uploads into their own folder.
create policy "booking_uploads_client_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'booking-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Client replaces files in their own folder.
create policy "booking_uploads_client_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'booking-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'booking-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Client removes files in their own folder (e.g. drops a reference pre-submit).
create policy "booking_uploads_client_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'booking-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
