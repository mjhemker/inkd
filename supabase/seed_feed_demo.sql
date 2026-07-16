-- =============================================================================
-- seed_feed_demo.sql
--
-- DEMO DATA SEED — NOT a schema migration.
--
-- Purpose: populate the discovery feed with realistic-looking demo content
-- (posts, post_styles tags, flash sheets/items, follows/likes/saves) for two
-- existing artists (Jayden Cole, Nova Reyes) plus interactions from the demo
-- viewer "Riley Client".
--
-- IDEMPOTENT / RE-RUNNABLE: every inserted row uses a FIXED uuid (no
-- gen_random_uuid() for seeded rows), and every insert uses
-- `ON CONFLICT (...) DO NOTHING` (or DO UPDATE where noted) so this script
-- can be re-run any number of times without creating duplicates.
--
-- Fixed UUID scheme used below:
--   Jayden Cole posts        f11d0000-0000-4000-8000-00000000000{1..8}
--   Nova Reyes new posts     f22d0000-0000-4000-8000-00000000000{1..5}
--   Jayden flash sheet       f11d5eed-0000-4000-8000-000000000001
--   Jayden flash items       f11d5170-0000-4000-8000-00000000000{1..4}
--
-- Known existing rows this script builds on top of (not created here):
--   Jayden Cole   profile_id 0a0a0a0a-0000-4000-8000-000000000001
--                 artist_profiles.id 0b0b0b0b-0000-4000-8000-000000000001
--   Nova Reyes    profile_id 65d33373-7004-4862-9540-c069add46a5e
--                 artist_profiles.id d0f30963-0bcd-4564-afe7-7284313a5a75
--                 existing posts: 2fe4b6c3-2b4c-491b-aac9-a1baf59cdfa6,
--                                 0f4f7079-e165-41f4-8185-8ba0a900fcad
--                 existing flash sheet: 18806a06-fac7-48cb-a8e4-30015bf78fab
--   Riley Client  profile_id 156856d5-3318-43c7-b44e-18010857817e (viewer)
--
-- NOTE on the optional "demo-feed-sol" artist described in the build brief:
-- SKIPPED. public.profiles.id has a foreign key to auth.users.id
-- (profiles_id_fkey), and there is no supported way to create a matching
-- auth.users row via plain SQL/execute_sql (it requires the GoTrue auth
-- schema invariants — identities, encrypted_password, instance_id, etc.).
-- Fighting that FK from a demo-data script is out of scope; the two
-- required artists (Jayden, Nova) already satisfy the feed-variety goal.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------
-- 1. Posts — Jayden Cole (8 new posts, artist currently has 0)
-- -----------------------------------------------------------------------
insert into posts (id, artist_id, caption, media, cover_url, source, is_public, like_count, created_at, updated_at)
values
  ('f11d0000-0000-4000-8000-000000000001', '0b0b0b0b-0000-4000-8000-000000000001',
   'Fresh blackwork forearm piece healed up beautifully. Swipe for the before/after.',
   '[]', 'https://picsum.photos/seed/inkd-jayden-1/900/1100', 'inkd', true, 18,
   now() - interval '19 days', now() - interval '19 days'),
  ('f11d0000-0000-4000-8000-000000000002', '0b0b0b0b-0000-4000-8000-000000000001',
   'Fine line botanical wrap for a client who wanted something delicate but bold in placement.',
   '[]', 'https://picsum.photos/seed/inkd-jayden-2/900/1100', 'inkd', true, 32,
   now() - interval '17 days', now() - interval '17 days'),
  ('f11d0000-0000-4000-8000-000000000003', '0b0b0b0b-0000-4000-8000-000000000001',
   'Dotwork mandala on the shoulder blade — six hour sit, client was a trooper.',
   '[]', 'https://picsum.photos/seed/inkd-jayden-3/900/1100', 'inkd', true, 9,
   now() - interval '15 days', now() - interval '15 days'),
  ('f11d0000-0000-4000-8000-000000000004', '0b0b0b0b-0000-4000-8000-000000000001',
   'Ornamental filigree sleeve, session 2 of 3. Getting there.',
   '[]', 'https://picsum.photos/seed/inkd-jayden-4/900/1100', 'inkd', true, 27,
   now() - interval '12 days', now() - interval '12 days'),
  ('f11d0000-0000-4000-8000-000000000005', '0b0b0b0b-0000-4000-8000-000000000001',
   'Small blackwork florals for a first-tattoo client. Loved how these turned out.',
   '[]', 'https://picsum.photos/seed/inkd-jayden-5/900/1100', 'inkd', true, 5,
   now() - interval '9 days', now() - interval '9 days'),
  ('f11d0000-0000-4000-8000-000000000006', '0b0b0b0b-0000-4000-8000-000000000001',
   'Botanical rib piece — one of my favorite placements to work with.',
   '[]', 'https://picsum.photos/seed/inkd-jayden-6/900/1100', 'inkd', true, 40,
   now() - interval '6 days', now() - interval '6 days'),
  ('f11d0000-0000-4000-8000-000000000007', '0b0b0b0b-0000-4000-8000-000000000001',
   'Fine line portrait study, blackwork shading only, no grey wash.',
   '[]', 'https://picsum.photos/seed/inkd-jayden-7/900/1100', 'inkd', true, 14,
   now() - interval '3 days', now() - interval '3 days'),
  ('f11d0000-0000-4000-8000-000000000008', '0b0b0b0b-0000-4000-8000-000000000001',
   'Dotwork geometric forearm band, freehand guide lines then dot fill.',
   '[]', 'https://picsum.photos/seed/inkd-jayden-8/900/1100', 'inkd', true, 0,
   now() - interval '1 days', now() - interval '1 days')
