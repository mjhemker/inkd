# INKD

The operating system for independent tattoo artists — artist ops first (the wedge), client discovery second, with operational AI staff layered on top. Web and mobile are built **in tandem** on a shared Supabase backend.

Brand: near-black canvas + violet-purple accent. Domain: [getinkd.co](https://getinkd.co). Pilot: Baltimore + Philadelphia.

See [`docs/SPEC.md`](docs/SPEC.md) for the canonical build specification.

## Monorepo layout

```
INKD (pnpm workspaces + Turborepo)
├── apps/
│   ├── web/       Next.js 15 (App Router, TS, Tailwind v4)
│   └── mobile/    Expo (expo-router, TS, NativeWind v4)
├── packages/
│   ├── core/      typed Supabase client, env resolver, zod, shared types
│   ├── ui/        design tokens (near-black / violet) + shared primitives
│   └── config/    tsconfig bases, ESLint config, Tailwind preset
├── supabase/      migrations, edge functions, RLS, seed (owned separately)
└── docs/          SPEC.md, ADRs, phase reports
```

Design tokens live in `packages/ui` and feed a shared Tailwind preset in
`packages/config`, which both web (Tailwind v4, via `@config`) and mobile
(NativeWind v4) consume — so brand colors, spacing, radii and type scale stay in
lockstep across platforms.

## Prerequisites

- Node.js >= 20
- pnpm 10 (`corepack enable` or `npm i -g pnpm`)

## Getting started

```bash
pnpm install

# copy env templates and fill in the Supabase anon key
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env

pnpm dev            # run all apps via Turborepo
pnpm --filter web dev
pnpm --filter mobile dev
```

## Scripts (root)

| Command          | What it does                     |
| ---------------- | -------------------------------- |
| `pnpm dev`       | Run every app in dev (Turborepo) |
| `pnpm build`     | Build all packages and apps      |
| `pnpm lint`      | Lint all workspaces              |
| `pnpm typecheck` | Type-check all workspaces        |
| `pnpm format`    | Prettier across the repo         |

Filter a single workspace with `pnpm --filter <web|mobile|@inkd/core|@inkd/ui> <script>`.

## Environment variables

`@inkd/core` resolves Supabase config from platform-specific public env vars:

- Web: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Mobile: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`

The project URL (`https://khlpidflnvkqafkvkpfy.supabase.co`) is committed in the
`.env.example` files; the anon key is a placeholder — pull the real one from the
Supabase dashboard and keep it out of git.

## Status

Phase 0 (foundation) — monorepo scaffold, design tokens, shared core, and app
shells. Feature work (onboarding, bookings, discovery, AI staff) follows the
phases in `docs/SPEC.md`.
