# INKD — Web Deployment (Vercel, getinkd.co)

*Last updated: 2026-07-16.* This is the exact setup for deploying `apps/web`
(the Next.js app) to Vercel at **getinkd.co**. It complements
[`SPEC.md`](SPEC.md) and [`TESTING.md`](TESTING.md), which cover local dev.

Only the `web` app is deployed to Vercel. `apps/mobile` (Expo) ships via
EAS/App Store/Play Store separately and is unaffected by anything here.

---

## 0. Root routing behavior (read this first)

INKD is a pnpm + Turborepo monorepo, and `apps/web` is a single Next.js app
that serves both the marketing/preview surface and the authenticated
product. As of 2026-07-16, the root of the site is **role-aware**, not a
static marketing page:

| Visitor | `getinkd.co/` behavior |
| --- | --- |
| Signed out | Server-redirects to **`/preview`** (the marketing landing — hero, style wall, pillars, AI-trust band, footer) |
| Signed in, client | Server-redirects to `/feed` |
| Signed in, artist, onboarding complete | Server-redirects to `/dashboard` |
| Signed in, artist, onboarding incomplete | Server-redirects to `/onboarding` |

This is implemented as a server component at `apps/web/src/app/page.tsx` that
checks the Supabase session and redirects — it renders no UI of its own. The
logic mirrors `apps/web/src/app/auth/callback/route.ts`'s post-login landing
resolution, so `/` and the post-auth callback always agree on where a given
account's "home" is.

**Why this approach over the alternative** (keep marketing at `/` *and* mirror
it at `/preview`): duplicating the landing page at two routes means either two
copies of the same JSX to keep in sync, or a redirect from one to the other —
which would still leave `/` unable to route signed-in users into the app. A
single role-aware root plus one canonical marketing route (`/preview`) is
simpler, has one source of truth for the landing content, and satisfies the
actual ask ("root serves the app, marketing lives at a subpath").

**No redirect loops:** `/preview`, `/feed`, `/dashboard`, and `/onboarding`
are all public-by-design or self-terminating routes (see
`PROTECTED_ROUTE_PREFIXES` / `ARTIST_ROUTE_PREFIXES` in
`packages/core/src/auth/web.ts`) — none of them redirect back through `/`.
`apps/web/src/middleware.ts` still gates every protected/artist-only route
exactly as before; the root router doesn't bypass or duplicate that gating,
it only decides where an unprotected `/` hit should land.

**Marketing links updated to point at `/preview`:** the `/auth` screen's logo
and "Back to site" link (previously `href="/"`, which was the marketing page)
now point at `/preview` explicitly. Logo links on other public pages
(`/book/[artistHandle]`, `/waivers/sign/[bookingId]`, `/a/[handle]`) were left
pointing at `/` on purpose — on those pages "click the logo" means "take me
home," and `/`'s new role-aware behavior *is* the correct home for both
signed-in and signed-out visitors there.

---

## 1. Vercel project setup

1. **Import the repo** in the Vercel dashboard → *Add New* → *Project* →
   select the `inkd` GitHub repo.
2. **Root Directory**: set to `apps/web` (Project Settings → General → Root
   Directory → Edit). This is a dashboard/project setting, not a
   `vercel.json` field — `vercel.json` doesn't support a `rootDirectory` key.
3. **Framework Preset**: Next.js (also pinned via `"framework": "nextjs"` in
   `apps/web/vercel.json`, checked in at the repo).
