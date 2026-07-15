-- RLS gap fix: an artist must be able to read the profile of a client who has
-- a booking_request or booking with them, even when that client's profile is
-- not public (flagged by the booking agent).
--
-- Implemented as a REPLACEMENT of the existing profiles_select policy rather
-- than an additional permissive policy, so we do not trip the
-- multiple_permissive_policies performance lint. The artist<->client
-- booking-link condition is OR'd into the base rule and uses the existing
-- current_artist_id() helper, wrapped in a scalar subselect so it is evaluated
-- once per query.

drop policy if exists profiles_select on public.profiles;

create policy profiles_select
  on public.profiles
  for select
  using (
    is_public
    or id = (select auth.uid())
    or exists (
      select 1
      from public.booking_requests br
      where br.client_id = profiles.id
        and br.artist_id = (select public.current_artist_id())
    )
    or exists (
      select 1
      from public.bookings b
      where b.client_id = profiles.id
        and b.artist_id = (select public.current_artist_id())
    )
  );