on conflict (id) do nothing;

-- -----------------------------------------------------------------------
-- 2. Posts — Nova Reyes (5 new posts on top of her existing 2)
-- -----------------------------------------------------------------------
insert into posts (id, artist_id, caption, media, cover_url, source, is_public, like_count, created_at, updated_at)
values
  ('f22d0000-0000-4000-8000-000000000001', 'd0f30963-0bcd-4564-afe7-7284313a5a75',
   'Neo-traditional panther head, bold linework and saturated color packed in one sitting.',
   '[]', 'https://picsum.photos/seed/inkd-nova-1/900/1100', 'inkd', true, 36,
   now() - interval '18 days', now() - interval '18 days'),
  ('f22d0000-0000-4000-8000-000000000002', 'd0f30963-0bcd-4564-afe7-7284313a5a75',
   'Illustrative watercolor koi, loose color splashes over clean line art.',
   '[]', 'https://picsum.photos/seed/inkd-nova-2/900/1100', 'inkd', true, 21,
   now() - interval '14 days', now() - interval '14 days'),
  ('f22d0000-0000-4000-8000-000000000003', 'd0f30963-0bcd-4564-afe7-7284313a5a75',
   'Japanese irezumi-inspired dragon half sleeve, session 3 of 5.',
   '[]', 'https://picsum.photos/seed/inkd-nova-3/900/1100', 'inkd', true, 40,
   now() - interval '10 days', now() - interval '10 days'),
  ('f22d0000-0000-4000-8000-000000000004', 'd0f30963-0bcd-4564-afe7-7284313a5a75',
   'New school cartoon tiger, exaggerated proportions and candy colors.',
   '[]', 'https://picsum.photos/seed/inkd-nova-4/900/1100', 'inkd', true, 8,
   now() - interval '5 days', now() - interval '5 days'),
  ('f22d0000-0000-4000-8000-000000000005', 'd0f30963-0bcd-4564-afe7-7284313a5a75',
   'Watercolor floral back piece, healed shot — the color held up so well.',
   '[]', 'https://picsum.photos/seed/inkd-nova-5/900/1100', 'inkd', true, 15,
   now() - interval '2 days', now() - interval '2 days')
on conflict (id) do nothing;

-- -----------------------------------------------------------------------
-- 3. post_styles — tag every post (new + existing) with 1-3 styles
-- -----------------------------------------------------------------------

