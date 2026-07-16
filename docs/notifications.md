# Notifications: multi-channel delivery (in-app + push + email)

INKD notifications start as rows in `public.notifications` — the in-app inbox
(the bell + `/notifications`). Seven `SECURITY DEFINER` fan-out triggers write
those rows on the events that matter (new booking request, request
accepted/declined, session scheduled, deposit received, new review, review
response, new message — throttled). See
`supabase/migrations/20260716050000_notification_triggers.sql`.

This doc covers the delivery layer added on top
(`20260717060000_notification_delivery.sql`): the same events are ALSO delivered
as an **Expo push** and a **Resend email**, per the user's per-category channel
preferences.

---

## What's automatic (no config, works today)

- **In-app** notifications — unchanged, always on.
- **The fan-out queue.** Every `notifications` INSERT fires
  `enqueue_notification_deliveries()`, which looks up the recipient's
  preferences and inserts a `notification_deliveries` row per enabled channel
  (only when the user actually has a push token / an email on file). In-app is
  the notification row itself, so it never needs a delivery row.
- **The drain loop.** A `pg_cron` job (`notify-dispatch-drain`, every minute)
  calls `notify_dispatch_tick()`, which POSTs to the `notify-dispatch` edge
  function via `pg_net`. It is **guarded**: it no-ops when the queue is empty or
  when the Vault secrets are absent, so it is safe already — nothing fires
  against a missing endpoint.
- **Preferences UI.** Settings → Notifications (web + mobile) lets users toggle
  in-app / push / email per category. A missing row means "use the category
  default".
- **Graceful degradation.** With no push tokens, push deliveries are `skipped`
  (`no_tokens`). With no `RESEND_API_KEY`, email deliveries are `skipped`
  (`email_not_configured`) and logged — never errored.

### Preference categories & defaults

| Category | Push | In-app | Email (default) |
|---|---|---|---|
| `booking_request` | on | on | **on** |
| `booking_accepted` | on | on | **on** |
| `booking_declined` | on | on | **on** |
| `session_reminder` | on | on | **on** |
| `deposit` | on | on | **on** |
| `message` | on | on | off |
| `review` | on | on | off |
| `review_response` | on | on | off |
| `ai_approval` | on | on | off |
| `aftercare` | on | on | off |

Email defaults on only for high-value transactional events (booking lifecycle +
money + a scheduled session). The category set + the type→category map + these
defaults are mirrored in three places that must stay in sync:

- SQL: `notification_category_for_type` / `notification_category_default_email`
- Edge: `supabase/functions/_shared/notification-categories.ts`
- App: `packages/core/src/notifications/categories.ts`

---

## What the founder must configure

### 1. Email — Resend (FREE tier: 3,000/mo, 100/day)

Until this is done, **email silently no-ops** (deliveries marked `skipped`,
logged — not an error). Push and in-app are unaffected.

