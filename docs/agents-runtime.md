# INKD AI Staff — Agent Runtime

The operational agent runtime (SPEC §5): **Front Desk** (inbound message triage +
grounded replies) and **Booking Manager** (slot proposals) for v1. Everything here
is **code-complete against env placeholders** — no `ANTHROPIC_API_KEY` exists yet.
When Michael provides one, wiring it (one `secrets set`) is the only remaining
step; see [§ When Michael has the Anthropic key](#when-michael-has-the-anthropic-key).

Design invariants (never negotiable):

- **Tiering lives OUTSIDE the model.** A deterministic policy engine assigns every
  action a tier and decides execute-vs-propose from the artist's autonomy. The LLM
  cannot bypass it by construction — it only *labels* an action; the engine fixes
  the tier.
- **Grounding.** The agent may never state a price or date/time it didn't read from
  a tool. A post-generation validator enforces this and downgrades violations.
- **Everything is auditable.** Every run writes an `agent_actions` row with a
  plain-language reasoning summary and the exact data it consulted.

---

## The `agent_actions` contract

A trust-UI surface builds against this exact shape in parallel — **do not deviate.**
The canonical TypeScript lives in `supabase/functions/_shared/agent-contract.ts`.

| Column | Type | Notes |
| --- | --- | --- |
| `action_type` | text | `reply.draft` \| `reply.autosend` \| `booking.propose_slots` \| `flag.handoff` \| `note.log` |
| `tier` | smallint | `1` \| `2` \| `3` — assigned by the policy engine |
| `status` | enum | `proposed` \| `approved` \| `executed` \| `rejected` (DB enum also has `failed`/`superseded`) |
| `reasoning_summary` | text | 1–2 plain-language sentences |
| `payload` | jsonb | see below |
| `executed_message_id` | uuid null | the message this action produced, once executed (added in migration `20260716070000`) |
| `data_consulted` | jsonb | mirror of `payload.context_used` (existing column, kept populated) |

### `payload` jsonb

```jsonc
{
  "thread_id": "uuid",                // present for message-triggered actions
  "booking_request_id": "uuid",       // present for booking-request-triggered actions
  "draft_text": "string",             // for reply.draft / reply.autosend
  "proposed_slots": [                 // for booking.propose_slots
    { "starts_at": "2026-07-20T10:00:00Z", "ends_at": "2026-07-20T11:00:00Z" }
  ],
  "context_used": [                   // the grounding whitelist + audit trail
    { "source": "services", "detail": "1-hour session: $200.00, $50.00 deposit, 60 min" },
    { "source": "availability", "detail": "2026-07-20 (10:00–18:00)" }
  ],
  "trigger": { "kind": "message", "id": "uuid" },   // 'message' | 'booking_request'
  "edited": {                         // only on an approved-with-edits execution
    "draft_text": "string", "edited_by": "uuid", "edited_at": "iso"
  }
}
```

`context_used[].source` ∈ `services` \| `availability` \| `booking_policy` \| `playbook` \| `profile`.

---

## Architecture

```
 client message / booking_request insert
              │  (SECURITY DEFINER trigger, gated on autonomy <> 'no_ai')
              ▼
        agent_jobs  (durable queue, dedupe_key, attempts≤3)
              │  pg_cron 'agent-run-drain' every minute ──net.http_post──▶
              ▼
   agent-run  (edge function, service-role bearer)
     ├─ agent_jobs_lease(N)                    FOR UPDATE SKIP LOCKED
     ├─ collectContext() via the TOOL layer    read_profile / read_services /
     │      → records context_used              read_availability / read_booking_policy /
     │                                          read_playbook / read_thread
     ├─ buildMessages()  Front Desk / Booking Manager prompt (INKD rules)
     ├─ Anthropic Messages API  → strict JSON (one retry) → parseAgentOutput()
     ├─ decideAction()  DETERMINISTIC policy: tier + autonomy + overrides
     │      + grounding validator (downgrades ungrounded execute → propose)
     └─ persist agent_actions  (+ auto-send message when policy = execute)
              │
              ▼
   approve-agent-action  (edge function, artist JWT)
        proposed → executed (posts message, links executed_message_id) | rejected
```

### Files (this lane owns)

- `supabase/migrations/20260716070000_agent_jobs_queue.sql` — queue table, enqueue
  triggers, `agent_jobs_lease` RPC, `executed_message_id` column, pg_cron drain.
- `supabase/functions/_shared/agent-contract.ts` — payload shape + strict parser.
- `supabase/functions/_shared/agent-policy.ts` — tier map, autonomy decision, grounding.
- `supabase/functions/_shared/agent-slots.ts` — availability→slots (ported from core).
- `supabase/functions/_shared/agent-tools.ts` — the typed tool layer + `context_used`.
- `supabase/functions/_shared/agent-prompt.ts` — the role prompt builder.
- `supabase/functions/_shared/agent-model.ts` — Anthropic client + strict-JSON retry.
- `supabase/functions/_shared/agent-runner.ts` — orchestration + batch drain.
- `supabase/functions/_shared/agent-approval.ts` — approve/reject transitions.
- `supabase/functions/agent-run/` — the drainer edge function.
- `supabase/functions/approve-agent-action/` — the trust-UI approval endpoint.
- `packages/core/src/agent/playbookDraft.ts` — deterministic playbook auto-draft.
- `packages/core/src/agent/onboardingPlaybook.ts` — the onboarding seeding hook
  (called from `setOnboardingStep(..., { completed: true })`).

---

## The policy engine (deterministic)

`agent-policy.ts`. Tier is assigned from the action, never trusted from the model.

**Tier map**

| Action | Tier |
| --- | --- |
| Reply from published facts (`answer_faq`, `collect_intake`, `send_reminders`) | 1 |
| Slot proposal / quote-in-range / reschedule (`booking.propose_slots`, `quote_in_range`, `reschedule`) | 2 |
| Payments/refunds/verification/external + any `flag.handoff` | 3 (always artist-only) |

**Autonomy × tier decision (no override)**

| Autonomy | Tier 1 | Tier 2 | Tier 3 |
| --- | --- | --- | --- |
| `no_ai` | propose\* | propose | propose |
| `draft_only` | propose | propose | propose |
| `assisted` | **execute** (tier-1 `reply.autosend`) | propose | propose |
| `managed` | **execute** | propose (one-tap approve) | propose |

\* `no_ai` jobs aren't enqueued at all (trigger gate); the engine stays safe anyway.
`note.log` is internal bookkeeping and always "executes" (writes the log, sends nothing).

**Per-action-class overrides** (`agent_settings.action_class_overrides` = `{ [class]: "auto" | "ask" | "off" }`):
`ask`/`off` force propose; `auto` allows execute for tier 1 & 2 only — **tier 3 can
never be upgraded** (payments/verification/external stay artist-only).

**Grounding validator.** Every `$` amount and date/time in `draft_text` must appear
(normalized) in some `context_used[].detail`. A violation forces the status to
`proposed` and records the reason. Slot proposals are filled *authoritatively* from
real availability (`proposeSlots`), never from the model's dates, so they're grounded
by construction.

---

## The queue

`agent_jobs` (RLS default-deny; service-role only, like `stripe_events`).

- **Enqueue** — hardened SECURITY DEFINER triggers fire on: (a) a `messages` insert
  where the sender is the thread's client, and (b) a `booking_requests` insert. Both
  gate on the artist's `agent_settings.autonomy <> 'no_ai'` (a *missing* settings row
  defaults to `draft_only`, so it still enqueues). `dedupe_key` (`message:<id>` /
  `booking_request:<id>`) + a unique index make enqueue idempotent.
