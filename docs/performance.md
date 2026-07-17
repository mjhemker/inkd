# Performance pass (2026-07)

A targeted, measured perf pass on the web app (mobile secondary). Scope was
kept mechanical on purpose — image-loading attributes, a shared realtime
subscription registry, a missing dynamic import, and an audit of query
caching and mobile list rendering. No visual, data-model, or API changes.

## Founder note: why dev mode feels slow

`pnpm dev` is unminified, does on-demand compilation per route (each
navigation triggers a fresh compile the first time you hit it), and skips
most production optimizations (tree-shaking, minification, React's dev-mode
checks add overhead too). This is normal and not a regression — it will
always feel slower than the deployed app, especially on a loaded dev machine.

To feel what production actually performs like locally:

```bash
pnpm --filter web build && pnpm --filter web start
```

This builds the optimized bundle (same one that ships) and serves it — no
recompilation on navigation, minified JS, production React. Use this to
sanity-check "does this feel slow" complaints before assuming something is
actually wrong.

## Before / after: route sizes (top routes by First Load JS)

Measured via `pnpm --filter web build` at the repo root (`apps/web`),
Next.js 15.5.20. All numbers are "First Load JS" from the build's route
table. No route regressed; one route (`/dev/discover`) improved
substantially. Every other route is unchanged because the remaining
optimizations (image loading attributes, realtime dedup, query staleTime)
affect *runtime* network/render behavior, not JS bundle size — they don't
show up in this table by design.

| Route | Before | After | Δ |
|---|---|---|---|
| `/dev/discover` | 369 kB | **159 kB** | **−210 kB** |
| `/dev/profile-preview` | 284 kB | 284 kB | — |
| `/dev/profile-preview/public` | 279 kB | 280 kB | — |
| `/dev/settings-preview` | 225 kB | 225 kB | — |
| `/dev/onboarding-preview` | 218 kB | 218 kB | — |
| `/dev/instagram-preview` | 214 kB | 215 kB | — |
| `/dev/account-preview` | 213 kB | 214 kB | — |
| `/settings` | 213 kB | 213 kB | — |
| `/onboarding` | 210 kB | 210 kB | — |
| `/studio/shop` | 210 kB | 210 kB | — |
| `/dev/hours-preview` | 205 kB | 206 kB | — |
| `/dev/plan-preview` | 205 kB | 205 kB | — |
| `/auth` | 203 kB | 203 kB | — |
| `/bookings/[id]` | 195 kB | 195 kB | — |
| `/dev/ai-staff-preview` | 197 kB | 197 kB | — |
| `/feed` | 193 kB | 193 kB | — |
| `/discover` (real, MapLibre already dynamic-imported) | 190 kB | 190 kB | — |
| `/a/[handle]`, `/book/[artistHandle]` | 191 kB | 191 kB | — |

(`/dev/*` are offline preview/harness routes, not linked from product nav,
but they're still built — `/dev/discover` was the single heaviest route in
the app before this pass.)

Shared chunks (`+ First Load JS shared by all`) unchanged at 103 kB.

## What was done

### 1. `/dev/discover`: dynamic-import the map (−210 kB)
`apps/web/src/app/dev/discover/page.tsx` statically imported `DiscoverMap`
(MapLibre GL JS + its CSS), shipping the whole map bundle synchronously. The
real `/discover` route (`apps/web/src/components/discover/DiscoverView.tsx:27`)
already dynamic-imports the same component with `ssr:false` — this harness
had just never been updated to match. Applied the identical pattern.
Measured: 369 kB → 159 kB first-load JS.

### 2. Realtime channel dedup (notifications + agent_actions)
Found two confirmed cases where a single mounted component opens **two
separate Realtime channels to the identical topic**, because Supabase's
`client.channel(topic)` doesn't dedupe:

- `NotificationBell` (`apps/web/src/components/notifications/notification-bell.tsx:33-34`)
  calls both `useUnreadNotificationCount` and `useNotifications` for the same
  profile — each independently subscribed to `notifications:<profileId>`.
- `AiStaffView` (web `apps/web/src/components/ai-staff/AiStaffView.tsx:50-51`
  and mobile `apps/mobile/app/studio/ai.tsx:57-58`) calls `useAgentActions`
  twice (proposed queue + activity feed) — each independently subscribed to
  `agent_actions:<artistId>`.

