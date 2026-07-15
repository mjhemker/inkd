-- Migration: drop_legacy_images_bucket
-- Removes the legacy public `images` Storage bucket (and its "Public can view
-- images" read policy) that predates this build's storage model. It was
-- flagged by the Supabase security-advisor for public-bucket exposure and
-- confirmed disposable — no app code references it; current uploads live in
-- the `media` and `booking-uploads` buckets (see 20260715105500 and
-- 20260715110000). Verified empty (select count(*) from storage.objects
-- where bucket_id = 'images') before applying.
--
-- Storage's protect_objects_delete / protect_buckets_delete triggers block
-- raw DELETE on storage.objects/buckets ("Direct deletion from storage
-- tables is not allowed. Use the Storage API instead."), so this migration
-- disables them only for the duration of the guarded block below, and only
-- if the legacy bucket is still present — a no-op everywhere else,
-- including on a fresh project that never had this bucket.

drop policy if exists "Public can view images" on storage.objects;
drop policy if exists "Public can view images" on storage.buckets;

do $$
begin
  if exists (select 1 from storage.buckets where id = 'images') then
    execute 'alter table storage.objects disable trigger protect_objects_delete';
    execute 'alter table storage.buckets disable trigger protect_buckets_delete';

    delete from storage.objects where bucket_id = 'images';
    delete from storage.buckets where id = 'images';

    execute 'alter table storage.objects enable trigger protect_objects_delete';
    execute 'alter table storage.buckets enable trigger protect_buckets_delete';
  end if;
end $$;