- **Drain** — `agent_jobs_lease(N)` moves up to N `pending` rows to `running`
  (`FOR UPDATE SKIP LOCKED`) and burns one attempt. A processing failure re-queues the
  job (`pending`) until `attempts >= max_attempts` (3), then parks it `failed`.
- **Schedule** — `pg_cron` job **`agent-run-drain`** runs every minute and calls
  `public.agent_run_tick()`. The tick is fully guarded: it no-ops when the queue is
  empty **or** when the Vault secrets are absent, so it's safe *right now*, before the
  function is deployed and before any key exists — nothing fires against a missing
  endpoint.

### If pg_cron were unavailable

pg_cron **is** available on this project (enabled in the migration). If it weren't,
drain via either: an external scheduler (GitHub Actions / cron) doing an authenticated
`POST` to `/functions/v1/agent-run` with the service-role key every minute, or a
manual `POST` on demand. The function is idempotent per job (lease + attempts), so
extra invocations are harmless.

---

## Environment variables

Set as **Supabase function secrets** (never committed). Template:
`supabase/functions/.env.example`.

| Var | Required | Default | Purpose |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | ✅ (for `agent-run`) | — | Anthropic Messages API key. Absent → `agent-run` returns 503 and leases nothing. |
| `AGENT_MODEL` | — | `claude-sonnet-4-5` | Model for the AI staff. |
| `AGENT_MAX_TOKENS` | — | `1024` | Per-run output cap. |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | auto | — | Injected by the runtime; do not set by hand. |

