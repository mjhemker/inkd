-- Migration: availability_rules_multi_block
-- The weekly-hours editor persists one availability_rules row per open window,
-- so a single (artist_id, weekday) can carry MULTIPLE rows (split days such as
-- Tue 11:00–14:00 + 17:00–21:00). This migration makes that contract explicit
-- and efficient:
--   1. Defensively drop any legacy one-row-per-weekday UNIQUE constraint that
--      would forbid multiple blocks (none exists today; guarded for safety).
--   2. Add a composite index matching the editor's ordered read
--      (weekday, then start_time) for fast multi-block loads.
--   3. Document the multi-row contract on the table.

do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.availability_rules'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%weekday%'
  loop
    execute format('alter table public.availability_rules drop constraint %I', c.conname);
  end loop;
end $$;

create index if not exists availability_rules_artist_weekday_start_idx
  on public.availability_rules (artist_id, weekday, start_time);

comment on table public.availability_rules is
  'Weekly recurring business hours. MULTIPLE rows per (artist_id, weekday) are supported and expected — each row is one open window, so a weekday can hold several blocks (split shifts). No uniqueness on (artist_id, weekday).';
