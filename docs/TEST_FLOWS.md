# INKD — Exact Click-Through Test Flows

Work through Flows 1–9 in order. When you finish Flow 9 you will have exercised **every route, tab, and feature** in the app. The coverage matrix at the bottom lets you tick each surface off.

Legend: **[WORKS]** = fully functional now · **[GATED]** = built + visible but waiting on an API key; the step tells you the *expected* limited behavior so you can confirm it fails gracefully, not silently.

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

**What's gated (so you're not surprised):** Stripe deposits won't charge, Stripe ID verification is skippable, live AI *drafting* is off (but the seeded drafts are already there to approve/reject), Instagram import shows "coming soon," INKD Pro shows "coming soon."

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
