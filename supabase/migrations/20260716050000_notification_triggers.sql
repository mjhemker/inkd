-- Migration: notification_triggers
-- Fan-out triggers that write rows into `public.notifications` on the events
-- that matter to a user's inbox. Each trigger function is SECURITY DEFINER
-- (it must write a notification for a DIFFERENT profile than the one whose
-- RLS session fired the underlying insert/update — e.g. a client's booking
-- request write has to notify the artist, whose `notifications_insert`
-- policy the client's session could never satisfy). Hardening mirrors
-- 20260715003100_harden_handle_new_user.sql: pinned `search_path = ''` with
-- fully schema-qualified references, and EXECUTE revoked from anon/
-- authenticated/public so these can never be invoked directly over PostgREST
-- RPC — they only ever run as trigger bodies.

-- ---------------------------------------------------------------------------
-- 1. New booking_request -> notify the artist.
-- ---------------------------------------------------------------------------
create or replace function public.notify_new_booking_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_artist_profile_id uuid;
  v_client_name text;
begin
  select ap.profile_id into v_artist_profile_id
  from public.artist_profiles ap
  where ap.id = new.artist_id;

  if v_artist_profile_id is null then
    return new;
  end if;

  select coalesce(p.display_name, 'A client') into v_client_name
  from public.profiles p
  where p.id = new.client_id;

  insert into public.notifications (profile_id, type, title, body, action_url, data)
  values (
    v_artist_profile_id,
    'booking_request_new',
    'New booking request',
    v_client_name || ' sent you a booking request.',
    '/bookings/requests/' || new.id,
    jsonb_build_object(
      'booking_request_id', new.id,
      'client_id', new.client_id
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_new_booking_request on public.booking_requests;
create trigger trg_notify_new_booking_request
  after insert on public.booking_requests
  for each row execute function public.notify_new_booking_request();

-- ---------------------------------------------------------------------------
-- 2. booking_request status -> accepted/declined -> notify the client.
-- ---------------------------------------------------------------------------
create or replace function public.notify_booking_request_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_artist_name text;
  v_title text;
  v_body text;
begin
  select coalesce(p.display_name, 'Your artist') into v_artist_name
  from public.artist_profiles ap
  join public.profiles p on p.id = ap.profile_id
  where ap.id = new.artist_id;

  if new.status = 'accepted' then
    v_title := 'Booking request accepted';
    v_body := v_artist_name || ' accepted your booking request.';
  else
    v_title := 'Booking request declined';
    v_body := v_artist_name || ' declined your booking request.';
  end if;

  insert into public.notifications (profile_id, type, title, body, action_url, data)
  values (
    new.client_id,
    'booking_request_' || new.status::text,
    v_title,
    v_body,
    '/bookings/requests/' || new.id,
    jsonb_build_object(
      'booking_request_id', new.id,
      'artist_id', new.artist_id,
      'status', new.status
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_booking_request_status_change on public.booking_requests;
create trigger trg_notify_booking_request_status_change
  after update on public.booking_requests
  for each row
  when (
    new.status is distinct from old.status
    and new.status in ('accepted', 'declined')
  )
  execute function public.notify_booking_request_status_change();

-- ---------------------------------------------------------------------------
-- 3. New session scheduled -> notify the client.
-- ---------------------------------------------------------------------------
create or replace function public.notify_new_session_scheduled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_artist_name text;
begin
  select coalesce(p.display_name, 'Your artist') into v_artist_name
  from public.artist_profiles ap
  join public.profiles p on p.id = ap.profile_id
  where ap.id = new.artist_id;

  insert into public.notifications (profile_id, type, title, body, action_url, data)
  values (
    new.client_id,
    'session_scheduled',
    'Session scheduled',
    'Session #' || new.session_number || ' with ' || v_artist_name ||
      case
        when new.scheduled_start is not null
          then ' on ' || to_char(new.scheduled_start, 'FMMonth FMDD, YYYY')
        else ''
      end || '.',
    '/bookings/' || new.booking_id,
    jsonb_build_object(
      'session_id', new.id,
      'booking_id', new.booking_id,
      'artist_id', new.artist_id
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_new_session_scheduled on public.sessions;
create trigger trg_notify_new_session_scheduled
  after insert on public.sessions
  for each row execute function public.notify_new_session_scheduled();

-- ---------------------------------------------------------------------------
-- 4. payments: kind = deposit, status = succeeded -> notify the artist.
-- Split into an INSERT trigger (already-succeeded on write, e.g. test-mode
-- webhooks that resolve synchronously) and an UPDATE trigger (async webhook
-- flips a pending row to succeeded) so we never reference OLD on INSERT.
-- ---------------------------------------------------------------------------
create or replace function public.notify_deposit_succeeded()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_artist_profile_id uuid;
  v_client_name text;
begin
  select ap.profile_id into v_artist_profile_id
  from public.artist_profiles ap
  where ap.id = new.artist_id;

  if v_artist_profile_id is null then
    return new;
  end if;

  select coalesce(p.display_name, 'A client') into v_client_name
  from public.profiles p
  where p.id = new.client_id;

  insert into public.notifications (profile_id, type, title, body, action_url, data)
  values (
    v_artist_profile_id,
    'payment_deposit_received',
    'Deposit received',
    v_client_name || ' paid a $' ||
      to_char(new.amount_cents::numeric / 100.0, 'FM999,999,990.00') ||
      ' deposit.',
    case when new.booking_id is not null then '/bookings/' || new.booking_id else null end,
    jsonb_build_object(
      'payment_id', new.id,
      'booking_id', new.booking_id,
      'amount_cents', new.amount_cents
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_deposit_succeeded_insert on public.payments;
create trigger trg_notify_deposit_succeeded_insert
  after insert on public.payments
  for each row
  when (new.kind = 'deposit' and new.status = 'succeeded')
  execute function public.notify_deposit_succeeded();

drop trigger if exists trg_notify_deposit_succeeded_update on public.payments;
create trigger trg_notify_deposit_succeeded_update
  after update on public.payments
  for each row
  when (
    new.kind = 'deposit' and new.status = 'succeeded'
    and old.status is distinct from new.status
  )
  execute function public.notify_deposit_succeeded();

-- ---------------------------------------------------------------------------
-- 5. New review -> notify the artist.
-- ---------------------------------------------------------------------------
create or replace function public.notify_new_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_artist_profile_id uuid;
  v_client_name text;
begin
  select ap.profile_id into v_artist_profile_id
  from public.artist_profiles ap
  where ap.id = new.artist_id;

  if v_artist_profile_id is null then
    return new;
  end if;

  select coalesce(p.display_name, 'A client') into v_client_name
  from public.profiles p
  where p.id = new.client_id;

  insert into public.notifications (profile_id, type, title, body, action_url, data)
  values (
    v_artist_profile_id,
    'review_new',
    'New review',
    v_client_name || ' left you a ' || new.rating || '-star review.',
    case when new.booking_id is not null then '/bookings/' || new.booking_id else null end,
    jsonb_build_object(
      'review_id', new.id,
      'booking_id', new.booking_id,
      'rating', new.rating
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_new_review on public.reviews;
create trigger trg_notify_new_review
  after insert on public.reviews
  for each row execute function public.notify_new_review();

-- ---------------------------------------------------------------------------
-- 6. Review response (artist_response set) -> notify the client.
-- ---------------------------------------------------------------------------
create or replace function public.notify_review_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_artist_name text;
begin
  select coalesce(p.display_name, 'Your artist') into v_artist_name
  from public.artist_profiles ap
  join public.profiles p on p.id = ap.profile_id
  where ap.id = new.artist_id;

  insert into public.notifications (profile_id, type, title, body, action_url, data)
  values (
    new.client_id,
    'review_response',
    'Your artist replied to your review',
    v_artist_name || ' responded to your review.',
    case when new.booking_id is not null then '/bookings/' || new.booking_id else null end,
    jsonb_build_object(
      'review_id', new.id,
      'booking_id', new.booking_id
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_review_response on public.reviews;
create trigger trg_notify_review_response
  after update on public.reviews
  for each row
  when (old.artist_response is null and new.artist_response is not null)
  execute function public.notify_review_response();

-- ---------------------------------------------------------------------------
-- 7. New message -> notify the recipient, throttled: skip if an unread
-- message notification already exists for that thread + recipient (avoids
-- spamming a badge with one row per message in a fast back-and-forth).
-- ---------------------------------------------------------------------------
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
  v_artist_profile_id uuid;
  v_recipient_profile_id uuid;
  v_sender_name text;
  v_existing_unread uuid;
begin
  select t.client_id, ap.profile_id
  into v_client_id, v_artist_profile_id
  from public.threads t
  join public.artist_profiles ap on ap.id = t.artist_id
  where t.id = new.thread_id;

  if v_client_id is null then
    return new;
  end if;

  -- Recipient is whichever participant did not send this message. Agent-
  -- authored messages (sender_kind = 'agent') are sent on the artist's
  -- behalf, so they notify the client.
  if new.sender_kind = 'client' then
    v_recipient_profile_id := v_artist_profile_id;
  else
    v_recipient_profile_id := v_client_id;
  end if;

  if v_recipient_profile_id is null or v_recipient_profile_id = new.sender_profile_id then
    return new;
  end if;

  select id into v_existing_unread
  from public.notifications
  where profile_id = v_recipient_profile_id
    and type = 'message_new'
    and is_read = false
    and (data ->> 'thread_id') = new.thread_id::text
  limit 1;

  if v_existing_unread is not null then
    return new;
  end if;

  select coalesce(p.display_name, 'Someone') into v_sender_name
  from public.profiles p
  where p.id = new.sender_profile_id;

  insert into public.notifications (profile_id, type, title, body, action_url, data)
  values (
    v_recipient_profile_id,
    'message_new',
    'New message',
    coalesce(v_sender_name, 'You') ||
      case when new.body is not null and length(new.body) > 0
        then ': ' || left(new.body, 80)
        else ' sent you a message'
      end,
    '/messages/' || new.thread_id,
    jsonb_build_object(
      'thread_id', new.thread_id,
      'message_id', new.id
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_new_message on public.messages;
create trigger trg_notify_new_message
  after insert on public.messages
  for each row execute function public.notify_new_message();

-- ---------------------------------------------------------------------------
-- Hardening: these are trigger-only SECURITY DEFINER functions. They must
-- never be callable directly via PostgREST RPC (mirrors
-- 20260715003100_harden_handle_new_user.sql) — trigger execution does not
-- depend on the firing role holding EXECUTE.
-- ---------------------------------------------------------------------------
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'notify_new_booking_request()',
    'notify_booking_request_status_change()',
    'notify_new_session_scheduled()',
    'notify_deposit_succeeded()',
    'notify_new_review()',
    'notify_review_response()',
    'notify_new_message()'
  ]
  loop
    execute format('revoke execute on function public.%s from public', fn);
    execute format('revoke execute on function public.%s from anon', fn);
    execute format('revoke execute on function public.%s from authenticated', fn);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime: add notifications to the realtime publication so the web/mobile
-- badge subscriptions (postgres_changes on INSERT) actually receive events.
-- Guarded so a re-run of this migration doesn't error on an existing member.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
