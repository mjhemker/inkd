-- Migration: auth_user_profile_sync
-- Sync auth.users -> public.profiles. On every new auth user, create the
-- matching profiles row (1:1). SECURITY DEFINER so it can write to profiles
-- regardless of the caller; search_path pinned to '' (advisor-clean).
--
-- Duplicate-email note: with email confirmations enabled, Supabase Auth does
-- NOT create a second auth.users row for an already-registered email (it
-- returns an obfuscated user to prevent enumeration), so this trigger never
-- fires twice for the same identity. The `on conflict (id) do nothing` makes
-- it idempotent regardless, so an app-side profile bootstrap is safe too.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', '')
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
