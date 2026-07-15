-- Migration: security_hardening
-- Resolves advisor findings after schema v1:
--  1. Drop orphaned legacy prototype functions (their tables were dropped).
--  2. Move pg_trgm out of the public schema (relocates its trgm functions too).
--  3. Pin search_path on our trigger functions.
--  4. Switch current_artist_id() from SECURITY DEFINER to SECURITY INVOKER
--     (removes RPC definer-exposure; RLS on artist_profiles already lets an
--     owner read their own row, so no recursion and no privilege escalation).
--  5. Revoke the anon role from strictly non-public tables (defense in depth;
--     these are only ever touched by authenticated clients/artists).

-- 1. Drop legacy prototype functions ----------------------------------------
drop function if exists public.decrement_comment_count(uuid);
drop function if exists public.decrement_like_count(uuid);
drop function if exists public.get_follower_count(uuid);
drop function if exists public.get_following_count(uuid);
drop function if exists public.increment_comment_count(uuid);
drop function if exists public.increment_like_count(uuid);
drop function if exists public.search_users(text, integer);
drop function if exists public.select_artist_of_day(date);
drop function if exists public.select_artwork_of_day(date);
drop function if exists public.trigger_image_processing();
drop function if exists public.update_post_comment_count();
drop function if exists public.update_updated_at_column();
drop function if exists public.update_user_search_vector();

-- 2. Relocate pg_trgm (legacy leftover) out of public -----------------------
alter extension pg_trgm set schema extensions;

-- 3. Pin search_path on our trigger functions -------------------------------
alter function public.set_updated_at() set search_path = '';
alter function public.prevent_mutation() set search_path = '';

-- 4. current_artist_id() as SECURITY INVOKER --------------------------------
create or replace function public.current_artist_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select id from public.artist_profiles where profile_id = (select auth.uid()) limit 1
$$;

-- 5. Revoke anon on private tables ------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'agent_actions','agent_settings','agent_playbooks','payments','signed_waivers',
    'notifications','messages','threads','bookings','sessions','booking_requests'
  ] loop
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
