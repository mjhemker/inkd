# INKD — Exact Click-Through Test Flows

Work through Flows 1–9 in order. When you finish Flow 9 you will have exercised **every route, tab, and feature** in the app. The coverage matrix at the bottom lets you tick each surface off.

Legend: **[WORKS]** = fully functional now · **[GATED]** = built + visible but waiting on an API key; the step tells you the *expected* limited behavior so you can confirm it fails gracefully, not silently.

---

## Round 3 retest (START HERE — newest features)

The big Round-3 batch: multi-channel notifications, AI auto-tagging, shops, aftercare, daily drop, match-my-inspiration, body-map placement, cancellation waitlist, mobile light-mode fix. Run these first.

**Before you start — set 3 vault secrets** (SQL editor) or the scheduled/AI parts stay idle:
```
select vault.create_secret('https://khlpidflnvkqafkvkpfy.supabase.co/functions/v1/notify-dispatch','notify_dispatch_url');
select vault.create_secret('https://khlpidflnvkqafkvkpfy.supabase.co/functions/v1/tag-image','image_tagger_url');
select vault.create_secret('https://khlpidflnvkqafkvkpfy.supabase.co/functions/v1/daily-drop','daily_drop_url');
```
Without them: **in-app** notifications still work; push/email fan-out, the AI image-tag backfill, and daily-drop generation stay off. Push also needs a physical device; email needs a Resend key + `getinkd.co` verified (until then email silently skips).

**New demo login:** `desmond.wright@inkd.demo` / `Password123!` — owns the shop **"Fells Point Ink"** (`/s/fells-point-ink`); roster: Marcus Vane (managed), Sofia Marchetti (promotional), Priya Anand (pending invite).

**A. Notification preferences center.** Settings → **Notifications**. **Expect:** every category (booking / deposit / message / review / AI approval / aftercare / waitlist…) with **In-app / Push / Email** toggles, plus a push-enable button on mobile. Flip a few, reload — choices persist.

**B. Rich, informative notifications.** As **Mara**, request a booking with Jayden. As **Jayden**, open the **bell** → **Expect** a notification whose body actually tells you something ("Mara Vance requested a booking — [project], forearm, [date]"), and clicking it deep-links to the request. (Push shows on a real device only; email only if Resend is set.)

**C. Landing moved to /preview.** Signed out, visit **`/preview`** → the marketing landing renders there now. Visit **`/`** → it redirects sensibly (signed-in → feed/dashboard; signed-out → preview/auth).

**D. Shops.** (1) Public: open **`/s/fells-point-ink`** → shop page with a roster (Marcus, Sofia) linking to each profile + a "**Hosted by** Desmond Wright" link; an in-shop artist's profile shows a "**@ shop**" badge. (2) Manage: sign in as **desmond.wright@inkd.demo** → **Studio → Shop** → see members with role + **promotional/managed** mode; **invite** an artist by handle (they get a notification and must accept); the *managed* member shows a "calendar shared" affordance, the *promotional* one doesn't. (3) Create: as an artist with no shop (Nova), **Settings → Shop → create** → confirm a Shop entry appears in the Studio nav.

**E. Aftercare timeline + healed-photo loop.** As an artist, open a booking with a **completed** session → confirm aftercare check-ins are scheduled at **3 days / 1 week / 3 weeks**. As the **client**, when a check-in is due you get a "**how's it healing?**" prompt with a photo upload → submit → with consent it can become a **portfolio piece** + prompt a **review** + a touch-up **rebook nudge**. (Check-ins fire on the daily tick — to see one immediately, a session dated in the past is easiest.)

**F. Daily drop.** Home feed → a **Daily Drop** card: one highlighted post (flash or original) personalized to the styles you've viewed + artists you follow. (Generates on the daily cron once `daily_drop_url` is set; empty/placeholder until the first run.)

**G. Match my inspiration.** Discover (or the feed tool card) → **Match my inspiration** → upload an inspiration image → **Expect** ranked artists whose work matches the aesthetic. (Needs the AI tag backfill — set `image_tagger_url` first; results sharpen as it completes.)

**H. Body-map placement.** Start a booking request (`/book/[handle]`) → the placement step is now a **visual body map**: tap a region (front/back, arms/legs), pick a side → confirm it carries into the request, and as the artist the request shows the structured placement.