1. Create a [Resend](https://resend.com) account (free).
2. **Verify the `getinkd.co` domain** in Resend (Domains → Add → add the DNS
   records they give you: SPF/DKIM). The default From is
   `INKD <notifications@getinkd.co>`; sending from an unverified domain is
   rejected by Resend. (Override the From with the `RESEND_FROM` secret if you
   want a different verified address.)
3. Create a Resend API key and set it as a Supabase function secret:
   ```sh
   supabase secrets set RESEND_API_KEY=re_xxx
   # optional: supabase secrets set RESEND_FROM="INKD <hi@getinkd.co>"
   ```
   No redeploy needed — the edge functions read it at runtime.

### 2. Wake the dispatcher — two Vault secrets

The minute cron only POSTs to `notify-dispatch` once these Vault secrets exist
(the same `agent_runner_service_key` the AI runtime already uses is reused as
the bearer):

```sql
-- Run once (SQL editor / MCP). Replace the URL host with your project ref.
select vault.create_secret(
  'https://khlpidflnvkqafkvkpfy.functions.supabase.co/notify-dispatch',
  'notify_dispatch_url'
);
-- agent_runner_service_key: already set if the AI runtime is live. If not:
select vault.create_secret('<AGENT_RUNNER_TOKEN or service-role key>', 'agent_runner_service_key');
```

`notify-dispatch` authenticates the bearer itself (`AGENT_RUNNER_TOKEN`, falling
back to the service-role key — `_shared/agent-auth.ts`), so set
`AGENT_RUNNER_TOKEN` as a function secret if you want the short dedicated token
rather than the full service key.

### 3. Push in PRODUCTION builds — FCM + APNs via EAS

Expo push **works out of the box in Expo Go and dev clients** — no credentials.
A **production standalone build** (App Store / Play Store) still needs the
platform credentials, uploaded through EAS:

- **Android (FCM):** create a Firebase project, download the FCM **server
  key / service account**, and run `eas credentials` (or upload in the Expo
  dashboard) so Expo can deliver to Android.
- **iOS (APNs):** provide an APNs key (`.p8`) via `eas credentials`.
- Set an **EAS project id** so `getExpoPushTokenAsync` resolves it. Either run
  `eas init` (writes `extra.eas.projectId` into `app.json`) or add it manually.
  The client already reads `Constants.expoConfig.extra.eas.projectId` and
  degrades gracefully when it's absent.

Nothing above blocks development — it only matters for store builds delivering
real pushes to real devices.

---

## Architecture

```
event (booking/message/…)                                  founder config
        │  existing fan-out trigger                        ───────────────
        ▼
public.notifications  INSERT ──► enqueue_notification_deliveries()
        │ (in-app inbox)                │ per-prefs, only if token/email exists
        ▼                               ▼
   bell + /notifications        notification_deliveries (push|email, pending)
                                        │
                    pg_cron (1/min) notify_dispatch_tick()  [guarded, pg_net]
                                        │  needs: notify_dispatch_url (Vault)
                                        ▼
                              notify-dispatch  (edge fn)
                          leases batch (SKIP LOCKED RPC)
                          ├─ push  → Expo Push API  (free)     ── prune DeviceNotRegistered
                          └─ email → Resend         (needs RESEND_API_KEY)
                                        │
                              mark sent / skipped / failed(+requeue ≤3)
```

### Tables (`20260717060000_notification_delivery.sql`)

- **`device_push_tokens`** — a user's Expo tokens (RLS owner-only). Registered
  via the `register_push_token(token, platform)` `SECURITY DEFINER` RPC (atomic
  device-handoff claim). The mobile app calls it on sign-in (`components/PushSync.tsx`).
- **`notification_preferences`** — `(user_id, category)` rows with
  `in_app` / `push` / `email` booleans (RLS owner-only). Missing row → default.
- **`notification_deliveries`** — the durable queue (service-role only, no RLS
  policies by design — same as `agent_jobs`). One row per (notification,
  channel); statuses `pending → running → sent | skipped | failed`.

### Edge functions

- **`notify-dispatch`** — the queue drainer (cron/manual). No external keys
  required to run; skips push with no tokens, skips email with no key.
- **`send-push`** — standalone Expo sender (direct/manual + testing). Prunes
  `DeviceNotRegistered` tokens.
- **`send-email`** — standalone Resend sender. Returns
  `{ skipped: true, reason: "not_configured" }` (200) when `RESEND_API_KEY` is
  absent.

All three are `verify_jwt = false` and enforce the shared runner bearer
themselves (`_shared/agent-auth.ts`). The senders/templates/dispatch logic live
in `_shared/{expo-push,notification-email,notification-dispatch,notification-categories}.ts`
and are unit-tested offline (`node --test`).

---

## Deploy / redeploy

```sh
# from the repo root (or via the Supabase MCP deploy_edge_function tool)
supabase functions deploy notify-dispatch --project-ref khlpidflnvkqafkvkpfy
supabase functions deploy send-push       --project-ref khlpidflnvkqafkvkpfy
supabase functions deploy send-email      --project-ref khlpidflnvkqafkvkpfy
```

`config.toml` already pins `verify_jwt = false` for all three.

## Tests

```sh
node --test supabase/functions/_shared/notification-categories.test.ts \
            supabase/functions/_shared/expo-push.test.ts \
            supabase/functions/_shared/notification-email.test.ts \
            supabase/functions/_shared/notification-dispatch.test.ts
```

Covers the prefs resolver, the Expo push payload builder + `DeviceNotRegistered`
reconciliation, the branded email template rendering (+ HTML escaping), and the
end-to-end fan-out dispatch with faked repo/senders.

---

## Wave-1 founder go-live config (consolidated)

Both Wave-1 backend features (notifications + AI tagging) are deployed and
inert until the founder sets a small set of secrets. One-stop checklist:

| # | What | Where | Notes |
| --- | --- | --- | --- |
| 1 | **Resend API key + verified domain** | `supabase secrets set RESEND_API_KEY=re_xxx` | Verify `getinkd.co` DNS in Resend first (see §"What the founder must configure"). Absent → email deliveries `skipped` (push still fires). |
| 2 | **Vault secrets for `notify-dispatch`** | Vault: runner bearer + function URL | Drives the `notify-dispatch-drain` pg_cron. Absent → cron no-ops safely. |
| 3 | **Vault secrets for `tag-image` (image tagger)** | Vault: `agent_runner_service_key` (already set) + `image_tagger_url` | Drives `image-tag-drain` pg_cron. Reuses the agent `ANTHROPIC_API_KEY` — no new key. See `docs/ai-image-tagging.md`. |
| 4 | **EAS credentials for prod push** | Expo/EAS project (prod push cert / FCM + APNs) | Needed for real device push tokens in a production build; Expo Go dev tokens work without it. |

All four are additive: nothing errors while unset — queues drain to no-ops and
senders skip gracefully. Flip them on in any order.