-- Jayden Cole: blackwork, fine-line, floral-botanical, dotwork, ornamental
insert into post_styles (post_id, style_id, artist_id)
select v.post_id, s.id, '0b0b0b0b-0000-4000-8000-000000000001'
from (values
  ('f11d0000-0000-4000-8000-000000000001'::uuid, 'blackwork'),
  ('f11d0000-0000-4000-8000-000000000002'::uuid, 'fine-line'),
  ('f11d0000-0000-4000-8000-000000000002'::uuid, 'floral-botanical'),
  ('f11d0000-0000-4000-8000-000000000003'::uuid, 'dotwork'),
  ('f11d0000-0000-4000-8000-000000000004'::uuid, 'ornamental'),
  ('f11d0000-0000-4000-8000-000000000004'::uuid, 'blackwork'),
  ('f11d0000-0000-4000-8000-000000000005'::uuid, 'blackwork'),
  ('f11d0000-0000-4000-8000-000000000005'::uuid, 'floral-botanical'),
  ('f11d0000-0000-4000-8000-000000000006'::uuid, 'floral-botanical'),
  ('f11d0000-0000-4000-8000-000000000006'::uuid, 'fine-line'),
  ('f11d0000-0000-4000-8000-000000000007'::uuid, 'fine-line'),
  ('f11d0000-0000-4000-8000-000000000007'::uuid, 'blackwork'),
  ('f11d0000-0000-4000-8000-000000000008'::uuid, 'dotwork'),
  ('f11d0000-0000-4000-8000-000000000008'::uuid, 'ornamental')
) as v(post_id, slug)
join styles s on s.slug = v.slug
on conflict (post_id, style_id) do nothing;

-- Nova Reyes: neo-traditional, illustrative, watercolor, japanese-irezumi, new-school
-- (includes backfill for her 2 pre-existing posts)
insert into post_styles (post_id, style_id, artist_id)
select v.post_id, s.id, 'd0f30963-0bcd-4564-afe7-7284313a5a75'
from (values
  -- pre-existing posts backfill
  ('2fe4b6c3-2b4c-491b-aac9-a1baf59cdfa6'::uuid, 'floral-botanical'),
  ('2fe4b6c3-2b4c-491b-aac9-a1baf59cdfa6'::uuid, 'illustrative'),
  ('0f4f7079-e165-41f4-8185-8ba0a900fcad'::uuid, 'neo-traditional'),
  -- new posts
  ('f22d0000-0000-4000-8000-000000000001'::uuid, 'neo-traditional'),
  ('f22d0000-0000-4000-8000-000000000002'::uuid, 'illustrative'),
  ('f22d0000-0000-4000-8000-000000000002'::uuid, 'watercolor'),
  ('f22d0000-0000-4000-8000-000000000003'::uuid, 'japanese-irezumi'),
  ('f22d0000-0000-4000-8000-000000000004'::uuid, 'new-school'),
  ('f22d0000-0000-4000-8000-000000000004'::uuid, 'illustrative'),
  ('f22d0000-0000-4000-8000-000000000005'::uuid, 'watercolor'),
  ('f22d0000-0000-4000-8000-000000000005'::uuid, 'floral-botanical')
) as v(post_id, slug)
join styles s on s.slug = v.slug
on conflict (post_id, style_id) do nothing;

-- -----------------------------------------------------------------------
-- 4. Flash sheet + items for Jayden Cole (Nova already has one)
-- -----------------------------------------------------------------------
insert into flash_sheets (id, artist_id, title, description, cover_url, is_public, created_at, updated_at)
values
  ('f11d5eed-0000-4000-8000-000000000001', '0b0b0b0b-0000-4000-8000-000000000001',
   'Winter Flash — walk-ins', 'A small batch of blackwork and fine line designs available for walk-ins this winter.',
   'https://picsum.photos/seed/inkd-jayden-flash-cover/900/1100', true,
   now() - interval '8 days', now() - interval '8 days')
on conflict (id) do nothing;

