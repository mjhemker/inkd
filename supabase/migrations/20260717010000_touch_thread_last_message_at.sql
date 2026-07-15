-- Migration: touch_thread_last_message_at
-- Make `public.threads.last_message_at` authoritative instead of relying on the
-- best-effort client-side UPDATE in packages/core api/messaging.ts `sendMessage`
-- (which explicitly ignores RLS/no-op failures). The /messages inbox
-- (api/threadDirectory.ts) orders threads by `last_message_at`, so any message
-- insert path that can't or doesn't run that follow-up UPDATE — agent/server
-- authored messages, future edge-function inserts, or a swallowed failure —
-- leaves the thread's `last_message_at` NULL and the conversation sorted stale
-- at the bottom of the list. This installs a SECURITY DEFINER trigger that
-- bumps `last_message_at` (and `updated_at`) on every `messages` insert, then
-- backfills existing threads from their newest message to reconcile drift.
--
-- Hardening mirrors 20260716060100_post_like_count_trigger.sql: SECURITY
-- DEFINER with pinned `search_path = ''`, fully schema-qualified references,
-- and EXECUTE revoked from public/anon/authenticated (the function only ever
-- runs as a trigger body — the acting RLS session cannot always UPDATE the
-- thread row directly, which is the whole point).

create or replace function public.touch_thread_last_message_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.threads
    set last_message_at = new.created_at,
        updated_at = now()
    where id = new.thread_id
      and (last_message_at is null or last_message_at < new.created_at);
  return new;
end;
$$;

drop trigger if exists trg_touch_thread_last_message_at on public.messages;
create trigger trg_touch_thread_last_message_at
  after insert on public.messages
  for each row execute function public.touch_thread_last_message_at();

-- Reconcile existing threads with the authoritative newest-message timestamp.
update public.threads t
  set last_message_at = m.newest
  from (
    select thread_id, max(created_at) as newest
    from public.messages
    group by thread_id
  ) m
  where m.thread_id = t.id
    and (t.last_message_at is null or t.last_message_at < m.newest);

-- Trigger-only definer function: never callable directly over PostgREST RPC.
revoke execute on function public.touch_thread_last_message_at() from public;
revoke execute on function public.touch_thread_last_message_at() from anon;
revoke execute on function public.touch_thread_last_message_at() from authenticated;
