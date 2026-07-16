# Daily Drop — the daily personalized pick

> "A daily tattoo suggestion — a highlighted post from an artist, personalized
> to your preferences and the patterns in the styles you look up / artists you
> follow. Flash or a large original piece. A daily boom to get people using the
> app day-to-day." — founder

Once a day every user gets **one** highlighted post or flash, chosen for their
taste and led by a plain-language **"why"** ("Because you follow artists who
work in Blackwork"). It surfaces as an in-app notification, a card atop the
feed, and a dedicated **Daily Drop** screen with a recent-drops history.

Everything is **deterministic + inert-until-configured**, exactly like the other
scheduled jobs: there is **no Anthropic dependency** (the AI signal is the
already-computed `image_tags`), and the pg_cron tick no-ops until the edge
function is deployed and one Vault secret is set.

---

## The personalization model (`user_style_affinity`)

`public.user_style_affinity(p_user_id)` (SECURITY DEFINER, migration
`20260717100000`) is the "query approach": it scores canonical **style slugs**
for a user from their own social graph, joined through the AI `image_tags` so an
artist who **never tags manually** still contributes signal
(`image_tags.styles` ∪ `post_styles` ∪ `artist_styles`).

| Signal | Weight | Why |
| --- | --- | --- |
| **Saved** posts | 2.5 | an explicit "I want this" bookmark |
| **Followed** artists | 3.0 / artist-style | the loudest taste signal |
| **Booking** history | 2.0 / booked-artist-style | money-backed intent |
| **Liked** posts | 2.0 | a lighter thumbs-up |

It returns `(style_slug, weight, top_source)` — `top_source` is the dominant
signal per slug (a per-slug argmax over per-source sums), which drives the
specific "why" copy. These weights are **mirrored** in
`DAILY_DROP_WEIGHTS`/`buildDropReason` in
`supabase/functions/_shared/daily-drop.ts`; keep the two in sync.

## The selection algorithm (`_shared/daily-drop.ts`)

Pure, IO-free, dependency-free (runs under Deno **and** `node --test`, same
discipline as `_shared/agent-scheduled.ts`). The edge function does the DB reads
and hands them to `selectDailyDrop()`, which scores each candidate:

```
score = Σ(affinity[style]·confidence)·1.0     // taste overlap (image_tags styles)
      + log1p(likeCount)·0.6                   // quality
      + similarity·2.0                         // optional similar_works seeding
      + 0.25                                    // trending baseline (never blank)
      + jitter(user,date,subject)·0.5           // deterministic diversity + tiebreak
      + 0.6  if subjectType == preferred        // flash/original MIX bonus
      − 0.8  if artist shown in last 3 days      // VARIETY
      − 1.5  if artist == yesterday's artist     // VARIETY (stronger)
      − 0.5  if lead style shown in last 3 days  // VARIETY
```

**Guarantees (all unit-tested — 16 tests):**

- **No-repeat** — a subject already dropped to the user is excluded entirely;
  recent/yesterday artist + recent style are penalized so the pick rotates.
- **Flash/original mix** — softly prefers the *opposite* subject type of
  yesterday's drop, but never forces a strictly worse pick when only one type
  has good candidates.
- **Cold-start** — with no affinity signal, falls back to trending (quality) +
  deterministic jitter: a diverse, **never-blank** pick that differs across
  users and days.
- **Idempotent / deterministic** — same inputs → same pick (jitter seeded by
  `user+date+subject`); the DB also enforces one row per `(user_id, drop_date)`.

## Idempotency (two layers)

1. **DB** — `unique(user_id, drop_date)` on `daily_drops`; the generator uses
   `upsert(..., { onConflict: "user_id,drop_date", ignoreDuplicates: true })`
   and only writes a notification when a **new** row was actually inserted, so
   re-running the job the same day is a total no-op (no duplicate drop, no
   duplicate notification).
2. **Algorithm** — deterministic, so even a fresh compute lands on the same pick.

## Timezone decision

The cron fires **once a day at 13:00 UTC** (= 9am ET / 6am PT) — the same hour
as `agent-scheduled`, so there is a single daily cadence to reason about, and it
lands in the morning across the (US-focused) user base. A "drop day" is the
**UTC calendar date** (`daily_drops.drop_date`, and `todayDropDate()` on the
client both use `toISOString().slice(0,10)`), so the client and job always agree
on which day's drop to show. Per-user *local*-morning timing is a deliberate
future enhancement — it needs a user timezone column; documented here rather
than half-built.

## Delivery

The generator inserts a Wave-1 `notifications` row (`type = "daily_drop"`,
`action_url = "/daily-drop"`, `data` deep-links the subject). Because
`daily_drop` is an **uncategorized** type, the notification fan-out
(`enqueue_notification_deliveries`) leaves it **in-app only** — the bell +
realtime badge — with **no push/email**, so nobody gets a daily email they
didn't ask for. That was chosen to respect the notifications lane's ownership.

> **Follow-up to enable push:** add a `daily_drop` category to the three synced
> category files (`notification_category_for_type` in SQL,
> `_shared/notification-categories.ts`, `packages/core/.../categories.ts`) with
> `email` default OFF. That is the *only* change needed to deliver the drop as a
> push "boom"; it belongs to the notifications lane, not this one.

## Surfaces

- **Feed** — a compact `DailyDropCard` mounts atop the *discover* feed
  (web `FeedScreen`, mobile `app/(tabs)/index.tsx`), with a "See all" → `/daily-drop`.
- **Dedicated** — `/daily-drop` (web) / `app/daily-drop.tsx` (mobile): today's
  full card + a recent-drops history strip. The notification deep-links here.
- **Engagement loop** — the card stamps `seen_at` on render and `clicked_at`
  when the viewer opens the artist / books; like/save on a post drop routes
  through the feed's `social` mutations (so it updates the post **and** feeds
  back into tomorrow's affinity) and stamps `reacted_at`.

## Files

| Layer | Path |
| --- | --- |
| Migration | `supabase/migrations/20260717100000_daily_drops.sql` |
| Algorithm (+tests) | `supabase/functions/_shared/daily-drop.ts` / `.test.ts` |
| Edge job | `supabase/functions/daily-drop/index.ts` (config.toml `verify_jwt=false`) |
| Core data + hooks | `packages/core/src/api/dailyDrop.ts`, `hooks/useDailyDrop.ts`, `hooks/queryKeysDailyDrop.ts` |
| Web UI | `apps/web/src/components/daily-drop/*`, `app/(app)/daily-drop/page.tsx`, `app/dev/daily-drop-preview/*` |
| Mobile UI | `apps/mobile/components/daily-drop/DailyDropCard.tsx`, `app/daily-drop.tsx` |

## Deploy / go-live

```bash
# 1. Deploy the generator (no ANTHROPIC key needed — deterministic).
supabase functions deploy daily-drop --project-ref khlpidflnvkqafkvkpfy --no-verify-jwt

# 2. Register the URL Vault secret so the daily cron can reach it
#    (agent_runner_service_key is already registered + reused as the bearer).
#    select vault.create_secret(
#      'https://khlpidflnvkqafkvkpfy.functions.supabase.co/daily-drop', 'daily_drop_url');
```

The `daily-drop-generate` cron (already scheduled, 13:00 UTC) then wakes the
generator each morning. Until then it no-ops safely. `POST` with
`{ "user_id": "<uuid>" }` to generate on demand for one user, or
`{ "drop_date": "YYYY-MM-DD" }` to backfill a day.

## Tests

```bash
node --test supabase/functions/_shared/daily-drop.test.ts
# 16 tests: affinity lookup, source-specific/cold-start reason copy, deterministic
# jitter, personalized pick, confidence weighting, cold-start fallback + per-user
# divergence, no-repeat, yesterday-artist rotation, flash/original mix (+ "never
# a worse pick"), determinism, similar_works boost, empty-pool null, own-work exclude.
```
