-- Migration: realtime_messages_publication
-- Chat realtime never fired live because `public.messages` was missing from the
-- `supabase_realtime` publication (only `notifications` was added, by
-- 20260716050000_notification_triggers.sql). The web/mobile chat threads
-- subscribe to postgres_changes on INSERT into `messages`, so without
-- publication membership no live message events are delivered. This adds
-- `messages` and re-confirms `notifications`, each guarded so a re-run is a
-- no-op rather than a "table is already member" error.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
