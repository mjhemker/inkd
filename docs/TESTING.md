# INKD — Pilot Test Script (for Michael)

*Last updated: 2026-07-15. This is the hands-on guide for exercising the pilot
build on web + mobile. It complements [`SPEC.md`](SPEC.md) (the what/why) with a
concrete "sign in here, click this, expect that" walkthrough.*

---

## 0. Quickstart

```bash
# from the repo root
pnpm install

# copy env templates, then paste the real Supabase anon key into each
cp apps/web/.env.example    apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env

pnpm dev            # runs web + mobile together via Turborepo
# or individually:
pnpm --filter web dev        # http://localhost:3000
pnpm --filter mobile dev     # Expo dev server → scan QR with Expo Go
```

### Env setup (the one thing you must do)

Both `.env.example` files already contain the **real project URL**
(`https://khlpidflnvkqafkvkpfy.supabase.co`) — that part is safe and committed.
The **anon key is a placeholder** (`your-supabase-anon-key-here`). Pull the real
anon key from the Supabase dashboard (Project → Settings → API → `anon public`)
and paste it into:

- `apps/web/.env.local`   → `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
- `apps/mobile/.env`      → `EXPO_PUBLIC_SUPABASE_ANON_KEY=...`

The anon key is public by design — RLS enforces all access, so it is safe on the
client. Do **not** paste the service-role key here.

Prereqs: Node ≥ 20, pnpm 10 (`corepack enable`). For mobile: the Expo Go app on
your phone (iOS/Android) on the same network, or a simulator.

---

## 1. Demo personas (already seeded — password is `Password123!`)

Every login account below is email-confirmed with password **`Password123!`**.
Sign in on either platform via the **Sign in** screen (web `/auth`, mobile
Profile tab → Sign in).

| Email | Persona | Role | What it demonstrates |
| --- | --- | --- | --- |
| `demo-booking-artist@inkd.test` | **Jayden Cole** (@demo-booking-jayden) | Artist (published) | The main artist. Has **4 pending AI approvals**, booking requests, and active chat threads. Start here for the ops/AI tour. |
| `demo-booking-client@inkd.test` | Mara Vance (@demo-booking-mara) | Client | The client side of Jayden's bookings + chat. Use to see the booking request / messaging from the customer's view. |
| `demo-folio-artist@inkd.test` | Nova Reyes (@demo-folio-nova) | Artist (published) | A portfolio-rich published profile — good for the profile/portfolio management surfaces. |
| `demo-waiver-artist@inkd.test` | Jayden Cole (waiver persona) | Artist | Drives the **waiver signing** flow. Intentionally minimal (unpublished, no public handle). |
| `demo-waiver-client@inkd.test` | Riley Client | Client | The client who signs the waiver. |

**Feed/discover display artists (no login — seeded for content):** Marcus Vane,
Priya Anand, Desmond Wright, Sofia Marchetti (`*@inkd.demo`). These populate the
discovery feed and local map so those surfaces aren't empty. You cannot log in as
them by design.

**Prefer a fresh account?** You can also just **sign up** with a new email on
`/auth` and walk the full artist onboarding from scratch — that is the truest
test of the first-run experience.

---

## 2. What to try — web (`http://localhost:3000`)

Sign in as **`demo-booking-artist@inkd.test`** unless noted.

**Public (no login needed):**
- `/` — marketing landing.
- `/a/demo-booking-jayden` — public artist profile + booking CTA + share kit
  (`getinkd.co/a/…` link). Also `/a/demo-folio-nova`, `/a/marcus-vane`, etc.
- `/try-on` — photo-based tattoo fit-check (drag/scale/rotate, ink blend,
  before/after). Fully client-side; works with zero backend.
- `/dev` — internal harness index: every screen rendered offline against mock
  data (UI kit, onboarding, feed, discover, chat, reviews, notifications,
  try-on, AI staff, Instagram, Pro plan). Great for a fast visual sweep.

**Signed-in (artist):**
- **Home** (`/feed`) — discovery feed with posts + flash.
- **Discover** (`/discover`) — live local map + style/city/price/availability
  filters.
- **Bookings** (`/bookings`) — request → booking → sessions pipeline; open a
  request or booking detail.
- **Messages** (`/messages`) — realtime chat with image attachments.
- **Profile** (`/profile`) — manage portfolio, posts, flash; "View public
  profile" jumps to `/a/[handle]`.
- **Dashboard** (`/dashboard`) — ops overview (revenue/activity tiles are an
  honest "coming soon" placeholder) + the AI staff summary card.
- **AI staff** (`/studio/ai`) — the trust surfaces: **approvals inbox** (4
  pending proposals for Jayden), provenance + tier stamps, the activity ledger,
  and the playbook editor. Approving/rejecting a proposal works (the
  `approve-agent-action` function is live).
- **Settings** (`/settings`) + **Settings → Waivers** (`/settings/waivers`) —
  identity, locations, booking policy, services, agent autonomy slider, waiver
  templates, and the Share & connect tab (Instagram + share kit).
