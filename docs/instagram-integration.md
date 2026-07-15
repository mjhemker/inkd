# Instagram integration — research + scaffold (2026-07)

Status: **code-complete, key-gated.** Every function/table/UI path below exists
and typechecks, but nothing talks to Meta until Michael creates a Meta app and
sets three secrets. Until then the UI honestly shows "coming soon" — see
§5 Config flag.

## 0. TL;DR for Michael

1. Instagram **Basic Display API is dead** (shut down Dec 2024). There is no
   "connect any personal IG account and read their photos" option anymore.
2. The current path is **"Instagram API with Instagram Login"** (Meta's 2024+
   product, sometimes branded "Business Login for Instagram"). It requires the
   artist's Instagram account to be a **Business or Creator account** (free,
   one-time toggle in the IG app — no Facebook Page required for this specific
   login flow, which is the whole reason it replaced the old Facebook-Page-tied
   Graph API path for creators).
3. You need to create a **Meta app** at developers.facebook.com, add the
   **"Instagram"** product (Instagram API with Instagram Login variant, not the
   legacy "Instagram Graph API" tied to Facebook Login), and request scopes.
4. For portfolio import (read-only, what we built) you only need
   `instagram_business_basic`. That scope is enough to unlock: for artists who
   are the app's own testers ("Instagram testers" added in the App Roles panel)
   with **zero app review** — good enough to pilot with Jayden's network before
   doing a full review.
5. Public launch (any artist, not just added testers) requires **Meta App
   Review** for `instagram_business_basic` (screencast + written use-case per
   scope) and **Business Verification** of the Meta Business account that owns
   the app. Budget 2–4 weeks.
6. **DM automation is a separate, harder ask** — see §4. We built the import
   scaffold only; do not build DM automation without a second review pass.

## 1. What replaced Basic Display API

Meta shut down the old **Instagram Basic Display API** on December 4, 2024.
All personal/creator Instagram data access now goes through the Instagram
Platform's **"Instagram API with Instagram Login"** product (Meta's current
name; some docs and third-party guides still call it "Business Login for
Instagram"). It is the direct, supported replacement for what a portfolio
importer needs — pull a user's own media (photos, captions, permalinks)
without their account being linked to a Facebook Page.

This is distinct from the (still-alive, separate) **Instagram API with
Facebook Login**, which is for businesses managing Instagram via a linked
Facebook Page (ads, cross-posting tools, agencies). We do not need that path —
INKD artists connect their own IG account directly, no Page required.

## 2. Meta app setup — what Michael has to do