4. Vercel will read `apps/web/vercel.json` (because Root Directory is
   `apps/web`) for the build/install/ignore commands:

   ```json
   {
     "framework": "nextjs",
     "installCommand": "cd ../.. && pnpm install --frozen-lockfile",
     "buildCommand": "cd ../.. && pnpm turbo run build --filter=web",
     "outputDirectory": ".next",
     "ignoreCommand": "cd ../.. && npx turbo-ignore web"
   }
   ```

   - `installCommand` / `buildCommand` `cd` back to the monorepo root so
     `pnpm` sees the workspace (`pnpm-workspace.yaml`, the root lockfile) and
     Turborepo can resolve `packages/core` / `packages/ui` / `packages/config`
     before building `web`.
   - `outputDirectory` is `.next`, relative to Root Directory (`apps/web`) —
     that's where `next build` writes regardless of the `cd` in the build
     command.
   - `ignoreCommand` uses [`turbo-ignore`](https://www.npmjs.com/package/turbo-ignore)
     (Vercel's own tool for Turborepo) to skip the build entirely when a
     commit only touches paths outside `web`'s dependency graph — e.g. a
     mobile-only change, an edge-function-only change, or a docs update. This
     keeps unrelated pushes from consuming a build.

5. **No secrets in `vercel.json`.** It is a committed file — only
   non-sensitive build config belongs in it. All environment variables
   (below) are set in the Vercel dashboard (Project Settings → Environment
   Variables), never in the repo. This matters here specifically: a Mapbox
   token was previously committed into a `vercel.json` and tripped GitHub's
   push-protection scanner — don't repeat that.

---

## 2. Environment variables (set in the Vercel dashboard)

Grepped from `apps/web` (and the `@inkd/core` package it depends on) for every
`process.env.NEXT_PUBLIC_*` read at runtime:

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Supabase project URL. Resolved in `packages/core/src/env.ts`; consumed by `createBrowserSupabaseClient` / `createServerSupabaseClient` (`packages/core/src/auth/web.ts`) for every auth/session/data call. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Supabase anon key. Public by design — RLS enforces access. Same resolution path as above. |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Optional | Discovery map (`/discover`) basemap. If unset, the map falls back to keyless OpenFreeMap tiles — no setup needed. Read in `apps/web/src/components/discover/DiscoverMap.tsx` and `mapStyle.ts`. |
| `NEXT_PUBLIC_MAP_STYLE_URL` | Optional | Overrides the map style entirely (any MapLibre `style.json` URL, or a `mapbox://styles/...` URL paired with `NEXT_PUBLIC_MAPBOX_TOKEN`). Same two files as above. |

Set both required vars for every environment (Production, Preview, and
Development) in Vercel — the `web` app's Supabase project (`khlpidflnvkqafkvkpfy`)
is shared across local/pilot/production, so Preview deploys can use the same
values as Production unless/until a separate staging Supabase project exists.

**Not currently an env var:** the site's canonical URL is hardcoded as
`metadataBase: new URL("https://getinkd.co")` in `apps/web/src/app/layout.tsx`
(used to resolve relative OG/social image URLs). There is no
`NEXT_PUBLIC_APP_URL` or `NEXT_PUBLIC_SITE_URL` read anywhere in the web app
today — nothing to set for that. If Preview deployments ever need their own
absolute URL (their own `*.vercel.app` domain) instead of the hardcoded
production one, that hardcode is the place to swap in an env-driven value.

**Not applicable to Vercel:** `EXPO_PUBLIC_SUPABASE_URL` /
`EXPO_PUBLIC_SUPABASE_ANON_KEY` are mobile-only (Expo) and never read by the
web app or its build — don't set them here.

---

## 3. Custom domain (getinkd.co)

1. Project Settings → Domains → *Add* → enter `getinkd.co` (and `www.getinkd.co`
   if you want the `www` redirect too).
2. Vercel shows the exact DNS records to add at your registrar:
   - Apex (`getinkd.co`): an `A` record to Vercel's anycast IP, **or**
     transfer nameservers to Vercel — Vercel's UI recommends the current best
     option at add-time.
   - `www.getinkd.co`: a `CNAME` to `cname.vercel-dns.com`.
3. Once DNS propagates, Vercel auto-provisions the TLS certificate. Set
   `getinkd.co` as the **Production** domain and redirect `www` → apex (or
   vice versa — pick one canonical host) in the Domains panel.
4. After the domain is live, **the marketing preview is reachable at
   `getinkd.co/preview`** — that's the exact route to share pre-launch (e.g.
   for investor/partner previews) while `getinkd.co/` itself continues to
   route signed-in users straight into the product and signed-out visitors to
   that same `/preview` page.

---

## 4. Post-deploy smoke check

- `getinkd.co/` while signed out → lands on `/preview` (marketing hero, style
  wall, AI-trust band, footer).
- `getinkd.co/preview` directly → same content, loads with no redirect.
- `getinkd.co/auth` → sign in → lands on `/feed` (client) or `/dashboard`
  /`/onboarding` (artist), matching the table in §0.
- A protected route hit while signed out (e.g. `getinkd.co/settings`) →
  bounces to `/auth?next=/settings` (unchanged, `apps/web/src/middleware.ts`).