- **Notifications** (`/notifications`) — bell + hub; items deep-link to
  `/bookings/[id]`, `/messages/[threadId]`, etc.

**Auth gating:** visiting `/dashboard`, `/bookings`, `/messages`, `/settings`,
`/onboarding`, `/studio/ai`, `/notifications`, or `/profile` while signed out
bounces you to `/auth?next=…` and returns you after sign-in. `/`, `/auth`,
`/try-on`, `/a/[handle]`, `/feed`, and `/discover` stay public.

---

## 3. What to try — mobile (Expo Go)

Run `pnpm --filter mobile dev`, scan the QR with Expo Go.

- **Tabs:** Home (feed), Discover, Bookings, Messages, Profile.
- **Profile tab** is the hub for artists: "Edit profile", "View public profile",
  and (new) **Dashboard** + **Studio settings** buttons. The bell (top-right of
  Profile) opens **Notifications**.
- **Studio settings** → tabs for identity/locations/booking/services/agent, plus
  entry points to **Waivers** and **AI staff** (`/studio/ai`).
- **Try-on** is reachable from a feed post's detail sheet ("try this design").
- Booking, chat (realtime), reviews, and notifications mirror the web flows.
- Sign in with the same demo credentials above.

---

## 4. Expected to work vs. known-limited

**Works end-to-end (with the real anon key + network):**
auth & dual-role sign-up · artist onboarding wizard · profile/portfolio/posts/
flash management · public profiles + share kit · discovery feed · discover map +
filters · booking pipeline · realtime chat with attachments · reviews ·
notifications + deep-links · waiver templates + signing (MD/PA) · AI-staff trust
surfaces incl. approve/reject of proposed actions · photo try-on.

**Known-limited — awaiting API keys / deploys (honest gaps, see §5):**

| Area | State | Why |
| --- | --- | --- |
| **Payments** (Stripe Connect deposits, checkout, webhook) | UI present, not functional | `create-deposit-checkout`, `connect-onboarding-link`, `stripe-webhook` edge functions are **not deployed** — need Stripe keys. |
| **AI agent drafting / auto-run** | Trust UI + approvals live; drafting not | `agent-run` / `agent-scheduled` **not deployed** — need `ANTHROPIC_API_KEY`. The seeded proposals let you exercise the approvals inbox now. |
| **Instagram import** (posts → portfolio) | Key-gated scaffold, shows "coming soon" | `instagram-oauth` / `instagram-import` **not deployed** — need Meta app approval + `IG_APP_ID`/`IG_APP_SECRET`. The **share kit** (booking links) works today. |
| **ID verification** (Stripe Identity) in onboarding | Step present, skippable | Part of the Stripe integration above. |
| **INKD Pro / subscriptions** | "Coming soon" placard | Intentional — free for pilot. |

**Sandbox note:** live end-to-end can't be exercised inside the CI/agent sandbox
because egress to `*.supabase.co` is blocked there. On your machine (real network
+ anon key) the data-backed surfaces work normally.

---

## 5. Deploy checklist (function × required secret)

Two functions are already **ACTIVE**; the rest are code-complete but **not
deployed** pending the secrets below.

| Edge function | Status | Required secrets (beyond auto-injected `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`) |
| --- | --- | --- |
| `geocode-location` | ✅ ACTIVE | none |
| `approve-agent-action` | ✅ ACTIVE | none |
| `agent-run` | ⛔ not deployed | `ANTHROPIC_API_KEY` (opt: `AGENT_MAX_TOKENS`) |
| `agent-scheduled` | ⛔ not deployed | (invokes `agent-run`) `ANTHROPIC_API_KEY` |
| `create-deposit-checkout` | ⛔ not deployed | `STRIPE_SECRET_KEY`, `INKD_APP_URL` (opt: `STRIPE_CURRENCY`, `STRIPE_MIN_CHARGE_CENTS`) |
| `connect-onboarding-link` | ⛔ not deployed | `STRIPE_SECRET_KEY`, `INKD_APP_URL` |
| `stripe-webhook` | ⛔ not deployed | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| `instagram-oauth` | ⛔ not deployed | `IG_APP_ID`, `IG_APP_SECRET`, `IG_REDIRECT_URL` |
| `instagram-import` | ⛔ not deployed | `IG_APP_SECRET` (+ IG OAuth configured) |

Deploy a function with `supabase functions deploy <name>` and set secrets with
`supabase secrets set KEY=value` (or via the dashboard).

---

## 6. Gates (all green as of this audit)

| Gate | Result |
| --- | --- |
| `pnpm install` | ✅ |
| `pnpm turbo lint typecheck` | ✅ 8/8 tasks |
| `pnpm --filter web build` | ✅ all routes |
| `pnpm --filter mobile exec tsc --noEmit` | ✅ |
| `node --test supabase/functions/_shared/*.test.ts supabase/functions/geocode-location/*.test.ts` | ✅ 144/144 |

> Note: run the function tests against the `.test.ts` files (as above), not the
> whole `supabase/functions/` directory — pointing at the directory pulls in
> Deno-only runtime source that Node can't resolve.