insert into flash_items (id, flash_sheet_id, artist_id, title, image_url, price_cents, is_repeatable, is_available, placement_suggestion, size_inches, sort_order, created_at, updated_at)
values
  ('f11d5170-0000-4000-8000-000000000001', 'f11d5eed-0000-4000-8000-000000000001', '0b0b0b0b-0000-4000-8000-000000000001',
   'Blackwork thorn band', 'https://picsum.photos/seed/inkd-jayden-flash-1/800/800', 12000, true, true, 'Wrist', 2.50, 0,
   now() - interval '8 days', now() - interval '8 days'),
  ('f11d5170-0000-4000-8000-000000000002', 'f11d5eed-0000-4000-8000-000000000001', '0b0b0b0b-0000-4000-8000-000000000001',
   'Fine line fern', 'https://picsum.photos/seed/inkd-jayden-flash-2/800/800', 18000, false, true, 'Forearm', 4.00, 1,
   now() - interval '8 days', now() - interval '8 days'),
  ('f11d5170-0000-4000-8000-000000000003', 'f11d5eed-0000-4000-8000-000000000001', '0b0b0b0b-0000-4000-8000-000000000001',
   'Dotwork moth', 'https://picsum.photos/seed/inkd-jayden-flash-3/800/800', 25000, false, false, 'Shoulder blade', 5.50, 2,
   now() - interval '8 days', now() - interval '8 days'),
  ('f11d5170-0000-4000-8000-000000000004', 'f11d5eed-0000-4000-8000-000000000001', '0b0b0b0b-0000-4000-8000-000000000001',
   'Ornamental dagger', 'https://picsum.photos/seed/inkd-jayden-flash-4/800/800', 20000, false, true, 'Ribs', 6.00, 3,
   now() - interval '8 days', now() - interval '8 days')
on conflict (id) do nothing;

-- Nova's existing flash items (Wildflower bouquet, Single stem rose, Vine wrap)
-- already have price_cents and is_available populated sensibly; nothing to backfill.

-- -----------------------------------------------------------------------
-- 5. Follows / likes / saves for demo viewer Riley Client
-- -----------------------------------------------------------------------
insert into follows (follower_id, artist_id, created_at)
values
  ('156856d5-3318-43c7-b44e-18010857817e', '0b0b0b0b-0000-4000-8000-000000000001', now() - interval '11 days'),
  ('156856d5-3318-43c7-b44e-18010857817e', 'd0f30963-0bcd-4564-afe7-7284313a5a75', now() - interval '11 days')
on conflict (follower_id, artist_id) do nothing;

insert into post_likes (post_id, profile_id, created_at)
values
  ('f11d0000-0000-4000-8000-000000000002', '156856d5-3318-43c7-b44e-18010857817e', now() - interval '10 days'),
  ('f11d0000-0000-4000-8000-000000000006', '156856d5-3318-43c7-b44e-18010857817e', now() - interval '5 days'),
  ('f22d0000-0000-4000-8000-000000000001', '156856d5-3318-43c7-b44e-18010857817e', now() - interval '9 days'),
  ('f22d0000-0000-4000-8000-000000000003', '156856d5-3318-43c7-b44e-18010857817e', now() - interval '6 days')
on conflict (post_id, profile_id) do nothing;

insert into saved_posts (profile_id, post_id, created_at)
values
  ('156856d5-3318-43c7-b44e-18010857817e', 'f11d0000-0000-4000-8000-000000000004', now() - interval '8 days'),
  ('156856d5-3318-43c7-b44e-18010857817e', 'f22d0000-0000-4000-8000-000000000002', now() - interval '7 days'),
  ('156856d5-3318-43c7-b44e-18010857817e', 'f22d0000-0000-4000-8000-000000000005', now() - interval '1 days')
on conflict (profile_id, post_id) do nothing;

-- ---------------------------------------------------------------------------
-- Split-shift availability for Jayden Cole: show the multi-block weekly grid in
-- action. Replace his single Tuesday window (11:00–19:00) with two blocks —
-- 11:00–14:00 and 17:00–21:00 — so the founder sees a real split day render.
-- Fixed UUIDs + ON CONFLICT keep this idempotent/re-runnable.
-- ---------------------------------------------------------------------------
delete from availability_rules
where artist_id = '0b0b0b0b-0000-4000-8000-000000000001'
  and weekday = 2 and start_time = '11:00:00' and end_time = '19:00:00';

insert into availability_rules (id, artist_id, weekday, start_time, end_time, is_open)
values
  ('a5a11d0e-0000-4000-8000-000000000001', '0b0b0b0b-0000-4000-8000-000000000001', 2, '11:00:00', '14:00:00', true),
  ('a5a11d0e-0000-4000-8000-000000000002', '0b0b0b0b-0000-4000-8000-000000000001', 2, '17:00:00', '21:00:00', true)
on conflict (id) do nothing;

commit;