Two **Vault** secrets drive the pg_cron drain (set once, after deploy):

| Vault secret | Value |
| --- | --- |
| `agent_runner_url` | `https://khlpidflnvkqafkvkpfy.functions.supabase.co/agent-run` |
| `agent_runner_service_key` | the project's service-role key (used as the bearer) |

---

## Functions

### `agent-run` (auth: service-role bearer; `verify_jwt = false`)

`POST /functions/v1/agent-run` · body `{ batch_size? }` → `{ ok, processed, executed, proposed, skipped, failed }`.
Requires the service-role key as the bearer. Drains a batch of the queue.

### `approve-agent-action` (auth: artist JWT; `verify_jwt = true`) — **the trust-UI contract**

`POST /functions/v1/approve-agent-action` · body
`{ action_id, decision: "approve" | "reject", edited_draft? }` →
`{ status: "executed" | "rejected", message_id }`.

Validates the caller owns the action and it's still `proposed`. Approve posts the
agent message (or the proposed-slots message) and stamps
`status=executed` + `executed_message_id` + `approved_by/at`; an `edited_draft`
replaces the text and is recorded into `payload.edited`. Reject stamps `rejected`.
Failure envelope: `{ "error": { "code", "message" } }` with the matching HTTP status.

---

## Playbook auto-draft

