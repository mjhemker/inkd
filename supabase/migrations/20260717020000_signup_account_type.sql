-- Migration: signup_account_type
-- Extend handle_new_user() so the account-type chosen at sign-up ("I'm getting
-- tattooed" = client vs "I'm a tattoo artist" = artist) survives the email
-- confirmation round-trip. The choice is stamped into auth user metadata as
-- `account_type` by signUpWithPassword(); here we read it and set
-- profiles.is_artist accordingly on the initial profile insert.
--
-- Notes:
--  * We only set is_artist at creation; a NULL/absent/unknown value falls back
--    to the column default (false = client). No existing rows are touched.
--  * is_artist=true here just flags the account as an artist for routing/nav; the
--    artist_profiles row + onboarding are still created lazily by becomeArtist()
--    (useEnsureArtist) when the artist reaches /onboarding.
--  * Still SECURITY DEFINER with search_path pinned to '' (advisor-clean), and
--    still trigger-only (EXECUTE stays revoked from the API roles).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, is_artist)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', '')
    ),
    coalesce(new.raw_user_meta_data ->> 'account_type', 'client') = 'artist'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
