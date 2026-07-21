# INKD — Web Deployment (Vercel, getinkd.co)

*Last updated: 2026-07-21.* This is the definitive founder checklist for
deploying `apps/web` (the Next.js app) to Vercel at **getinkd.co**, moving the
domain onto that project, and wiring the founder's separate promo/landing
site under it at `/marketing`. It complements [`SPEC.md`](SPEC.md) and
[`TESTING.md`](TESTING.md), which cover local dev.

Only the `web` app is deployed to Vercel. `apps/mobile` (Expo) ships via
EAS/App Store/Play Store separately and is unaffected by anything here.

**Quick checklist (details for each step below):**

- [ ] Import `inkd` repo into Vercel, Root Directory = `apps/web` (§1)
- [ ] Set required env vars for Production/Preview/Development (§2)
- [ ] Move `getinkd.co`: remove from the `inkd-landing` project, add to this
      one (§3)
- [ ] Confirm `/marketing` proxies to `inkd-landing.vercel.app` (§4) —
      shipped in `apps/web/next.config.ts`, nothing to configure in Vercel
- [ ] Add `https://getinkd.co/auth/callback` to Supabase Auth's redirect
      allow-list (§5)
- [ ] Update the `INKD_APP_URL` Supabase Edge Function secret to
      `https://getinkd.co` (§6)
- [ ] Run the post-deploy smoke check (§7)

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

## 3. Custom domain (getinkd.co) — moving it onto this project

`getinkd.co` currently belongs to the **`inkd-landing`** Vercel project (the
founder's promo/landing site, a separate repo, still live at its `.vercel.app`
URL). The app now owns the domain; the landing site moves under the app at
`/marketing` instead (§4). A domain can only be attached to one Vercel project
at a time, so it has to be removed from `inkd-landing` before it can be added
here — there will be a short window (usually seconds to a couple minutes)
where `getinkd.co` 404s between the two steps.

1. **Remove from the landing project first.** In the `inkd-landing` Vercel
   project → Settings → Domains → remove `getinkd.co` (and `www.getinkd.co`
   if present). Do **not** delete the `inkd-landing` project itself — its
   `inkd-landing.vercel.app` URL must keep working, since the app's
   `/marketing` rewrite (§4) proxies to exactly that URL.
2. **Add to this project.** In the `web` (app) Vercel project → Settings →
   Domains → *Add* → enter `getinkd.co` (and `www.getinkd.co` if you want the
   `www` redirect too).
3. Vercel shows the exact DNS records to add at your registrar:
   - Apex (`getinkd.co`): an `A` record to Vercel's anycast IP, **or**
     transfer nameservers to Vercel — Vercel's UI recommends the current best
     option at add-time. If DNS was already pointed at Vercel for the landing
     project, the records are likely already correct and this step is just
     re-verifying them in the new project.
   - `www.getinkd.co`: a `CNAME` to `cname.vercel-dns.com`.
4. Once DNS propagates, Vercel auto-provisions the TLS certificate. Set
   `getinkd.co` as the **Production** domain and redirect `www` → apex (or
   vice versa — pick one canonical host) in the Domains panel.
5. After the domain is live, **the app's own internal marketing preview stays
   reachable at `getinkd.co/preview`** — unchanged, unaffected by any of
   this — and the **founder's promo site is now reachable at
   `getinkd.co/marketing`** (§4). Both are intentionally kept: `/preview` is
   this app's built-in landing page (role-aware root's signed-out
   destination, §0); `/marketing` is the founder's separate promo site.

---

## 4. The `/marketing` proxy (founder's promo site)

The founder's promo/landing site is a **separate repo**, deployed on its own
Vercel project at `https://inkd-landing.vercel.app`. Rather than merging
repos or building a second copy inside the app, `apps/web/next.config.ts`
proxies it under the app's domain via Next.js `rewrites()`:

```ts
async rewrites() {
  return [
    { source: "/marketing", destination: "https://inkd-landing.vercel.app/" },
    { source: "/marketing/:path*", destination: "https://inkd-landing.vercel.app/:path*" },
  ];
},
```

- `getinkd.co/marketing` → `inkd-landing.vercel.app/`
- `getinkd.co/marketing/anything/here` → `inkd-landing.vercel.app/anything/here`
- This is a **rewrite** (server-side proxy, same URL bar stays on
  `getinkd.co`), not a redirect. No change needed in Vercel's dashboard —
  it's config checked into the repo and takes effect on the next deploy.
- No conflicting route exists: `apps/web/src/app` has no `/marketing`
  directory, and `/marketing` is not in `PROTECTED_ROUTE_PREFIXES` /
  `ARTIST_ROUTE_PREFIXES` (`packages/core/src/auth/web.ts`), so
  `apps/web/src/middleware.ts` passes it straight through to the rewrite
  without gating it.

### Caveat: static assets may 404 under `/marketing`

This rewrite only covers **page** requests matching `/marketing` or
`/marketing/*`. A stock Next.js build on the landing side emits its JS/CSS/
image assets at **root-absolute** paths — e.g. `/_next/static/chunks/...`,
`/favicon.ico` — not paths prefixed with `/marketing`. Those requests don't
start with `/marketing`, so they're **not** covered by this rewrite; they'll
hit the app's own routing instead of `inkd-landing`, and most will 404.

