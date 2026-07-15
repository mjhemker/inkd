# INKD — Build Specification v2 (Canonical)

*Last updated: July 14, 2026. This is the single source of truth for all build agents. The orchestrator (Fable) owns this file; agents read it, never edit it.*

## 0. Locked decisions (from Michael, 2026-07-14)

- **Goal:** pilot-ready product for ~20–50 independent artists in **Baltimore + Philadelphia** (Jayden's network). Jayden = active design partner and first user.
- **Build order:** artist ops tool first (the wedge), consumer discovery second — both complete before pilot ships.
- **Platforms:** web (Next.js) + mobile (Expo/React Native) built **in tandem** — same monorepo, shared backend and shared logic; no platform left behind. Web leads by days, never by features.
- **Monetization:** everything free for now; INKD takes a % booking fee on transactions; subscription tiers later add premium ops/AI features and remove client booking fees.
- **AI:** operational agents only — NO AI design generation. Agents must be visible, show their work, and earn trust. Tiered autonomy with artist-controlled slider (see §5).
- **Try-on:** nice-to-have, photo-based (not live AR) — later phase.
- **Instagram:** portfolio import (posts → INKD posts + portfolio pieces) + booking deeplinks; DM automation only if Meta API allows.
- **Stencils:** out of scope.
- **Waivers/consent:** target MD + PA compliance first.
- **Brand:** INKD. Black + violet-purple palette (open to complementary accents). Domain: getinkd.co.
- **Infra:** GitHub repo `mjhemker/INKD_web` (legacy prototype — strip and rebuild over it). Supabase project `khlpidflnvkqafkvkpfy` (INKD_Web, us-east-2, Postgres 17) — existing empty legacy tables may be dropped and rebuilt via proper migrations. Michael has Supabase Pro. Prefer free tiers elsewhere; paid needs sign-off.

## 1. Architecture

```
INKD_web (monorepo: pnpm workspaces + Turborepo)
├── apps/
│   ├── web/          Next.js 15+ (App Router, TS, Tailwind v4) — artist dashboard, discovery, SEO
│   └── mobile/       Expo (expo-router, TS, NativeWind) — client-first UX, artist tools too
├── packages/
│   ├── core/         shared: types, zod schemas, Supabase client, domain logic, API hooks
│   ├── ui/           design tokens (black/violet), shared primitives (web + RN via NativeWind parity)
│   └── config/       eslint, tsconfig, tailwind preset
├── supabase/         migrations, edge functions, seed data, RLS policies
└── docs/             SPEC.md (this), ADRs, phase reports
```

- **Backend:** Supabase — Postgres + Auth (dual roles) + Storage (portfolio images) + Realtime (chat) + Edge Functions (agent runtime, webhooks, Stripe).
- **Payments:** Stripe Connect (Express accounts per artist; deposits flow artist-direct minus INKD's application fee). Test mode until pilot.
- **Feature parity rule:** every user-facing feature ships as a pair (web + mobile) within the same phase. Shared logic lives in `packages/core`; screens are thin.

## 2. Data model (Phase 0 deliverable — outline)

Core entities: `profiles` (user, dual-role: client | artist; artist extends client), `artist_profiles` (bio, styles[], classification: shop_owner | shop_resident | private_suite | independent, travel modes: fly_out | house_calls | at_home), `studio_locations` (many per artist, geocoded), `services` (name, description, duration, price, deposit policy, break time, lead time, public toggle, add-ons, video-conferencing flag, calendar assignment), `availability` (business days/hours, vacation blocks, booking-window policy: 1mo | 2-3mo | 4-6mo | 1yr | books_closed), `booking_requests` → `bookings` → `sessions` (multi-session support, per-session deposits/balances), `payments` (deposits, balances, refunds, fee ledger), `waivers` (templates + signed instances, MD/PA-aware, e-signature, retention), `threads`/`messages` (client↔artist chat, agent-authored flags), `posts` + `portfolio_pieces` (Instagram-importable), `flash_sheets`, `reviews`, `styles` taxonomy, `agent_settings` + `agent_actions` (audit log) + `agent_playbooks`, `notifications`.
All tables: RLS from day one. `get_advisors` run after every migration.

## 3. Artist onboarding (Jayden's flow — build exactly this)

Progress bar across all steps; congratulations screen at the end.

1. **Identity** — name, handle, bio/description, portfolio seeding (Instagram import: every IG post → INKD post + portfolio piece; manual upload fallback).
2. **Studio location(s)** — one or more locations; classification (shop owner / shop resident / private suite / independent); travel options (fly-out, house calls, at-home).
3. **Booking info** — business days/hours; plan-ahead vacation blocks; booking-window policy (1mo / 2–3mo / 4–6mo / 1yr / books closed); client upload options during booking (images, documents); booking-agent setup (autonomy slider, §5).
4. **Services & rates** — presets (consultation, 1-hr session, half day, full day) + custom services: name, description, duration, price, break time, lead time, public-visibility toggle, available calendars, add-ons, video conferencing.
5. **ID verification** — Stripe Identity (also unlocks payouts via Connect onboarding).
→ 🎉 Congrats screen → dashboard.

## 4. Client-side scope (Phase 2)

Discovery feed (style-tagged), local map + filters that actually work (style × city × price band × availability), artist profiles (portfolio/reviews/rates/availability), booking flow with deposit + intake (placement, size, references, budget, medical flags), in-app chat, multi-session tracking, reviews.

## 5. AI agent architecture ("AI staff", Phase 3 — foundations laid in Phase 1)

**Model: INKD ships the agents; artists configure, never build.** Multi-tenant agent runtime; each artist's workspace parameterizes shared agent roles with their own data.

**Agent roles (v1):**
- **Front Desk** — inbound message triage + replies grounded in the artist's published data (rates, availability, policies, location, FAQ playbook).
- **Booking Manager** — slot proposal, holds, deposit requests, reschedules, cancellations, waitlists, multi-session planning, reminders.
- **Studio Manager** — deposit chasing, no-show follow-up, rebooking nudges (multi-session/touch-ups), aftercare messages, weekly business digest.
- **Growth Advisor** (later) — marketing/post suggestions, review requests. Suggestion-only; never posts autonomously.

**Runtime:** event-driven. Inbound event (new message, booking request, upcoming session, overdue deposit) → queue → agent run in Edge Function/worker → Claude API with **typed tools** (`read_availability`, `draft_reply`, `send_reply`, `propose_slots`, `create_hold`, `request_deposit`, `reschedule`, `flag_for_artist`, `log_note`). Agents can only act through tools; every tool call is persisted to `agent_actions`.

**Tier enforcement lives OUTSIDE the model** — a deterministic policy engine maps every action type to a tier and checks the artist's autonomy settings before execution. The LLM cannot bypass it by construction.
- **Tier 1 (auto-capable):** answering questions from published/structured data; reminders; aftercare; inquiry acknowledgment; intake collection.
- **Tier 2 (converse + confirm):** scheduling commitments, custom-request triage, quotes within artist-set ranges, reschedules — agent negotiates but requests artist confirmation before binding.
- **Tier 3 (artist-only; agent prepares, never executes):** payments/refunds/discounts, verification issues, policy exceptions, external communications, anything medical/legal/minors.

**Autonomy slider (per artist, with per-action-class overrides):**
`No-AI mode` (agents do internal organization only, nothing client-facing) → `Draft-only` (default for new accounts: agents draft, artist approves & sends) → `Assisted` (Tier 1 auto, Tier 2/3 drafted) → `Managed` (Tier 1 auto, Tier 2 proposed with one-tap confirm, Tier 3 always artist).

**Visibility & trust (hard requirements):** Agent Activity feed (every action: what, why-summary, data consulted, outcome); approval-queue inbox; per-message "drafted by your assistant" provenance internally; grounding rule — agents may never state a price/date not read from a tool; escalation triggers (medical, minors, complaints, harassment, ambiguity) always hand off; optional client-facing disclosure toggle.

**Playbook:** per-artist editable knowledge base (FAQs, tone, policies) auto-drafted from onboarding data; agents cite playbook entries in their reasoning summaries.

## 6. Phases

- **P0 Foundation:** monorepo scaffold, design tokens, Supabase schema v1 + RLS + seed, auth (dual role), CI.
- **P1 Artist core:** onboarding flow (§3), dashboard, calendar/availability, booking pipeline (inquiry → consult → deposit → sessions → aftercare → rebook), Stripe Connect deposits, waivers, chat, portfolio/flash. *Structured data + in-platform threads here are what make agents possible later.*
- **P2 Client discovery:** feed, map/filters, profiles, client booking flow, reviews.
- **P3 AI staff:** runtime + policy engine + Front Desk & Booking Manager (draft-only default), activity feed, playbook.
- **P4 Growth:** Instagram import + deeplinks, photo-based try-on, Studio Manager + Growth Advisor, premium tier gating.

## 7. Orchestration rules

Fable orchestrates only (plans, specs, reviews, Q&A with Michael) and never builds; Opus agents own architecture-level and complex implementation; Sonnet agents own components, screens, tests, seed data, docs, polish. Every deliverable is reviewed by Fable against this spec before it's accepted; failed reviews go back with a fix list. No agent may ever be a Fable agent.