1. Create/reuse a **Meta Developer account** and a **Meta app** at
   developers.facebook.com/apps (type: "Business" or "Consumer" — Business is
   the safer default since we'll eventually want business verification anyway).
2. In the app, **add the "Instagram" product** and choose the **"Instagram API
   with Instagram Login"** setup (not the Facebook-Login-tied one).
3. Under **App Roles → Instagram testers**, add each pilot artist's Instagram
   account (they'll get an invite to accept in the IG app). Testers can
   authorize the app and pull their own data with **zero app review** — this
   is the fastest path to a working pilot with Jayden's Baltimore/Philly
   artists before doing a public review.
4. Note the **Instagram App ID** and **Instagram App Secret** from the app
   dashboard (Instagram Platform product page — these are distinct from the
   legacy Facebook App ID/Secret pair even though they live in the same app).
5. Set the **OAuth redirect URI** in the Instagram product's settings to the
   deployed `instagram-oauth` function's callback URL, e.g.
   `https://khlpidflnvkqafkvkpfy.supabase.co/functions/v1/instagram-oauth`.
   Meta requires HTTPS; localhost is allowed for dev with an explicit
   `localhost` entry.
6. Each artist toggles their Instagram account to **Professional (Business or
   Creator)** in the IG app — Settings → Account type. Free, no Page needed for
   this login flow. This is the one thing every pilot artist has to do
   themselves before "Connect Instagram" works for them.
7. When ready to open past testers: submit **App Review** requesting
   `instagram_business_basic` (screen-recording of the connect + import flow,
   a written explanation, and a live demo link), plus complete **Business
   Verification** for the Meta Business Manager account that owns the app
   (government business documents). Budget 2–4 weeks total; testers work
   immediately without this step.

None of the above is done yet — **the only remaining step to make this scaffold
live is setting the three secrets in §5.**

## 3. OAuth + import flow this scaffold implements

Scopes requested: **`instagram_business_basic` only** (read profile + read
media — everything portfolio import needs). We do NOT request
`instagram_business_content_publish` (posting back to IG — out of scope, SPEC
§0 only calls for *import*), `instagram_business_manage_comments`, or
`instagram_business_manage_messages` (see §4).

1. **Authorize** — `POST instagram-oauth` (action `authorize-url`, artist must
   be signed in). Builds a **signed, expiring `state`** (HMAC-SHA256 over
   `artistId.nonce.expiresAt`, keyed on `IG_APP_SECRET`) and returns
   `https://www.instagram.com/oauth/authorize?client_id=…&redirect_uri=…&response_type=code&scope=instagram_business_basic&state=…`.
   The client redirects the browser there (same pattern as
   `connect-onboarding-link`'s Stripe account-link URL).
2. **Callback** — Meta redirects the browser back to `IG_REDIRECT_URL` (the
   `instagram-oauth` function itself, `GET` with `?code=&state=`, no Supabase
   JWT — Meta doesn't have one). The function verifies the state signature +
   expiry (proves the callback belongs to the artist who started it, without a
   session), then:
   - exchanges `code` for a **short-lived token** (`POST
     api.instagram.com/oauth/access_token`, 1 hour validity);
   - exchanges that for a **long-lived token** (`GET
     graph.instagram.com/access_token?grant_type=ig_exchange_token`, 60 days);
   - reads the connected IG user id/username (`GET graph.instagram.com/me`);
   - upserts one row into `instagram_connections` (service role only — the
     table has no client-readable RLS policy; the browser never sees the raw
     token, only the sanitized status the `status` action returns);
   - redirects the browser back to `/settings?tab=grow&instagram=connected`.
3. **Refresh** — `POST instagram-oauth` (action `refresh`). Long-lived tokens
   last 60 days and must be refreshed **before** they expire (and the token
   must already be ≥24h old) via `GET
   graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token`.
   Implemented and callable; **not yet wired to a schedule** — the runtime
   equivalent of `agent_run_tick`'s pg_cron pattern (see
   `20260716070000_agent_jobs_queue.sql`) is the natural next step once this
   goes live, so tokens refresh automatically instead of silently expiring at
   day 60.
4. **Import** — `POST instagram-import`. Loads the artist's connection, pages
   through `GET graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp`,
   skips anything already imported (idempotent — see §6), downloads each new
   image (videos use `thumbnail_url`; carousels import their cover), re-uploads
   it into our own `media` storage bucket, and inserts a `posts` row +
   `portfolio_pieces` row per media item. Capped at a few pages per invocation
   (Edge Function wall-clock limits) — safe to call again to fetch the next
   batch, since re-running never duplicates prior imports.
5. **Disconnect** — `POST instagram-oauth` (action `disconnect`). Deletes the
   artist's `instagram_connections` row.

## 4. DM automation — reality check

SPEC §0: *"DM automation only if Meta API allows."* Current read: **it's
possible but meaningfully harder than import, and we did not build it.**

- Requires a **separate scope**, `instagram_business_manage_messages`, which
  Meta explicitly calls out as needing **additional review beyond standard
  permissions** with a **longer approval timeline** than `instagram_basic`.
- **24-hour messaging window**: you may only message a user within 24 hours of
  their last message to the business account. A **Human Agent tag** extends
  this to 7 days but — critically — *"must be applied by a real human, not an
  automated system or bot"*; using it for automated/agent-drafted replies is a
  policy violation, not a technical workaround.
- Rate-limited to **~200 automated messages/hour per account** (Business Use
  Case limit), on top of the general ~200 calls/user/hour cap.
- Net effect for INKD's AI staff design (SPEC §5, tiered autonomy): Front
  Desk/Booking Manager could plausibly draft-and-send within the 24h window
  under `instagram_business_manage_messages` once approved, but **cannot**
  legitimately use the human-agent extension to reach clients after a day of
  silence — that reopens the classic "artist replies from their phone instead"
  problem SPEC's in-platform-threads architecture already avoids. Recommend:
  treat IG DMs as a **funnel into an INKD thread** (a client's first IG DM gets
  an auto-reply pointing to their `getinkd.co/a/[handle]` booking page — one
  message, well inside the window, arguably not even "automation" in the
  sense the policy cares about) rather than running full agent conversations
  over Instagram's DM surface. Revisit if/when Meta's messaging review timeline
  and INKD's own message volume justify a second review pass.
- **Not built in this pass.** No `instagram_business_manage_messages` scope is
  requested anywhere in this scaffold; the share-kit (booking link + QR +
  link-in-bio blurbs, built alongside this) is the pragmatic, works-today
  alternative — it turns IG traffic into INKD bookings without touching the
  DM API at all.

## 5. Config flag — how "coming soon" becomes "connect"

Three secrets gate everything:

```
IG_APP_ID           the Instagram App ID from the Meta app's Instagram Platform product
IG_APP_SECRET        the Instagram App Secret (also used as the HMAC key for the signed `state`)
IG_REDIRECT_URL       must exactly match the redirect URI registered in the Meta app
```

`supabase/functions/_shared/env.ts` exports `isInstagramConfigured()` — true
only when all three are set. The `instagram-oauth` function's `status` action
returns `{ configured: isInstagramConfigured(), connected, … }`; every UI
surface (onboarding's portfolio row, the settings "Connected accounts"
section) reads `configured` and renders the honest "Connect Instagram —
requires Meta app approval — coming soon" `Badge` until it flips true. No
build/deploy is required to turn it on later — set the three secrets with
`supabase secrets set` and redeploy the two functions; the same UI code starts
working.

## 6. Idempotency

- `posts` already had a unique `(artist_id, instagram_id)` index
  (`content_and_social` migration) — reused as-is; re-importing a media item
  just no-ops the post insert.
- `portfolio_pieces` gained `instagram_media_id text` + a unique
  `(artist_id, instagram_media_id)` partial index (this migration) so the
  matching portfolio piece is equally idempotent.
- The pure mapping logic (`_shared/instagram-mapper.ts`: which media items to
  skip, how to shape the post/piece insert) is offline-tested —
  `node --test supabase/functions/_shared/instagram-mapper.test.ts`.

## 7. What's built vs. what's left

**Built (code-complete, untested against live Meta — no keys exist yet):**
- `supabase/functions/instagram-oauth` — authorize-url / callback / refresh /
  disconnect / status.
- `supabase/functions/instagram-import` — paginated fetch → download → upload
  → idempotent post + portfolio-piece insert, with per-run progress rows.
- `instagram_connections` + `instagram_import_runs` tables, RLS, migration
  `20260716080000_instagram_import.sql` (applied to the live DB — schema is
  real even though the functions aren't deployed).
- `packages/core/src/api/instagram.ts` + `hooks/useInstagram.ts`.
- Settings → "Connected accounts" section (web + mobile): connect/disconnect,
  connection details, "Import from Instagram" trigger, import-run history.
- Onboarding's portfolio row now reads the same config/connection state
  instead of a hardcoded "coming soon" badge.

**Left for Michael / a future pass:**
- Create the Meta app, add testers, set the three secrets, deploy the two
  functions (`supabase functions deploy instagram-oauth instagram-import`),
  add `verify_jwt` entries already staged in `supabase/config.toml`.
- Wire token refresh to a schedule (pg_cron, mirroring `agent_run_tick`).
- App Review + Business Verification before opening past the tester list.
- DM automation — deliberately not attempted this pass (§4).
