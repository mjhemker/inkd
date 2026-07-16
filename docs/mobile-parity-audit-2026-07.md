# INKD — Web ↔ Mobile Feature-Parity Audit (2026-07-16)

Full check-through of `apps/mobile` (Expo/React Native) against `apps/web` (Next.js)
across the entire build history, per SPEC §1 "Feature parity rule: every user-facing
feature ships as a pair (web + mobile) within the same phase."

**Headline:** parity is strong. Every major web route has a real mobile counterpart —
no stub screens, no hardcoded personas (mobile screens read the real signed-in profile
via `packages/core` hooks), correct role-based nav (Bookings live inside the artist
Studio hub; clients get Bookings as a direct tab), and the same shared editors/logic.
The gaps found are integration-level and one cross-cutting light-mode theming issue —
not missing features. Genuine, well-scoped gaps were fixed this pass; the rest are
documented below with justification and scope.

Audited at HEAD `c029d03`. Fixes committed on worktree branch
`worktree-agent-a238ef6434de8a74f`.

---

## 1. Parity matrix (condensed)

Status: **parity** = feature present and wired the same · **partial** = present but a
sub-feature/UX diverges · **web-only** = intentionally web-first · **fixed** = gap
closed this pass.

| Area / feature | Web | Mobile | Status |
|---|---|---|---|
| Auth: email/password, magic-link | ✓ | ✓ | parity |
| Signup account-type (client vs artist) | ✓ | ✓ | parity |
| Post-login role routing | ✓ (callback) | ✓ (inline) | parity |
| Onboarding shell (5 steps, progress, resume, congrats) | ✓ | ✓ | parity |
| Onboarding step-1 Identity (name/handle/bio/avatar/styles/portfolio/IG import) | ✓ | ✓ | parity |
| Onboarding step-2 Locations + classification + travel modes | ✓ | ✓ | parity |
| Onboarding step-3 Booking window, upload options, vacation blocks | ✓ | ✓ | parity |
| Onboarding step-3 Hours grid | drag-to-paint week grid | per-day time-block list | **partial** (see G-1) |
| Onboarding step-3 AI autonomy slider | ✓ | ✓ | parity |
| Onboarding step-4 Services (presets + custom, all fields) | ✓ | ✓ | parity |
| Onboarding step-5 ID verification + congrats | ✓ (stub) | ✓ (stub) | parity |
| Dashboard stats + Today panel + AI card | ✓ | ✓ | parity |
| Bookings pipeline (inquiry→…→rebook) | Kanban | stacked sections | parity (adapted) |
| Bookings calendar week/month **grid** | time grid + month grid | agenda list w/ same chrome | **partial** (see G-2) |
| Request triage (accept/decline/ask) | ✓ | ✓ | parity |
| Booking detail (multi-session, per-session deposits, add-session, deposit req/pay, complete/cancel, healing, reviews, consent) | ✓ | ✓ | parity |
| Reschedule date entry | native datetime picker | raw `YYYY-MM-DDTHH:MM` text | **partial** (see G-3) |
| Client bookings (withdraw/cancel/view) | ✓ | ✓ | parity |
| Messaging: text, realtime, new-thread compose | ✓ | ✓ | parity |
| Messaging: image attachments (send + display + lightbox) | ✓ | ✓ | parity |
| Messaging: agent "drafted by assistant" provenance + deep-link | ✓ | ✓ | parity |
| Notifications list + mark read / mark-all | ✓ | ✓ | parity |
| Notification preferences (categories × channels) | ✓ | ✓ (+ push enable card) | parity |
| Notification → deep-link resolution | ✓ | ✓ | parity |
| Push registration | web toggle only, no endpoint | full Expo token register/deregister | mobile-ahead (see W-1) |
| Discovery feed (daily-drop card, style filter, post→profile) | ✓ | ✓ | parity |
| Feed like/save/follow **auth-gating** | disabled when signed out | fired regardless | **fixed** |
| Feed "See all → daily-drop" link | ✓ | added | **fixed** |
| Feed empty-state tool cards (match / try-on) | ✓ | added | **fixed** |
| Local search + filters (style/city/price/distance sliders, near-me, books-open) | ✓ | ✓ | parity |
| Discover map view | MapLibre tiles | list + distance + "map coming soon" | web-only / platform-limited (see W-2) |
| Discover "shops near you" strip | ✓ | — | **partial** (see G-4) |
| Match-my-inspiration (image → matched artists) | ✓ | ✓ | parity |
| Match refine-by-style + intersect discover filters | ✓ | read-only tags | **partial** (see G-5) |
| Daily-drop full screen (today + history) | ✓ | ✓ | parity |
| Public artist profile (portfolio/posts/flash/info/reviews) | ✓ | ✓ | parity |
| Public profile shop badge → shop page | ✓ | ✓ | parity |
| Booking request flow (service, body-map placement, references, dates, medical) | ✓ | ✓ | parity |
| Waivers signing (MD/PA content, retention, acknowledgments, immutable) | ✓ | ✓ | parity |
| Waiver **drawn** e-signature | canvas SignaturePad | typed-name only | **partial** (see G-6) |
| Waiver sign-in return context | `?next=` | added | **fixed** |
| Try-on (photo upload → placement → export/share) | ✓ | ✓ | parity |
| Try-on light-mode theming | tokenized | dark-only StyleSheet | **partial** (see G-7 / theming) |
| Reviews (display, submit, artist response) | ✓ | ✓ | parity |
| Settings — all 11 tabs (profile/locations/hours/services/shop/ai/waivers/grow/notifications/appearance/account) + aftercare toggle | ✓ | ✓ (real editors, no stubs) | parity |
| Settings `?tab=` deep link | ✓ | added | **fixed** |
| Settings Instagram OAuth **return handling** | `?instagram=` callback + toast | external browser, silent refetch | **partial** (see G-8) |
| AI staff (approvals / activity / playbook + provenance + tier) | ✓ | ✓ | parity |
| AI approvals count badge on tab | ✓ | via overview only | partial (cosmetic) |
| Shops: owner dashboard (roster + invite) | ✓ | ✓ | parity |
| Shops: public page (hero, roster, locations) | ✓ | ✓ | parity |
| Public shop "Hosted by <owner>" attribution | ✓ | added | **fixed** |
| Aftercare: client check-in + artist healing timeline | ✓ | ✓ | parity |
| Waitlist: join / offer / claim / pass + artist view | ✓ | ✓ | parity |
| Account: plan card, sign-out, downgrade-to-client, delete-account | ✓ | ✓ | parity |
| Light/dark theme system + INKD branding | ✓ | ✓ (dark default) | parity |
| Cross-cutting: JS-prop icon colors follow theme | via `currentColor` | hardcoded hex | **partial** (see Theming) |

