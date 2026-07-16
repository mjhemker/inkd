-- Demo seed: a published shop "Fells Point Ink" owned by demo artist Desmond
-- Wright, hosting one MANAGED member (Marcus Vane) and one PROMOTIONAL member
-- (Sofia Marchetti), plus a pending invite (Priya Anand). Idempotent (fixed
-- UUIDs; the shop is deleted + re-seeded so re-runs are clean).
--
-- Membership writes bypass the shop_members_guard trigger via
-- session_replication_role='replica' (service-role seeding only — the guard is
-- for RLS-session writes, which is what the app does). Also gives Desmond a
-- password + confirms his email so the shop dashboard is screenshot-able
-- (login: desmond.wright@inkd.demo / Password123!).

do $$
declare
  v_shop_id           uuid := '5c000000-0000-4000-8000-000000000001';
  v_desmond_artist    uuid := 'd15c0a00-0000-4000-8000-000000000003';
  v_desmond_profile   uuid := 'd15c0000-0000-4000-8000-000000000003';
  v_desmond_location  uuid := 'd15c0b00-0000-4000-8000-000000000003';
  v_marcus_artist     uuid := 'd15c0a00-0000-4000-8000-000000000001';
  v_sofia_artist      uuid := 'd15c0a00-0000-4000-8000-000000000004';
  v_priya_artist      uuid := 'd15c0a00-0000-4000-8000-000000000002';
begin
  perform set_config('session_replication_role', 'replica', true);

  delete from public.shops where id = v_shop_id;

  insert into public.shops (id, owner_artist_id, name, handle, bio, primary_location_id, is_published, created_at, updated_at)
  values (
    v_shop_id, v_desmond_artist, 'Fells Point Ink', 'fells-point-ink',
    'A Fells Point tattoo shop in Baltimore — resident and guest artists across black & grey, traditional and fine-line. Walk-ins welcome, bookings preferred.',
    v_desmond_location, true, now(), now()
  );

  insert into public.shop_members (id, shop_id, artist_profile_id, role, membership_mode, status, invited_by, invited_at, joined_at)
  values
    ('5c111111-0000-4000-8000-000000000001', v_shop_id, v_desmond_artist, 'owner',    'managed',     'active',  v_desmond_profile, now(), now()),
    ('5c111111-0000-4000-8000-000000000002', v_shop_id, v_marcus_artist,  'resident', 'managed',     'active',  v_desmond_profile, now(), now()),
    ('5c111111-0000-4000-8000-000000000003', v_shop_id, v_sofia_artist,   'resident', 'promotional', 'active',  v_desmond_profile, now(), now()),
    ('5c111111-0000-4000-8000-000000000004', v_shop_id, v_priya_artist,   'guest',    'promotional', 'invited', v_desmond_profile, now(), null);

  perform set_config('session_replication_role', 'origin', true);

  -- Make Desmond loggable for screenshots.
  update auth.users
    set encrypted_password = crypt('Password123!', gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now())
    where id = v_desmond_profile;
end $$;
