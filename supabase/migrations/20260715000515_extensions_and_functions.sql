-- Migration: extensions_and_functions
-- Enables extensions for geo lookups and shared trigger/helper functions.

-- Geo: cube + earthdistance power great-circle distance queries with a GiST
-- functional index on ll_to_earth(lat, lng). Installed in the `extensions`
-- schema per Supabase convention.
create extension if not exists cube with schema extensions;
create extension if not exists earthdistance with schema extensions;

-- Shared updated_at maintenance trigger.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Blocks UPDATE/DELETE on immutable records (signed waivers). Defense in depth
-- alongside the absence of update/delete RLS policies.
create or replace function public.prevent_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Records in % are immutable and cannot be modified or deleted', tg_table_name;
end;
$$;