**I. Cancellation waitlist + auto-fill.** As a **client**, on an artist with tight availability → **Join the waitlist** with a desired window. As the **artist**, **cancel** a booked session that matches → **Expect** the freed slot auto-offers to the best-matching waitlist client (notification + a claim **with a countdown**). The offered client **claims** → it converts to a booking; a second client **cannot** claim the same slot. Artist's list is under **Bookings → Waitlist**.

**J. Light mode on MOBILE (the fix).** In the mobile app (Expo Go), **Settings → Appearance → Light** → **Expect** icons and text stay legible everywhere (some were invisible before). Spot-check Settings, Feed, Bookings, Try-on. Toggle back to Dark — confirm it looks unchanged.

**K. Parity fixes.** Feed while **signed out** → like/save/follow are visibly **disabled** (not silently failing). A notification that deep-links to a specific settings tab **lands on that tab**. A signed-out client opening a **waiver** sign link → after signing in, **returns to the waiver** (not the feed).

---

## Round 2 retest (earlier fixes)

These are the items fixed or newly landed since your last pass. Run through them first — each has exact steps. The full Flows 1–9 below remain the reference for everything else. Logins/password are in **Prep**.

1. **Typing in any modal field (focus bug fixed).** Sign in as Jayden → **Bookings** → open any booking → click **Ask a question** (or any modal with a text field). Type a full sentence. **Expect:** every keystroke lands; focus never jumps out after the first character. Try the New-booking and review modals too.
2. **Ask-a-Question → thread appears in Messages (both sides).** As the **client** (Window B, Mara), open Jayden's profile or a booking → **Ask a question** → send a message. **Expect:** a thread is created and shows in the client's **Messages**. Switch to **Window A (Jayden)** → **Messages** → the **same thread is there** with the client's message. Reply from Jayden; confirm it appears back on the client side.
3. **Full messaging + image attachments (was untested last round).** In an open thread, send several text messages back and forth. Then tap the **attachment/image** control, pick an image, and send. **Expect:** the image uploads, renders inline in the bubble on the sender side, and appears for the other party. Scroll history; confirm ordering and timestamps.
4. **Artist profiles reachable from feed/discover cards (was untested last round).** Go to **Home (feed)** → tap an artist's name/avatar on a post → **Expect:** their public profile opens. Repeat from **Discover** → tap an artist placard/card → their profile opens. Back navigation returns you to the feed/discover list.
5. **Fresh signup → account-type choice → email confirm → auto-onboarding.** Use a brand-new email. Sign up → **choose account type** (artist vs client) → complete the **email confirmation** → **Expect:** an artist is dropped straight into **onboarding** automatically; a client lands in the app with no studio setup.
6. **Client account sees no Studio nav.** Sign in as a **client** → **Expect:** the left sidebar / bottom tabs show **no "Studio" group** and no Dashboard/AI-staff/Settings-studio items. Bookings appears in the client's **main** nav (not under Studio). As an **artist**, confirm the **Studio** group is present with Bookings inside it.
7. **Delete account + artist→client downgrade.** As an artist: **Settings → Account** → **Switch to a client account**; confirm the modal, then confirm the Studio nav disappears and artist-only surfaces are gone. Then (on a throwaway account) **Settings → Account → Delete account**, type the confirmation, and confirm the account + data are removed and you're signed out.
8. **Avatar upload preview.** **Settings → Profile** (or onboarding identity step) → upload an avatar image → **Expect:** the preview updates immediately to the chosen image before/after save.
9. **Real dashboard stats.** As Jayden, open **Dashboard** → **Expect:** the stat tiles and Today panel show **real seeded numbers** (upcoming sessions, requests, etc.), not zeros or placeholders.
10. **Discover shows 6 artists + map (or honest placard) + sliders.** Open **Discover** → **Expect:** at least **6 artists** in the list, a working **map** (or an honest "map unavailable" placard if the key is gated — not a blank/null-island), and the **range sliders** (distance/price) filter the list as you drag.
11. **Drag-create weekly hours, multi-block.** **Settings → Hours** (or onboarding step 3) → on the weekly grid, **drag on a day** to create an hours block; **drag the block** to move it and **drag its edges** to resize; **click a block** to set exact times in the popover. Create **two blocks on the same day** (split shift, e.g. Tue 11:00–14:00 and 17:00–21:00) and save. Reload; confirm both blocks persist.
12. **Bookings week grid + week-range header + full-width pipeline.** **Bookings** → **Expect:** a real **week grid** with sessions placed at their times; the header reads an exact **week range** ("Month DD – DD, YYYY") with **‹ ›** navigation and a **Week/Month** toggle; today's column is highlighted; the **pipeline** board renders **full-width** below/alongside.
13. **Light mode toggle across key screens.** **Settings → Appearance** → switch to **Light** → **Expect:** feed, discover, bookings, hours grid, settings, and profile all flip to the warm light theme with legible text (no dark-on-dark). Toggle back to **Dark**; confirm the choice persists across a reload.
14. **Try-on wrap slider curves + Back button.** Open **Fit check (try-on)** → place a design on the body photo → drag the **wrap** slider → **Expect:** the tattoo visibly **curves around the limb** (cylindrical wrap), not just a flat skew. Confirm the **Back**/exit button returns you out of the editor.
15. **New logo / favicon.** Confirm the **INKD logo** shows in the sidebar/top bar, and the **browser tab favicon** is the new INKD mark (check the tab icon and, on mobile, the app icon/splash).

