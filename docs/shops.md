# Shops

How INKD models a **shop** — an artist account that hosts other artists'
accounts — and the promotional-vs-managed relationship between a shop and its
members. This is the reference for the `shops` / `shop_members` schema, the
`@inkd/core` shops API, and the shop UI on web + mobile.

## The model in one paragraph

A shop is **not a third account type.** It is a *capability* of an artist
account (`profiles.is_artist = true` + an `artist_profiles` row). An artist can
run a shop **and** keep their own artist profile. A profile owns **at most one
shop** for now. The shop's public identity lives in `public.shops`
(owner, name, handle, bio, avatar, `primary_location_id`, `is_published`); its
roster lives in `public.shop_members`. A shop's **locations are the owning
artist's `studio_locations`** (a shop *is* an artist account); `primary_location_id`
points at the headline one. Founder's framing: a shop hosts other artists' accounts
"kinda like a promotional tool. Also, it could be a management layer. It could
have those types of switches."

## Two membership modes — the "switch"

Every membership carries a `membership_mode`:

| Mode | What it means | What the shop can do |
| --- | --- | --- |
| `promotional` | The shop only **showcases** the artist. | Nothing private is exposed. The artist keeps full independence. |
| `managed` | The shop has a **management layer** over the artist. | Once the artist accepts, owner/managers may read that artist's bookings/calendar; discovery groups them under the shop; commission/management context becomes possible. |

Managed capabilities are **gated behind the artist accepting a managed invite** —
consent is the acceptance. A promotional member, or any not-yet-accepted member,
exposes nothing private to the shop.

## Roles

`shop_members.role` ∈ `owner | manager | resident | guest`.

- **owner** — the artist who created the shop (materialized as an `active`
  member row at creation, `role='owner'`). Full control.
- **manager** — an active member who can manage the roster + shop profile on the
  owner's behalf (`is_shop_manager()` is true for owner + active managers).
- **resident / guest** — hosted artists. No management powers.

## Membership state machine

`shop_members.status` ∈ `invited | active | removed`.

```
            (manager invites)
   ∅ ───────────────────────────▶ invited
                                    │  │
              (artist accepts)      │  │  (artist declines)
                 status=active ◀────┘  └────▶ status=removed
                     │                              ▲
   (artist leaves / manager removes) ───────────────┘
```

Enforced in **two** places that must agree:

1. **Authoritatively** — the SQL guard trigger `public.shop_members_guard()` +
   RLS on `shop_members` (migration `20260717080000_shops.sql`).
2. **Client mirror** — the pure functions in
   `packages/core/src/domain/shops.ts` (`canPerformMembershipAction`,
   `canTransitionMemberStatus`, `canEditMemberRoleOrMode`) so the UI never
   offers a transition the database will reject. Unit-tested in
   `packages/core/src/domain/shops.test.ts`.

Rules the guard enforces:

- **No unilateral adding.** A manager can only insert an `invited` row; the
  artist must accept to become `active`.
- **No self-escalation.** A member acting on their own row may change **only**
  their own `status` along the accept / decline / leave edges — never their
  `role` or `membership_mode`. Only a manager changes role/mode.
- **Owner bootstrap.** The one exception to "managers only insert invited": the
  owner inserts their own `role='owner'`, `status='active'` row for the shop
  they own (this is what `createShop` does).

## Capability matrix

`shopMemberCapabilities({ status, membership_mode })` is the single source of
truth (mirror of the SQL). `managed` below means `status='active'` **and**
`membership_mode='managed'`.

| Capability | promotional (active) | managed (active) | invited / removed (any mode) |
| --- | --- | --- | --- |
| Listed on public roster | ✅ | ✅ | ❌ |
| "@ shop" badge on artist profile | ✅ | ✅ | ❌ |
| Grouped under shop in discovery | ✅ | ✅ | ❌ |
| Shop can read artist's calendar/bookings | ❌ | ✅ | ❌ |
| Shop management layer over artist | ❌ | ✅ | ❌ |
| Artist keeps full independence | ✅ | ❌ | ✅ |

The managed-calendar read is served by the SECURITY DEFINER RPC
`public.shop_managed_member_agenda(p_shop_id)`: it returns sessions **only** for
`active` + `managed` members of a shop the **caller manages**. A promotional
member's private bookings are never returned; a caller who doesn't manage the
shop gets nothing. This is additive — it does not alter booking RLS.

## RLS summary

- `shops` — published shops are world-readable; owner + active managers read
  their own (incl. drafts). Only the owning artist may create/delete; owner +
  managers may edit the profile.
- `shop_members` — `active` members of a **published** shop are world-readable
  (the public roster); a member always sees their own row; managers see the whole
  roster (invited/removed included). Writes are gated by the guard trigger.
- `search_shops(...)` (SECURITY INVOKER) — discovery over published shops, runs
  under the caller's RLS. Additive to `search_artists` (artist search is
  untouched).

## Notifications

Reuses the Wave 1 notifications inbox via SECURITY DEFINER triggers on
`shop_members`:

- **Invite** (a manager invites an artist) → notifies the invited artist
  (`type='shop_invite'`, action → `/settings?tab=shop`).
- **Accepted** (invited → active) → notifies the shop owner
  (`type='shop_invite_accepted'`, action → `/studio/shop`).

Both types are unknown to the delivery category map, so they deliver **in-app
only** (no push/email) — intentional, and requires no change to notifications
internals.

## Entry points & navigation

- **Becoming a shop:** Settings → **Shop** tab → "Create a shop" (an artist
  capability; no new signup type). Web `?tab=shop`; mobile settings "Shop" tab.
- **Managing a shop:** shop owners get a **Shop** entry in the Studio group (web
  sidebar `studioNavFor({ ownsShop })`; mobile studio hub). The entry is
  computed from `useMyShop()` and is **never shown** to clients or non-owner
  artists.
- **Shop dashboard:** web `/studio/shop`, mobile `/studio/shop` — roster
  management (invite by handle/email, set role + mode, remove), profile editing,
  publish toggle, managed-member calendar, and shop locations.
- **Public shop page:** web `/s/[handle]`, mobile `/shop/[handle]` — the shop,
  its locations, and its roster of member artists (each linking to
  `/a/[handle]`). Member artist profiles show an "@ shop" badge linking back.
- **Discovery:** a **Shops** strip on `/discover` (web) surfaces published shops;
  each card expands to its roster. Additive — the artist search is unchanged.

## Files

- Migration: `supabase/migrations/20260717080000_shops.sql`
- Core API: `packages/core/src/api/shops.ts`
- Core hooks: `packages/core/src/hooks/useShops.ts`
- Domain (state machine + capabilities): `packages/core/src/domain/shops.ts`
  (+ `shops.test.ts`)
- Web: `apps/web/src/app/s/[handle]/*`, `apps/web/src/app/(app)/studio/shop/*`,
  `apps/web/src/components/shop/*`, `apps/web/src/components/discover/ShopStrip.tsx`
- Mobile: `apps/mobile/app/shop/[handle].tsx`,
  `apps/mobile/app/studio/shop.tsx`, `apps/mobile/components/shop/*`