Every row change was firing — and triggering `invalidateQueries` from — 2x
the listeners it needed to. Added `packages/core/src/api/realtimeShare.ts`,
a small topic-keyed, ref-counted registry: `subscribeShared(client, topic,
bind, onEvent)` opens one underlying channel per topic, fans events out to
every registered listener, and tears the channel down once the last listener
detaches. `subscribeToNotifications` and `subscribeToAgentActions` now route
through it. Public API changed from "returns a `RealtimeChannel`, caller does
`client.removeChannel(channel)`" to "returns an unsubscribe function" — all 4
internal call sites (in `packages/core/src/hooks/`) were updated; nothing
outside the package called these functions.

This is a shared `packages/core` fix, so mobile's `studio/ai.tsx` and
`DashboardCard.tsx` (which also calls `useAgentActions`) get the same benefit
automatically without a mobile-specific change.

### 3. Image loading attributes (lazy + async decode)
No `<img>` in the web app had `loading`/`decoding` hints — every tattoo photo
in a grid or list downloaded eagerly regardless of viewport position. Added
`loading="lazy" decoding="async"` to grid/list tiles:

- Feed cards (`FeedCard.tsx`), matched-artist cards (`MatchArtistCard.tsx`)
- Portfolio / flash / posts management grids (`PortfolioPanel.tsx`,
  `FlashPanel.tsx` ×2, `PostsPanel.tsx`)
- Public artist profile grids (`ArtistProfileView.tsx` ×3 — portfolio,
  posts, flash)
- Booking reference-photo thumbnails (`bookings/shared.tsx`)
- Chat attachment thumbnails (`MessageBubble.tsx` — the lightbox full image
  was left eager, since it's opened deliberately and should paint
  immediately)
- Daily-drop history tiles (`DailyDropSurface.tsx`)
- The shared `Avatar` component (`packages/ui/src/web/Avatar.tsx`) — used in
  nav, feed, discover placards, messages, notifications; one change,
  app-wide effect

**Deliberately left eager** (LCP-sensitive, single hero images, not grids):
the chat lightbox full image, and `/daily-drop`'s "full" variant hero card
(`DailyDropCard.tsx` now branches `loading={full ? "eager" : "lazy"}` since
the same component serves both the page hero and a compact feed card).

**Not done: migrating to `next/image`.** The task allowed "next/image or at
minimum width/height + lazy loading + async decoding" — took the minimum-risk
path. A real `next/image` migration needs `images.remotePatterns` wired to
the Supabase Storage domain and touches every image's markup (width/height
vs. `fill`, `sizes`), which is a bigger, riskier diff than this round's
budget for a codebase with zero existing `next/image` usage. Flagged as a
good follow-up, not attempted here.

### 4. React Query caching — audited, mostly already correct
`packages/core/src/hooks/context.tsx:38-42` already sets sane global defaults
(`staleTime: 30_000, retry: 1, refetchOnWindowFocus: false`), and the hooks
that need something longer already override it explicitly: `useStyles`
(taxonomy, 5 min), `useArtistContent` (5 min), `useAftercare` (50 min, signed
URL lifetime), `useFeed` (5 min), `useShops`/`useDiscover` (30s, intentional
for filter responsiveness), `useInstagram` (15s). No hook was found fetching
on every mount with no cache, and no refetch-storm pattern was found. No
changes made here — it was already in reasonable shape.

### 5. Memoization — audited, deliberately not applied
Checked the two examples called out (feed cards, calendar cells):

- **Calendar**: `sessions-calendar.tsx`'s month/week grid cells are inline
  JSX inside a `.map()`, not an extracted component — nothing to wrap in
  `memo()`. The small mapped sub-components (`SessionChip`, `SessionBlock`)
  render ≤42 items and get a stable-enough single-object prop; too cheap to
  matter.
- **FeedCard**: `FeedScreen.tsx` passes `FeedCard` three inline arrow
  functions (`onOpen`, `onToggleLike`, `onToggleSave`) created fresh on every
  render, none wrapped in `useCallback`. Wrapping `FeedCard` in `React.memo`
  as-is would be a no-op — `memo`'s shallow prop comparison would see new
  function identities every render and re-render every card anyway. Making
  this actually pay off needs `useCallback` on those three handlers in
  `FeedScreen.tsx` *and* `memo(FeedCard)` together, and `FeedScreen.tsx` is a
  file this round explicitly avoided restructuring (adjacent to the
  feed-filter-UI lane another agent owns this round, and the instruction was
  memoize "ONLY where profiling shows re-render churn," which wasn't run
  here — this was static-code reasoning, not a profiler trace). Left as a
  scoped, actionable follow-up rather than guessed at.