---

## Prep (do once)

1. In the repo root: `pnpm install`, then `pnpm --filter web dev`. Open **http://localhost:3000**.
2. Confirm `apps/web/.env.local` has the Supabase URL (`https://khlpidflnvkqafkvkpfy.supabase.co`) and the anon key (`eyJhbGci…`). If the feed/discover pages show "failed to load," the env is wrong.
3. **Open two browser windows** and keep both for the whole session:
   - **Window A (normal):** you'll be **Jayden the artist**.
   - **Window B (incognito):** you'll be the **client**.
   This lets you test the two-sided handshake (client books → artist sees it → both message each other) for real.

**Demo logins — all use password `Password123!`:**

| Email | Who | Use for |
|---|---|---|
| `demo-booking-artist@inkd.test` | Jayden Cole (@demo-booking-jayden) | **Main artist** — has seeded AI approvals, requests, chats |
| `demo-booking-client@inkd.test` | Mara Vance (@demo-booking-mara) | Client who already has history with Jayden |
| `demo-folio-artist@inkd.test` | Nova Reyes (@demo-folio-nova) | Portfolio-rich profile to browse |
| `demo-waiver-client@inkd.test` | Riley Client | Waiver-signing side |

Display-only artists you'll see in discovery (no login needed): Marcus Vane, Priya Anand, Desmond Wright, Sofia Marchetti.

**What's live now (changed since earlier rounds):** Stripe deposits **charge in test mode** (card `4242 4242 4242 4242`) — Jayden is wired to a test connected account, so the Poppy-cluster deposit works end-to-end; live **AI drafting** is on (real drafts appear in `/studio/ai`); the **map** renders real Mapbox tiles (with the token in `.env.local`).

