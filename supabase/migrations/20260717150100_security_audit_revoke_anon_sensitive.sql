-- Security audit 2026-07 — remove over-broad table grants on never-public tables.
--
-- Supabase's default `GRANT ... ON ALL TABLES IN SCHEMA public` handed the
-- `anon` (and, for service-role-only tables, `authenticated`) role full table
-- privileges on tables that no anonymous/ordinary user should ever touch. Row
-- Level Security already denies every row to those roles (verified with
-- JWT-simulated deny-tests: anon and cross-tenant reads all return zero), so
-- this is defense-in-depth, not a live-leak fix — it removes the tables from the
-- anon/authenticated GraphQL surface and closes the advisor
-- `pg_graphql_*_table_exposed` findings for genuinely sensitive data.
--
-- Scope is deliberately narrow: ONLY tables whose RLS has no anon-satisfiable
-- path. Public-read tables (posts, profiles, artist_profiles, services,
-- studio_locations, styles, flash_*, portfolio_pieces, reviews, shops,
-- shop_members roster, image_tags for public subjects, ...) are untouched so
-- logged-out discovery keeps working.

-- 1) Client/artist-scoped or user-scoped tables — never for anonymous callers.
revoke all on table public.aftercare_checkins       from anon;
revoke all on table public.device_push_tokens        from anon;
revoke all on table public.notification_preferences  from anon;
revoke all on table public.daily_drops               from anon;
revoke all on table public.waitlist_entries          from anon;
revoke all on table public.waitlist_offers           from anon;
revoke all on table public.waitlist_openings         from anon;
revoke all on table public.instagram_import_runs     from anon;

-- 2) Service-role-only tables (RLS enabled, NO policies = deny-all to every
--    non-service role). Strip both anon AND authenticated so they leave the
--    public GraphQL schema entirely; the service role is unaffected (it bypasses
--    grants and RLS).
revoke all on table public.stripe_events             from anon, authenticated;
revoke all on table public.agent_jobs                from anon, authenticated;
revoke all on table public.image_tag_jobs            from anon, authenticated;
revoke all on table public.notification_deliveries   from anon, authenticated;
revoke all on table public.geocode_cache             from anon, authenticated;
revoke all on table public.instagram_connections     from anon, authenticated;