This could not be confirmed directly against the live landing site: egress to
`inkd-landing.vercel.app` was blocked by this environment's outbound proxy
policy (`curl` got a `403` on `CONNECT`) during this change, and the one
successful fetch (via the agent's web-fetch tool) only surfaced the
JS-disabled `<noscript>` fallback — its HTML→text conversion strips
`<script>`/`<link>` tags, so the actual asset paths weren't visible either
way. Treat this as "assume the default Next.js behavior applies" rather than
confirmed.

**Fix, in the `inkd-landing` repo** (not this one): set

```js
// inkd-landing's next.config.js
const nextConfig = {
  basePath: "/marketing",
  // assetPrefix: "/marketing", // only if assets are served from a separate CDN/origin
};
```

so that repo's own build emits every asset under `/marketing/_next/...` etc.
Once that ships and `inkd-landing.vercel.app/marketing/...` itself resolves
correctly (Vercel serves a `basePath`'d app at both its bare domain root and
the `basePath`, so this doesn't break `inkd-landing.vercel.app` directly),
this rewrite's `:path*` passthrough will carry those asset requests through
correctly too — no change needed on the app side.

**How to verify after deploy:** open `getinkd.co/marketing` in a browser with
DevTools open, check the Network tab for any `404` on a `/_next/...` or other
static-asset request. If everything 200s, the landing site already sets
`basePath` (or has no such assets); if you see 404s, apply the fix above in
the `inkd-landing` repo and redeploy it.

---

## 5. Supabase Auth redirect allow-list

Supabase Auth only completes an OAuth/magic-link/email-confirmation flow if
the redirect URL matches an allow-listed pattern. The app has exactly one
callback route — `apps/web/src/app/auth/callback/route.ts` — built from
`window.location.origin` in `apps/web/src/app/auth/page.tsx`
(`emailRedirectTo: ${origin}/auth/callback?next=...`). There is no separate
`/auth/confirm` route in this codebase; everything (OAuth, magic link, email
confirmation) resolves through `/auth/callback`.

1. Supabase Dashboard → project `khlpidflnvkqafkvkpfy` → Authentication → URL
   Configuration → **Redirect URLs**.
2. Add: `https://getinkd.co/auth/callback`
3. (Optional, if a wildcard is preferred over enumerating every domain) Add:
   `https://getinkd.co/auth/**` instead — but confirm no other `/auth/*`
   route should ever be a valid post-login redirect target before doing so,
   since a wildcard is more permissive than necessary here.
4. Leave any existing `*.vercel.app` / localhost entries in place if
   Preview/local dev auth flows still need them.

If this step is skipped, sign-in/sign-up on `getinkd.co` will fail at the
final redirect step with an "invalid redirect URL" error from Supabase, even
though the domain and DNS are otherwise correctly configured.

---

## 6. `INKD_APP_URL` Supabase Edge Function secret

`INKD_APP_URL` is read by the Supabase Edge Functions (not the Next.js app)
for Stripe Checkout/Connect return-URL construction and notification-email
CTA links — see `supabase/functions/_shared/env.ts` and
`supabase/functions/_shared/notification-email.ts`. It already **defaults**
to `https://getinkd.co` in code
(`optionalEnv("INKD_APP_URL", "https://getinkd.co")`), so if the secret was
never explicitly set it's already correct. Set it explicitly anyway so it's
not silently relying on a code default:

```bash
supabase secrets set --project-ref khlpidflnvkqafkvkpfy \
  INKD_APP_URL=https://getinkd.co
```

If a placeholder/staging value (e.g. an `inkd-landing.vercel.app` or preview
URL) was ever set here, this overwrites it. See `docs/payments.md` for the
full Stripe secrets list this is deployed alongside.

---

## 7. Post-deploy smoke check

- `getinkd.co/` while signed out → lands on `/preview` (marketing hero, style
  wall, AI-trust band, footer).
- `getinkd.co/preview` directly → same content, loads with no redirect.
- `getinkd.co/marketing` → proxies to the founder's promo site
  (`inkd-landing.vercel.app`); URL bar stays on `getinkd.co`. Check Network
  tab for asset 404s (§4 caveat).
- `getinkd.co/auth` → sign in → lands on `/feed` (client) or `/dashboard`
  /`/onboarding` (artist), matching the table in §0.
- `getinkd.co/a/demo-folio-nova` → seeded demo artist profile loads (see
  `apps/web/src/app/dev/profile-preview/seed.ts`); confirms the `/a/[handle]`
  public profile route and its data path work end-to-end on production.
- OG image: fetch `getinkd.co/a/demo-folio-nova/opengraph-image` (or paste
  `getinkd.co/a/demo-folio-nova` into a social-card debugger, e.g. Twitter
  Card Validator / Facebook Sharing Debugger) → confirms
  `apps/web/src/app/a/[handle]/opengraph-image.tsx` renders and
  `metadataBase` (`apps/web/src/app/layout.tsx`, hardcoded to
  `https://getinkd.co`) resolves the image to an absolute, publicly-fetchable
  URL now that the domain is live.
- A protected route hit while signed out (e.g. `getinkd.co/settings`) →
  bounces to `/auth?next=/settings` (unchanged, `apps/web/src/middleware.ts`).