---

## 2. What was fixed this pass (per-area commits)

1. **Feed auth-gating + discovery surfacing** (`app/(tabs)/index.tsx`,
   `components/feed/FeedCard.tsx`, `components/feed/PostDetailSheet.tsx`,
   `components/daily-drop/DailyDropCard.tsx`, `app/daily-drop.tsx`)
   - Added an optional `signedIn` prop (default `true`) to `FeedCard`,
     `PostDetailSheet`, `DailyDropCard`; the feed and daily-drop screens now read
     `useCurrentProfile()` and disable like / save / follow when signed out, matching
     web (`disabled={!signedIn}`). Prevents anonymous mutations firing with no prompt.
   - Added the "See all" link from the feed drop header into `/daily-drop`.
   - Added the two client-facing tool cards ("Match my inspiration", "Try a design
     on") to the feed empty state, mirroring web `FeedEmptyState`.

2. **Settings `?tab=` deep link** (`app/settings.tsx`) — initialises the active tab
   from `useLocalSearchParams().tab` (validated against `TABS`), matching web. Fixes
   notification/cross-link deep links to a specific settings tab landing on Profile.

3. **Waiver sign-in return context** (`app/auth.tsx`, `app/waivers/sign/[bookingId].tsx`)
   — mobile auth now honours a safe internal `?next=` path after sign-in (mirrors the
   web auth callback); the waiver screen passes `next=/waivers/sign/<id>` so a
   signed-out client returns to the waiver rather than the generic feed.

4. **Public shop host attribution** (`app/shop/[handle].tsx`) — added the linked
   "Hosted by <owner>" line under the roster header, matching web `ShopProfileView`.
   (Owner was already excluded from the roster list; they were simply invisible.)

All four commits carry the `Co-Authored-By: Claude Fable 5` trailer.

---

## 3. Remaining genuine gaps (with scope for a follow-up wave)

Ordered by client-facing impact.

- **Theming (cross-cutting, highest breadth) — hardcoded icon hex won't follow light
  mode.** The mobile theme system is real (`providers/theme.tsx` exposes
  `useTheme().colors`, `AppearanceControl` offers Dark/Light/System) and all
  `className`-styled surfaces re-skin correctly via NativeWind tokens. But nearly
  every screen passes literal hex to JS color props — `<Icon color="#FAFAFA">`,
  Feather glyph colors, and `try-on`'s whole StyleSheet — instead of
  `useTheme().colors`. In **light mode** these render frozen dark-theme values; the
  worst are near-white `#FAFAFA` glyphs/back-chevrons that become near-invisible on a
  light surface (e.g. `match-inspiration` back chevron, `shop/[handle]` back chevron,
  `try-on` entirely). Dark is the launch default so this does not affect the primary
  experience today, but it breaks the "light/dark theme" parity claim.
  **Scope:** ~30 files; add `useTheme()` and swap literal icon-color constants for the
  resolved palette (and convert `try-on.tsx`'s StyleSheet to tokens/`useTheme`). Purely
  mechanical, no logic changes; ~0.5–1 day. Recommend a single dedicated "light-mode
  icon-color" wave rather than piecemeal edits, to keep it consistent. Deferred here to
  avoid large low-signal churn across the surface in an audit pass.

- **G-1 — Onboarding/settings hours grid is a list, not a drag-to-paint grid**
  (`components/artist/booking-editor.tsx`). Web `WeeklyHoursGrid` is a Calendly-style
  7-day visual grid (drag to create/move/resize, 15-min snap, overlap merge) that also
  projects time-off blocks as shaded columns. Mobile uses per-day start/end time-picker
  rows over the **same** `WeeklyBlock`/`reconcileRules` data model. Data parity is
  intact; this is a UX-fidelity gap and a reasonable touch adaptation, but time-off is
  not visualised on the hours UI. **Scope:** medium (build an RN week-grid or at least
  project time-off onto the list); ~1–2 days. Artist-facing → medium priority.

- **G-2 — Bookings calendar has no week/month grid on mobile**
  (`components/bookings/artist-bookings.tsx` `CalendarView`). Web renders a true time
  grid (7 day columns × hour rows, positioned session placards, overlap columns,
  now-line) and a month cell grid. Mobile ported the chrome (period nav, exact
  week/month label, Week/Month toggle, legend) but renders an **agenda list** for both
  modes. Functional (sessions are all reachable), spatially degraded. **Scope:** the web
  overlap-layout logic is portable; ~1–2 days for a week time-grid, +~0.5 day for the
  month grid. Artist-facing → medium priority.

- **G-3 — Reschedule uses a raw text date field** (`components/bookings/booking-detail.tsx`).
  Mobile takes `YYYY-MM-DDTHH:MM` as free text vs web's native `datetime-local`.
  Error-prone. **Scope:** small — drop in a native date/time picker; ~2–3 hrs.

- **G-4 — Discover "shops near you" strip missing** (`app/(tabs)/discover.tsx`). Web
  `ShopStrip` has no mobile equivalent. **Scope:** small–medium; ~0.5 day.

- **G-5 — Match-inspiration results are not refinable on mobile**
  (`app/match-inspiration.tsx`). Web lets you tap detected-style chips and intersect
  with discover filters (location/price/books) and re-run the neighbor search; mobile's
  detected-tags panel is read-only and has no filter bar. Documented as a this-wave
  deferral in-file. Also: mobile proxies the tagging step through a web-hosted route via
  `EXPO_PUBLIC_MATCH_INSPO_URL`; if unset the feature shows a "runs on web for now"
  state. **Scope:** medium; ~1 day + confirming the tag endpoint config for pilot.

- **G-6 — Waiver drawn e-signature missing** (`app/waivers/sign/[bookingId].tsx`).
  Mobile captures `signature_type: "typed"` (typed name) only; web adds a canvas
  `SignaturePad` (`signature_type: "drawn"`). Documented deferral in-file. Typed
  signatures are still valid e-signatures, but signed records differ in fidelity across
  platforms. **Scope:** medium — add a `react-native-svg`/PanResponder pad (or
  `react-native-signature-canvas`); ~0.5–1 day. Client-facing/legal → prioritise if
  drawn signatures are a compliance expectation for MD/PA.

- **G-7 — Try-on is dark-only** — see Theming above; folded into that wave.

- **G-8 — Instagram OAuth has no return-to-app handling on mobile**
  (`components/artist/connected-accounts.tsx`). Uses `Linking.openURL` (external
  browser, no callback), so after authorizing there is no redirect route and no
  success/failure toast — it relies on a silent refetch on next mount. Web handles the
  `?instagram=connected|denied|error` return and toasts. **Scope:** medium — switch to
  `WebBrowser.openAuthSessionAsync` with a deep-link redirect + result toast; ~0.5 day.
  Depends on the IG import feature being un-gated (currently "Coming soon" on both).

### Cosmetic / low priority
- Onboarding left-rail step checklist (web) vs single "Step X of 5" eyebrow (mobile).
- AI approvals **count badge** on the tab (web) — mobile surfaces the count via
  `StaffOverview` only.
- Chat image attachments not client-resized before upload on mobile (web resizes to
  ~1600px) — heavier cellular uploads, non-functional.

---

## 4. Web-only / intentional & non-actionable

- **Discover map tiles (W-2):** mobile ships list + distance ranking + a "map coming
  soon" placard by design; native map tiles are a deferred platform choice, not a
  regression. Filters/search are fully present.
- **Web push (W-1):** web exposes a "Push" preference toggle but never subscribes a
  browser endpoint (no service worker / VAPID) — the toggle's helper text says push is
  delivered to the mobile app. Mobile push registration is fully implemented and
  exceeds web here. This is a **web-side** follow-up (build web push or relabel the
  toggle), not a mobile gap.
- Heavy artist-admin print/export surfaces: none found that mobile lacks; the shop
  dashboard, AI staff, and settings editors are all present on mobile.

---

## 5. Verify matrix

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | ✓ ok |
| `pnpm --filter mobile exec tsc --noEmit` | ✓ **clean** (0 errors) |
| `pnpm turbo lint typecheck` (all 6 workspaces) | ✓ pass (4 pre-existing `any` warnings in web waitlist, untouched) |
| `pnpm --filter web build` | ✓ pass (no web files changed) |
| expo-router registration | ✓ no new screen files added; all edits are to existing routes/components, no orphan/unreachable routes introduced |
| deep-links from notifications | ✓ resolve to real mobile routes; settings `?tab=` deep link now honoured |

---

## 6. Device-QA list for the founder (prioritised)

Cannot be verified without an emulator/device; please spot-check on hardware:

1. **Light mode across the app** — flip Appearance → Light and scan every screen for
   frozen/invisible icons (feed, discover, daily-drop, match-inspiration back chevron,
   shop back chevron, try-on entirely). This is the biggest known visual gap.
2. **Feed while signed out** — confirm like/save/follow are visibly disabled (40%
   opacity) and don't fire; confirm the "See all" drop link and the two empty-state
   tool cards navigate correctly.
3. **Settings deep links** — open settings via a notification / link with
   `?tab=notifications` (and `ai`, `account`) and confirm it opens that tab.
4. **Waiver signing signed-out** — tap "Sign in" from a waiver link, authenticate, and
   confirm you return to the waiver (not the feed).
5. **Public shop page** — confirm "Hosted by <owner>" renders and links to the owner's
   profile.
6. **Bookings calendar** — confirm the agenda list is acceptable for pilot, or greenlight
   the week-grid follow-up (G-2).
7. **Reschedule flow** — the raw date text field (G-3) is the most error-prone client
   touchpoint; confirm or prioritise the picker.
8. **Push notifications end-to-end** on a physical device (token registration is
   simulator-limited).