`packages/core/src/agent/playbookDraft.ts` (pure) turns onboarding data into starter
`agent_playbooks` entries: **Pricing & services**, **Deposit policy**,
**Location & hours**, **Aftercare basics** (aftercare is a universal safe default; the
others only render when there's real data). `seedOnboardingPlaybook` is called
best-effort from `setOnboardingStep(..., { completed: true })` and is idempotent (skips
if any `source='onboarding'` rows already exist). The agent cites these entries in its
reasoning summaries.

---

## Tests (offline, zero dependencies)

All runtime logic is unit-tested with fakes — no Anthropic, no Supabase, no network —
using Node's built-in runner with type-stripping (Node ≥ 22):

```bash
node --test supabase/functions/_shared/agent-contract.test.ts \
            supabase/functions/_shared/agent-model.test.ts \
            supabase/functions/_shared/agent-policy.test.ts \
            supabase/functions/_shared/agent-prompt.test.ts \
            supabase/functions/_shared/agent-approval.test.ts \
            supabase/functions/_shared/agent-runner.test.ts
# 64 tests, all green
```

Coverage: policy matrix (4 autonomy × 3 tiers × overrides), grounding (pass +
money/date violations), the JSON parser + one-retry, the prompt-builder snapshot,
queue leasing/dedupe, the end-to-end run (execute vs propose, grounding downgrade,
slot grounding, handoff fallback, forced escalation), and approve/reject transitions.
The same `_shared` modules are imported by the deployed Deno functions, so these
tests cover the deployed logic. Run `deno check` once locally before deploy (the build
sandbox had no Deno CLI; entrypoints were syntax-checked with Node).

---

## Deploying (do NOT deploy until the Anthropic key exists)

```bash
# 1. Secrets (from a filled-in copy of supabase/functions/.env.example)
supabase secrets set --project-ref khlpidflnvkqafkvkpfy --env-file supabase/functions/.env

# 2. Type-check
cd supabase/functions && deno task check

# 3. Deploy (config.toml controls verify_jwt per function)
supabase functions deploy agent-run             --project-ref khlpidflnvkqafkvkpfy --no-verify-jwt
supabase functions deploy approve-agent-action  --project-ref khlpidflnvkqafkvkpfy
```

---

## When Michael has the Anthropic key

1. Put the key in `supabase/functions/.env` (`ANTHROPIC_API_KEY=sk-ant-…`; optionally
   `AGENT_MODEL` / `AGENT_MAX_TOKENS`) and `supabase secrets set --env-file …`.
2. Deploy the two functions (above).
3. Register the Vault secrets so pg_cron can reach the runner:
   ```sql
   select vault.create_secret(
     'https://khlpidflnvkqafkvkpfy.functions.supabase.co/agent-run', 'agent_runner_url');
   select vault.create_secret('<SERVICE_ROLE_KEY>', 'agent_runner_service_key');
   ```
   The `agent-run-drain` cron (already scheduled, every minute) starts draining the
   moment both secrets exist — no code change.
4. (Optional) After merge, regenerate `packages/core/src/types/database.ts` so the
   apps get typed `agent_jobs` + `agent_actions.executed_message_id`.
5. Smoke test: as an artist, set autonomy to `assisted`; have a client send a message
   or booking request → within a minute an `agent_actions` row appears (tier-1 grounded
   replies auto-send; everything else waits in the approval queue for
   `approve-agent-action`).

That's the whole wiring. Nothing else in the code changes to go live.

---

## Scheduled jobs (Studio Manager)

SPEC §5's third agent role — **Studio Manager**: "deposit chasing, no-show
follow-up, rebooking nudges ..., weekly business digest." Unlike Front Desk /
Booking Manager, these three jobs are **fully deterministic — no Anthropic API
call, no `ANTHROPIC_API_KEY` dependency.** Every draft is a template filled
straight from real DB facts, so this runs (and has been proven against live
demo data) before the LLM key exists.

**Why a sibling function, not an `agent-run` dispatch branch.** `agent-run`
503s outright when `ANTHROPIC_API_KEY` is absent (see `agent-run/index.ts`) —
that's correct for the LLM-backed roles, but wrong for jobs that must work
without a key. `agent-scheduled` is a separate edge function with its own
auth check (service-role bearer, same pattern) and zero model dependency.
Both share the **same** `agent_jobs` queue and the **same**
`agent_jobs_lease` RPC — a `job_kind` column discriminates dispatch instead
of `agent_role`/`trigger_kind` the way `agent-run` uses role.

### Files (this lane owns)

- `supabase/migrations/20260716090000_studio_manager_scheduled_jobs_and_plan.sql`
  — `agent_jobs.job_kind` + `scheduled_scan` trigger_kind, `agent_actions.dedupe_key`,
  `agent_scheduled_enqueue()` / `agent_scheduled_tick()` (guarded/no-op-safe
  exactly like `agent_run_tick()`), daily pg_cron `agent-scheduled-drain`.
- `supabase/functions/_shared/agent-scheduled.ts` — pure selection logic +
  templates for all three jobs (candidate selection, draft text, `context_used`,
  dedupe keys). Zero DB/network imports — runs under `node --test` and Deno.
- `supabase/functions/agent-scheduled/` — the drainer edge function: leases
  `scheduled_scan` jobs via `agent_jobs_lease`, runs the DB reads (embedded
  `bookings(services(name))` selects), find-or-creates the artist↔client
  thread, and persists `agent_actions` (+ a `notifications` row for the
  digest).

### The three jobs

| Job | Selection | Result |
| --- | --- | --- |
| `deposit_chase` | `sessions` with `status in (scheduled, confirmed)`, `deposit_cents > 0`, `deposit_paid = false`, booked (`created_at`) more than 72h ago | `reply.draft`, tier 2, **always proposed** — templated reminder into the booking's thread |
| `rebook_nudge` | `sessions.status = 'completed'`, `coalesce(scheduled_end, updated_at)` 30+ days ago, client has no future `scheduled`/`confirmed` session with this artist (most recent completed session per client) | `reply.draft`, tier 2, **always proposed** — templated rebooking invite |
| `weekly_digest` | Every Monday, per artist with Studio Manager enabled | `note.log`, tier 1, **always executed** (mirrors `note.log`'s existing always-executes rule) + a `notifications` row (new requests / sessions done / deposits held / pending approvals, past 7 days) |

`deposit_chase`'s 72h window is measured from the session's `created_at`
(when it was put on the books), not `scheduled_start` (the appointment
itself) — the point is to chase a deposit that's gone stale since booking,
regardless of how far out the session is.

Tier and status are **fixed by business rule here**, not run through
`agent-policy.ts`'s `decideAction`/autonomy lookup — `deposit_chase` and
`rebook_nudge` always propose (never auto-send, regardless of autonomy,
since a client-facing draft still needs a human okay) and `weekly_digest`
always executes (it's an internal note, like `note.log` already is
everywhere else in the runtime). This keeps "tier lives outside the model"
true trivially: there is no model in this path at all.

**Idempotency.** `agent_jobs.dedupe_key` makes the daily/weekly *enqueue*
idempotent (`scheduled:<job_kind>:<artist_id>:<date-or-week>`); a second,
independent `agent_actions.dedupe_key` (added by the same migration) makes
each *candidate* idempotent within a job run — `deposit_chase:<session_id>:<week>`
(re-chases weekly if still unpaid), `rebook_nudge:<session_id>` (one-shot,
never re-fires once nudged), `weekly_digest:<artist_id>:<week>`.

**Gating.** `deposit_chase`/`rebook_nudge` enqueue only when
`agent_settings.studio_manager_enabled` **and** `autonomy <> 'no_ai'` (they
draft client-facing text, so they respect the same AI-off gate as the
message/booking_request triggers). `weekly_digest` only requires
`studio_manager_enabled` — it's internal-only, so it isn't blocked by
`no_ai` (same reasoning as `note.log`'s "always executes").

**Trust UI.** These write plain `agent_actions` rows against the existing
contract (`payload.trigger.kind` is additionally `"scheduled_scan"` — an
informational value; the UI's `useAgentActionTriggerMessage` already treats
any non-`"message"` kind as "nothing to fetch", so this needs zero UI code
changes) with `agent_role = 'studio_manager'`. `StaffNameplate` doesn't have
a `studio_manager` entry in `STAFF` (`apps/web/src/components/ai-staff/meta.ts`)
on purpose — it falls back to a generic "AI staff" nameplate, because adding
one there would also require teaching `StaffOverviewHeader`'s per-role on/off
card about the third role (its `enabledByRole` lookup and 2-card grid layout
both assume exactly Front Desk + Booking Manager). That's future UI work, not
part of this lane. See `apps/web/src/app/dev/ai-staff-preview/page.tsx`
fixtures `act-deposit-chase-1` / `act-rebook-nudge-1` / `act-weekly-digest-1`
for proof the existing approvals inbox + activity feed render all three
correctly today.

### Deploying (same "not yet" as agent-run)

```bash
supabase functions deploy agent-scheduled --project-ref khlpidflnvkqafkvkpfy --no-verify-jwt
```

Then register the Vault secrets so the daily cron can reach it:

```sql
select vault.create_secret(
  'https://khlpidflnvkqafkvkpfy.functions.supabase.co/agent-scheduled', 'agent_scheduled_url');
-- 'agent_runner_service_key' is already registered for agent-run and is reused here.
```

No `ANTHROPIC_API_KEY` involvement anywhere in this path — it can go live the
moment the function is deployed and the one Vault secret above is set,
independent of the LLM key.

### Tests (offline, zero dependencies)

```bash
node --test supabase/functions/_shared/agent-scheduled.test.ts
# 24 tests, all green — selection logic (all three jobs, boundary conditions,
# dedupe/status exclusions) + template/grounding + ISO-week helpers.
```
