# Account lifecycle

How INKD accounts are created, change role, and are deleted — and, critically,
what happens to data in each case. This is the reference for the auth flow, the
Settings → Account controls, and the `delete-account` edge function.

## Roles

Every user is a **client**. Some users are also **artists** — flagged by
`profiles.is_artist = true` and backed by an `artist_profiles` row that holds the
studio identity, onboarding progress, and publish state. The dual-role model is
one auth user, one `profiles` row, optionally one `artist_profiles` row.

## Sign-up → email confirm → first surface

1. At sign-up the user picks an account type: **"I'm getting tattooed"** (client)
   or **"I'm a tattoo artist"** (artist). `signUpWithPassword` stamps this into
   the auth user metadata as `account_type` (defaulting to `client`).
2. The choice survives the email-confirmation round-trip because the
   `handle_new_user` trigger reads `raw_user_meta_data ->> 'account_type'` and
   sets `profiles.is_artist` on the initial profile insert
   (migration `20260717020000_signup_account_type`).
3. The confirmation link lands on `/auth/callback`, which exchanges the code for
   a session and then routes by role + onboarding state:
   - **artist, onboarding incomplete** → `/onboarding`
   - **artist, onboarding complete** → `/dashboard`
   - **client** → `/feed`
   A meaningful explicit `next` (deep link) is always honored over the default.
   Mobile mirrors this in the auth screen after sign-in.
4. Ongoing enforcement (web middleware / mobile `ArtistOnly` guard): an artist
   with incomplete onboarding hitting `/dashboard` or `/studio/*` is nudged to
   `/onboarding`; a client (or downgraded artist) hitting any artist-only route
   is redirected to the feed / shown an "artist account required" state.

## Role changes

### Artist → client (downgrade) — supported, self-serve

Settings → Account → **Switch to a client account** (`downgradeToClient`):

| Effect | Field |
| --- | --- |
| Nav/role flips to client | `profiles.is_artist = false` |
| Public profile unpublished + undiscoverable | `artist_profiles.is_published = false` |
| Studio data (artist_profiles, bookings, portfolio, waivers, services, threads, …) | **RETAINED, frozen — never deleted** |

**Why retain?** Signed waivers are legal consent records with a statutory
retention requirement (MD/PA). We never destroy them on a role change. The
`artist_profiles` row and all owned rows are left intact so the account can be
re-upgraded later with its history restored.

### Client → artist (upgrade) — NOT self-serve during pilot

There is deliberately no self-serve client→artist path in the UI. Becoming an
artist is **invite/setup-based** during the pilot (the copy on the downgrade
confirmation says so). Internally the machinery exists (`becomeArtist` /
`useEnsureArtist`, exercised by the onboarding flow), but it is not exposed as a
one-tap toggle in Settings.

## Account deletion — permanent

Settings → Account → **Danger zone → Delete account** → typed `DELETE`
confirmation → `POST /functions/v1/delete-account`.

The edge function (verify_jwt) re-verifies the caller's JWT, then uses the
service-role admin API to **delete the `auth.users` row**. Deletion cascades
through the schema:

- `auth.users` → `public.profiles` (`ON DELETE CASCADE`)
- `profiles` → `artist_profiles` → every studio table (services, bookings,
  sessions, portfolio, posts, flash, waiver_templates, signed_waivers, threads,
  agent_* , studio_locations, availability_*, …) — all `ON DELETE CASCADE`
- `profiles` (as client) → booking_requests, bookings, follows, notifications,
  post_likes, reviews, saved_posts, sessions, threads — `ON DELETE CASCADE`

Counterparty records that must survive the deleted user are `ON DELETE SET NULL`,
so they are preserved with the user nulled out rather than blocking the delete:

- `messages.sender_profile_id`
- `payments.client_id`
- `signed_waivers.client_id`
- `agent_actions.client_id`, `agent_actions.approved_by`

**Storage** is not covered by the DB cascade, so the function best-effort removes
the user's own objects: everything under `{user_id}/…` in the `media` bucket
(avatars, portfolio, posts, flash) and in the `booking-uploads` bucket. Chat
attachments (keyed by thread, not user) are left as harmless orphans — a
best-effort limitation, documented here.

After a successful delete the client signs out and returns to the landing page.

> Note the asymmetry between **downgrade** (retains everything, including
> waivers) and **full deletion** (the user's right to erasure — removes their
> own data, keeping only counterparties' legally-nulled references). The
> downgrade path is the one that guarantees waiver retention; full deletion is an
> explicit, typed-confirmation destructive action.
