-- Security/perf audit 2026-07 — covering indexes for unindexed foreign keys.
--
-- The database linter (get_advisors: unindexed_foreign_keys) flagged two FKs on
-- the newest shops tables that lack a covering index. Without one, a DELETE or
-- UPDATE on the referenced parent row triggers a sequential scan of the child
-- table to enforce the constraint. These are free wins; add them.
--
--   shops.primary_location_id  -> studio_locations(id)
--   shop_members.invited_by    -> artist_profiles(id)

create index if not exists shops_primary_location_id_idx
  on public.shops (primary_location_id);

create index if not exists shop_members_invited_by_idx
  on public.shop_members (invited_by);