**Still gated (so you're not surprised):** Stripe ID verification is skippable; **email** notifications skip until a Resend key + `getinkd.co` domain are set; **push** needs a physical device (+ EAS creds for a store build); Instagram import shows "coming soon"; INKD Pro shows "coming soon"; SMS is not built (by design).

---

## FLOW 1 — Landing page + auth mechanics
*Window B (incognito), signed out. Tests: `/`, `/auth`.*

1. Go to **localhost:3000**. On the landing page, confirm: the hero ("Run your chair like a real studio"), the Caveat hand-note line, the portfolio grid with **FLASH** stamps (ember/orange), the "What INKD is" three cards, and the "AI staff, not AI art" trust band.
2. Click **Sign in** (top right) → lands on `/auth`.
3. On the auth card: confirm the **"At least 8 characters"** helper text sits permanently under the password field, and the **Show/Hide** toggle reveals/masks what you type.
4. Click the **Create account** tab → confirm a Name field appears. Switch back to **Sign in**.
5. Click **Email me a magic link** → confirm it accepts an email and shows a "check your inbox" style confirmation (you don't need to complete it).
6. Leave this window on `/auth` — you'll sign in as the client in Flow 5.

---

## FLOW 2 — New artist onboarding, start to finish
*Window A (normal). Tests: `/auth` signup, all 5 onboarding steps, congrats, first dashboard. Use a FRESH email so you see the real first-run.*

1. At `/auth`, click **Create account**. Enter a name, a **new** email (e.g. `test-artist-1@inkd.test`), password `Password123!`, submit. You'll be routed toward onboarding.
2. **Step 1 — Identity:** enter handle, bio. Confirm the **"Import from Instagram"** affordance shows an honest **"coming soon"** state **[GATED]**. Upload an avatar via the file picker **[WORKS]**. Note the progress bar at the top. Click Continue.
3. **Step 2 — Location:** add a studio location (address). Toggle a **classification** (shop owner / shop resident / private suite / independent) and the **travel** options (fly-out / house calls / at-home). Add a **second** location to confirm multi-location works. Continue.
4. **Step 3 — Your books:** toggle business days on/off and set hours (confirm each time field shows exactly **one** clock icon, not two). Add a **planned time-off** range. Pick a **booking window** (e.g. "2–3 months out"). Toggle what clients can upload (reference images / documents). Under **Meet your AI front desk**, drag the **autonomy slider** across OFF → DRAFTS → ASSISTED → MANAGED and read how the description changes; leave it on **DRAFTS**. Continue.
5. **Step 4 — Services & rates:** add a preset (Consultation / 1-hr session / Half day / Full day), then add one **custom** service with name, duration, price, deposit, break time, public toggle. Continue.
6. **Step 5 — Verify:** the **ID verification** step is **[GATED]** (Stripe Identity) — confirm you can **skip** it. Finish.
7. Confirm the **🎉 congrats screen**, then land on the **artist dashboard**. Sign out (bottom-left profile menu) — you'll spend the rest as Jayden, who has richer seeded data.

---

## FLOW 3 — Artist cockpit: dashboard, bookings, calendar
*Window A. Sign in as `demo-booking-artist@inkd.test`. Tests: `/dashboard`, `/bookings` (all views), `/bookings/requests/[id]`, `/bookings/[id]`, sessions calendar.*

1. **Dashboard:** confirm the four stat cards (Open inquiries / Booked sessions / Deposits held / Rebook rate), the **Today** panel, and the **AI staff activity** card showing a pending-approvals count and recent items.
2. Left nav → **Bookings**. You're in the **artist view**. Confirm three areas: the **requests inbox**, the **pipeline board** (columns: inquiry → deposit pending → scheduled → in progress → healed), and a **sessions calendar**.
3. In the inbox, click a pending request → opens `/bookings/requests/[id]`. Confirm you see the client's **intake** (placement, size, description, budget), the **references** gallery, and the **preferred dates**. Try each triage action: **Ask a question** (confirm it links into Messages), then go back and **Accept** a *different* request (accepting creates a booking + first session).
4. Back on Bookings, click a card in the pipeline → opens `/bookings/[id]` (booking detail). Confirm: client info, sessions list, per-session **deposit/balance** state. Click **Add session** (multi-session works). Click **Request deposit** → **[GATED]**: it should attempt a Stripe checkout and fail gracefully (no charge) — confirm it doesn't crash and the session still shows a "deposit requested/pending" state. Confirm the **Sign consent form** link appears where a session exists (you'll use it in Flow 6).
5. Switch the calendar between **week** and **month** and confirm sessions are colored by status.

---

## FLOW 4 — AI staff (the trust centerpiece)
*Window A, still Jayden. Tests: `/studio/ai` (approvals, activity, playbook), dashboard wiring, settings autonomy link.*

1. From the dashboard AI-staff card (or left nav / settings), open **`/studio/ai`**.
2. Confirm the **staff header** shows **three named staff**: Front Desk, Booking Manager, Studio Manager (each with a role line), plus the current autonomy level and pending-approvals count.
3. **Approvals inbox:** open a pending draft. Confirm you see: the **client's message**, the agent's **draft reply**, a **TIER** stamp (mono), and the **provenance block** ("FROM YOUR RATES — 1-hr session $180", "FROM YOUR AVAILABILITY — Tue 2pm open") plus a plain-language reasoning line.
4. **Approve one** draft **[WORKS]** — this genuinely sends: it inserts an agent-authored message into that client thread and moves the action to **executed**. (The approve endpoint is deployed and live.)
5. On another draft, use **Edit then send** (tweak the text first). On a third, **Reject** with a reason.
6. Confirm the **medical hand-off** item is flagged **Tier 3** and is artist-only (agents prepare, never execute).
7. Open the **Activity feed** tab → confirm the chronological ledger (executed / rejected / proposed) with tier stamps; try the status/type **filters**.
8. Open the **Playbook** tab → **add** an entry, **edit** it, **delete** it (CRUD). Read the honest explainer copy.
9. Note the link out to the **autonomy slider** in Settings (you'll set it in Flow 8).

---

## FLOW 5 — Client discovery → booking request
*Window B (incognito). Sign in as `demo-booking-client@inkd.test`. Tests: `/feed`, `/discover`, `/a/[handle]` (all tabs), `/book/[handle]` (all 5 steps), client `/bookings`.*

1. Land on **Home / feed**. Toggle **Following** vs **Discover** tabs. Click **style chips** to filter. On a post: **like** it, **save** it, and **follow** an artist. Open a post to the **detail overlay**; confirm a **"Try it on — fit check"** button (you'll use try-on in Flow 8).
2. Left nav → **Discover** (`/discover`). Confirm the **map + list**. In the filter bar: pick a **style**, a **price band**, toggle **books open**, set a **radius** (in **miles** — 3/10/25/50), and use a **city** quick-pick (Baltimore / Philadelphia). Confirm the list narrows and distances show in **mi**. Click a **map pin** → mini-card → open that artist.
3. On a **public artist profile** (`/a/[handle]`), walk **every tab**: **Portfolio** (click an image → **lightbox**), **Posts**, **Flash** (note claimed/available states + ember price stamps), **Info** (services with public prices, hours, booking window), **Reviews** (star-pip ratings + any artist responses).
4. Navigate to **Jayden's** profile specifically: `/a/demo-booking-jayden`. Click **Request a booking** → `/book/demo-booking-jayden`.
5. **Booking request, 5 steps:** (1) pick a **service** or "custom project"; (2) **details** — placement, size, description, budget; (3) **references** — upload an image, and confirm the **medical disclosure** moment feels clear/safe **[WORKS]**; (4) **dates** — pick from Jayden's real availability; (5) **review & submit**. Confirm the progress affordance throughout, and trigger one **error state** (e.g. submit a step with a required field blank).
6. Left nav → **Bookings** (client view): confirm your new request appears with a status, and that you can **withdraw** it (leave it live for Flow 6). This new request is real — Jayden will triage it next.

---

## FLOW 6 — The two-sided handshake: accept → deposit → waiver → review
*Both windows. Tests the live loop + `/waivers/sign/[bookingId]`, reviews authoring.*

1. **Window A (Jayden):** go to **Bookings** → inbox → find the request the client just submitted → open it → **Accept**. Confirm it creates a booking + first session and moves into the pipeline.
2. **Window B (client):** refresh **Bookings** → confirm the request now shows as **accepted / scheduled**.
3. **Deposit [GATED]:** if prompted to pay a deposit, confirm the Stripe checkout is attempted and fails gracefully with no charge — the app stays stable.
4. **Waiver signing [WORKS]:** from the booking (client side) open the **Sign consent form** link → `/waivers/sign/[bookingId]`. Read the MD/PA template text, check the **required acknowledgments**, provide a **typed + drawn signature**, and **submit**. Confirm you get a signed-record confirmation (records are immutable). Try the **print/export** view and confirm it renders on the light **"paper"** surface.
5. **Review [WORKS]:** as the client, leave a **review** on Jayden's profile (star-pip rating + text). **Window A (Jayden):** open your profile's Reviews and post a **response** to it.

---

## FLOW 7 — Messaging with image attachments
*Both windows. Tests: `/messages`, `/messages/[threadId]`, attachments, agent-message provenance.*

1. **Window B (client):** left nav → **Messages** → open the thread with Jayden (or start one from his profile's **Message** button). Send a text message. Then use the **photo button** in the composer → attach an **image** → confirm the **preview strip**, **upload progress**, then the **image bubble** (click to view full size). If an upload errors, confirm the **warning icon + Retry** affordance (not color-only).
2. **Window A (Jayden):** open the same thread → confirm the client's message + image arrived (realtime). Reply with your own image attachment.
3. In that thread, find the **agent-authored** message from Flow 4's approval → confirm it carries the **"drafted by your assistant"** provenance treatment and a **"view in activity log"** link back to `/studio/ai`.
4. Confirm **day separators** between messages and, if a booking exists in the thread, the inline **booking-context card**.

---

## FLOW 8 — Settings, content, growth tools, try-on
*Window A, Jayden. Tests: all `/settings` tabs, `/settings/waivers`, share kit, `/try-on`.*

1. Left nav → **Settings**. Walk **every tab**:
   - **Profile:** edit bio/handle → save → confirm it persists.
   - **Locations:** edit/add a studio location.
   - **Hours / booking:** change hours + booking window (confirm single clock icon again).
   - **Services:** add / edit / delete a service (CRUD).
   - **AI staff:** move the **autonomy slider** and confirm it saves (this is what `/studio/ai` reads).
   - **Waivers** (`/settings/waivers`): pick/customize a template.
   - **Share & connect:** confirm your **booking link** `getinkd.co/a/demo-booking-jayden`, **copy** it, **download the QR** placard PNG, and copy a **link-in-bio blurb** **[WORKS]**. Confirm the **Connect Instagram** button shows the honest **"coming soon"** state **[GATED]**.
   - **Account:** confirm the **INKD Pro** card shows the **"free during pilot / coming soon"** framing **[GATED]**.
2. **Portfolio/flash management:** from your own profile (Profile nav), add/reorder a **portfolio piece**, create a **flash sheet** with an item, and toggle a post's visibility.
3. **Try-on (`/try-on`)** **[WORKS]:** upload a photo of skin (arm/leg), place a design, adjust **scale/placement**, change the **ink blend**, and confirm the **"this is a fit check, not a prediction"** honesty stamp and the dark-skin guidance note. Capture/save the result.

---

## FLOW 9 — Notifications + cross-links
*Window A. Tests: `/notifications`, bell, deep-links.*

1. Click the **bell** (top bar) → confirm the **unread badge** count and a dropdown of recent items.
2. Click **View all** → `/notifications`. Confirm the **distinct filter chips** (Requests / Accepted / Declined / Sessions / Deposits / Reviews / Responses / Messages — each labeled clearly, no duplicates).
3. Click a **booking** notification → confirm it deep-links to the right `/bookings/[id]` or `/bookings/requests/[id]`. Click a **message** notification → confirm it opens the right thread.
4. Click **Mark all read** → confirm the badge clears.

---

## Mobile parity pass (optional but recommended)
Run `pnpm --filter mobile dev`, scan the QR with **Expo Go**. Repeat **Flows 2, 5, 6, 7, 8** on the phone. The native-only things to specifically confirm (they can't be tested on web): **image/document pickers** in onboarding + booking references, **try-on capture/share**, chat **attachment picker**, and tab navigation. Everything else mirrors web.

---

## Coverage matrix — tick each once done

**Client-facing**
- [ ] `/` landing (Flow 1)
- [ ] `/auth` sign-in / sign-up / magic link / show-hide / helper (Flows 1–2)
- [ ] `/feed` feed, tabs, like/save/follow, post overlay (Flow 5)
- [ ] `/discover` map + list + all filters + pin (Flow 5)
- [ ] `/a/[handle]` Portfolio/lightbox, Posts, Flash, Info, Reviews (Flow 5)
- [ ] `/book/[handle]` all 5 steps + error state (Flow 5)
- [ ] client `/bookings` + withdraw (Flow 5)
- [ ] `/waivers/sign/[bookingId]` + paper print (Flow 6)
- [ ] review authoring (Flow 6)
- [ ] `/try-on` (Flow 8)

**Artist-facing**
- [ ] onboarding 5 steps + congrats (Flow 2)
- [ ] `/dashboard` (Flow 3)
- [ ] `/bookings` inbox / pipeline / calendar (Flow 3)
- [ ] `/bookings/requests/[id]` triage (Flow 3)
- [ ] `/bookings/[id]` detail, add session, deposit [gated] (Flow 3)
- [ ] `/studio/ai` approvals / activity / playbook / 3 staff (Flow 4)
- [ ] request accept handshake (Flow 6)
- [ ] review response (Flow 6)
- [ ] `/settings` all 8 tabs (Flow 8)
- [ ] `/settings/waivers` (Flow 8)
- [ ] share kit + QR + IG stub (Flow 8)
- [ ] portfolio / flash management (Flow 8)

**Shared**
- [ ] `/messages` + `[threadId]` + attachments + agent provenance (Flow 7)
- [ ] `/notifications` + bell + filters + deep-links (Flow 9)
- [ ] mobile parity pass (optional)

**Gated-behavior confirmations (should fail *gracefully*)**
- [ ] Deposit checkout attempts, no charge, no crash (Flows 3, 6)
- [ ] ID verification skippable (Flow 2)
- [ ] Instagram "coming soon" (Flows 2, 8)
- [ ] INKD Pro "coming soon" (Flow 8)
- [ ] AI drafting off, but seeded approvals approvable (Flow 4)