### 6. Mobile pass — audited, list-virtualization gaps documented, not converted
Confirmed already correct: home feed, discover results, thread list, and
chat thread all use `FlatList` (not `ScrollView` + `.map()`).

Found several screens still using `ScrollView` + `.map()` over lists that
grow unbounded with account age — worst first:

1. `apps/mobile/components/bookings/artist-bookings.tsx` /
   `client-bookings.tsx` (rendered from `app/(tabs)/bookings.tsx`) — inbox +
   pipeline, unbounded booking-request/booking history, a core tab screen.
2. `apps/mobile/app/notifications.tsx` — manual "Load more" pagination inside
   a `ScrollView`; every page loaded stays mounted.
3. `apps/mobile/app/studio/ai.tsx` — activity ledger, capped at `limit: 100`
   but still unvirtualized.
4. `apps/mobile/app/artist/[handle].tsx` (public profile) and the matching
   artist-owned `PortfolioPanel.tsx`/`FlashPanel.tsx`/`PostsPanel.tsx` —
   portfolio/posts/flash grids sized to career-length content.

None were converted. Booking screens and the profile/portfolio screens sit in
this round's explicitly protected lanes (booking flow, profile). The
notifications screen would need real layout restructuring to virtualize
correctly (moving the header/filter-chip row into `ListHeaderComponent` and
the bordered-card list-item wrapper into per-item styling) rather than a
drop-in swap — judged not "trivial" enough to risk a visual regression this
round. Recommended as a focused follow-up task per screen.

Image sizing on mobile is already disciplined (every `<Image>` found has an
explicit sized wrapper + `resizeMode`). The real gap: **`expo-image` is not
installed anywhere** (0 of 27 `<Image>` usages) — every image, including the
shared `Avatar` (`packages/ui/src/native/Avatar.tsx:53`, used almost
everywhere), is plain RN `Image` with no disk cache. Adding `expo-image` and
swapping `Avatar` first (highest leverage, one change) is the natural next
step; not done this round since it's a new dependency + behavior change
across every screen, which felt like more risk than this pass's budget.

## Skipped as too risky (full list)

- **`next/image` migration** — zero existing usage in the codebase; needs
  `next.config.ts` `images.remotePatterns` for Supabase Storage plus a markup
  change (`fill`/`sizes`) per image site. Bigger diff than warranted for this
  pass.
- **Settings tab code-splitting** — `apps/web/src/app/(app)/settings/settings-view.tsx`
  statically imports all 11 tab panels' components (`AgentAutonomyEditor`,
  `BookingEditor`, `ShopSettingsPanel`, `ShareKit` + `qrcode`, etc.) even
  though only the active tab renders (`tab === "..." &&` conditional
  rendering, confirmed at lines 162-211). Converting each to
  `next/dynamic(...)` would likely cut real weight off `/settings`'s 213 kB
  first-load — but `settings` is this round's explicitly protected lane
  (named directly in the task's DO-NOT list) and this file is under active
  concurrent development (recent commit added `?tab=` deep-linking). Flagged
  as the single highest-value follow-up for whichever agent owns `settings`
  next.
- **FeedCard `React.memo` + `useCallback`** — see §5 above; needs
  `FeedScreen.tsx` changes in the feed lane.
- **Mobile `ScrollView`→`FlatList` conversions** — see §6 above; booking and
  profile screens are protected lanes this round, and notifications/AI-staff
  activity need real (not drop-in) restructuring to virtualize correctly.
- **`expo-image` adoption** — new dependency + behavioral change across
  every screen; scoped as a follow-up rather than done inline here.

## Verification run

- `pnpm install` — clean
- `pnpm turbo lint typecheck` — 8/8 tasks pass (pre-existing `no-explicit-any`
  warnings in `waitlist/artist-waitlist.tsx` / `client-waitlist.tsx`
  unrelated to this pass)
- `pnpm --filter web build` — succeeds, route table above
- `pnpm --filter web exec tsc --noEmit` — clean
- `pnpm --filter mobile exec tsc --noEmit` — clean
- `pnpm --filter web test` (vitest) — 1/1 pass
- `node --experimental-strip-types --test packages/core/src/**/*.test.ts` —
  101/101 pass
