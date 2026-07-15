-- Migration: drop_legacy_tables
-- Drops all empty legacy prototype tables (confirmed 0 rows, disposable).
-- INKD schema v1 is rebuilt from scratch over these.

drop table if exists public.daily_highlights_interactions cascade;
drop table if exists public.daily_highlights cascade;
drop table if exists public.assistant_events cascade;
drop table if exists public.assistant_settings cascade;
drop table if exists public.post_likes cascade;
drop table if exists public.follows cascade;
drop table if exists public.comments cascade;
drop table if exists public.appointments cascade;
drop table if exists public.messages cascade;
drop table if exists public.portfolio cascade;
drop table if exists public.posts cascade;
drop table if exists public.users cascade;
