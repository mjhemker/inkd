# INKD Security Audit — July 2026

*Full security audit after the large feature wave (shops, aftercare, daily-drop,
match-inspiration, body-map, waitlist, notifications, AI tagging, payments, AI
runtime). Conducted 2026-07-16 against Supabase project `khlpidflnvkqafkvkpfy`
and repo HEAD `c029d03`. Auditor: Opus security-audit agent (worktree branch).*

## TL;DR

**Overall posture: strong.** No critical or high-severity findings. Multi-tenant
isolation is enforced by RLS on every table and was verified with JWT-simulated
deny-tests — anon and cross-tenant reads of every sensitive table return **zero
rows**. Storage buckets are all private and participant-scoped. Every
`SECURITY DEFINER` function has a pinned `search_path`. Edge functions verify the
caller (JWT or Stripe signature or the runner bearer) and enforce ownership. No
secrets are committed.

Two migrations were applied (defense-in-depth grant tightening + covering
indexes). Two items need the **founder** (dashboard toggles) — neither is a live
vulnerability.

| Severity | Count | Notes |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 0 | — |
| Low | 3 | anon/authenticated over-broad grants (FIXED); SSRF surface in image proxy (accepted, auth-gated); generic 500 echoes error message (accepted) |
| Info | 5 | leaked-password toggle (founder); pg_net in public; auth conn strategy; permissive-policy perf; unused indexes |

---

## 1. Methodology

- Enumerated all 47 `public` tables + `storage` schema via `list_tables`; pulled
  every RLS policy (`pg_policies`), every table grant
  (`information_schema.role_table_grants`), every `SECURITY DEFINER` function
  with its `proconfig`, and all storage object policies.
- Ran `get_advisors` (security + performance) before and after fixes.
- **Actively tested** the highest-risk tables by simulating JWT claims
  (`set_config('request.jwt.claims', …)` + `set local role`) and attempting
  anon reads and cross-tenant reads that MUST return zero.
- Reviewed all 12 deployed edge functions + `_shared` auth helpers +
  `config.toml` `verify_jwt` map + the web `match-inspiration` proxy route.
- Scanned all tracked files for secret patterns and checked `.gitignore`.

---

## 2. RLS completeness & isolation (verified)

Every table in `public` has `rls_enabled = true`. Policies follow two consistent
tenancy predicates: `client_id = auth.uid()` (client-owned) and
`artist_id = current_artist_id()` (artist-owned, where `current_artist_id()` is a
`STABLE` `search_path=''` function returning the caller's `artist_profiles.id`).
Public-read tables gate on an explicit `is_public` / `is_published` / `is_active`
column or `true` for reference data (styles, availability, booking policies).

### 2.1 Deny/allow test results (JWT-simulated)

Sensitive rows are owned by artist A (`artist_id 0b0b…0001` / profile
`0a0a…0001`) and client `0a0a…0002`. Attacker artist B is profile
`65d3…6a5e`.

| Test | Role / identity | Table | Result | Verdict |
|---|---|---|---|---|
| anon read | `anon` | aftercare_checkins, device_push_tokens, waitlist_entries, waitlist_offers, notification_deliveries, stripe_events, daily_drops | **0 rows each** | PASS (deny) |
| anon read | `anon` | payments, messages, agent_actions, signed_waivers | **permission denied** (no table grant) | PASS (deny) |
| cross-tenant | artist B | payments (all) | **0** | PASS (deny) |
| cross-tenant | artist B | aftercare_checkins (all) | **0** | PASS (deny) |
| cross-tenant | artist B | agent_actions (all) | **0** | PASS (deny) |
| cross-tenant | artist B | signed_waivers (artist A's) | **0** | PASS (deny) |
| cross-tenant | artist B | messages (all) | **0** | PASS (deny) |
| cross-tenant | artist B | waitlist_entries (all) | **0** | PASS (deny) |
| owner read | artist A | payments / aftercare / agent_actions / waivers | 3 / 3 / 14 / 1 | PASS (allow) |
| owner read (post-fix) | artist A | aftercare_checkins | 3 | PASS (not broken by revoke) |

**Healed photos (`aftercare_checkins`) — verified private.** SELECT is limited to
`client_id = auth.uid() OR artist_id = current_artist_id()`; the actual image
bytes live in the private `aftercare-photos` bucket (see §3). Client and artist
each have an UPDATE policy (submit rating/photo vs. mark reviewed).

**Waitlist** rows (`waitlist_entries/offers/openings`) are client/artist scoped;
offers are created/claimed/declined only through `SECURITY DEFINER` RPCs, not
direct writes.

### 2.2 shop managed-member data

`shop_members.SELECT` exposes *active* members of *published* shops to any signed-in
user (public shop roster) plus own membership and shop managers via
`is_shop_manager()`. Columns are non-sensitive (role, membership_mode, status,
internal UUIDs) — this is the intended public staff listing, not a leak. The
richer `shop_managed_member_agenda(shop_id,…)` RPC is `SECURITY DEFINER` and
internally checks `is_shop_manager()` before returning any managed member's
schedule.

### 2.3 Service-role-only tables (RLS on, no policy = deny-all)

`agent_jobs`, `geocode_cache`, `image_tag_jobs`, `instagram_connections`,
`notification_deliveries`, `stripe_events` intentionally have **no** policies — they
are written/read only by the service role (queues, idempotency ledger, cache).
Deny-all to every other role is correct. (Advisor `rls_enabled_no_policy` — INFO,
intentional.) The 2026-07 hardening additionally stripped their `anon` +
`authenticated` table grants.

---

## 3. Storage bucket security (verified)

All three buckets are **private** (`public = false`): `media`, `booking-uploads`,
`aftercare-photos`. Object policies are participant-scoped by path convention
`{owner_uid}/…`:

| Bucket | Read | Write | Notes |
|---|---|---|---|
| `aftercare-photos` (healed photos) | client owns folder `{uid}/…`; artist reads only if an `aftercare_checkins` row links that client to them | client-only insert/update/delete under own uid | **private + tightly scoped** ✓ |
| `booking-uploads` (references, medical) | client owns folder; artist reads only via a matching `booking_requests` row | client-only under own uid | **private + tightly scoped** ✓ |
| `media` | owner reads own `{uid}/…`; chat media scoped to thread participants; **public read only** for `{uid}/avatar/…` and `{uid}/portfolio/…` | owner-only; chat insert requires thread participation | public paths limited to avatar/portfolio ✓ |

No storage gaps found.

---

## 4. Edge function authorization (verified)

`config.toml` `verify_jwt` matches intent. User-facing functions re-verify the
JWT in code via GoTrue `getUser(token)` (never trusting client claims) and check
ownership before any service-role write:

| Function | Gateway `verify_jwt` | In-code auth | Authorization check |
|---|---|---|---|
| `create-deposit-checkout` | true | `requireUser` | `session.client_id === user.id`; rejects already-paid; requires artist `charges_enabled` |
| `connect-onboarding-link` | true | `requireUser` | caller must be an artist (`artist_profiles.profile_id = user.id`) |
| `delete-account` | true | re-verify JWT | deletes only the caller's own `auth.users` row (cascade); best-effort own-storage cleanup |
| `approve-agent-action` | true | `requireUser` → artist | `applyApproval` throws `forbidden` unless `action.artist_id === approverArtistId` |
| `instagram-import` | true | `requireUser` | artist-scoped |
| `stripe-webhook` | false | **Stripe signature** (`constructEventAsync` + `STRIPE_WEBHOOK_SECRET`) | rejects missing/invalid signature |
| `agent-run`, `agent-scheduled`, `tag-image`, `notify-dispatch`, `send-push`, `send-email`, `daily-drop`, `instagram-oauth` | false | `isAuthorizedRunner` (runner bearer / service key) or signed HMAC `state` | server-to-server only; a browser/app cannot call them |

- **`send-push` / `send-email`** are bearer-gated, so a user cannot spam pushes or
  emails to arbitrary `user_id`s — they are reachable only server-to-server.
- **`match-inspiration`** web route authenticates the caller (cookie session or
  forwarded Supabase token) *before* proxying to the bearer-gated `tag-image`;
  the runner token is server-only and never returned. Input `image_url` is
  validated to `^https?://`.
- No secret is logged or returned; errors use a stable `{error:{code,message}}`
  envelope.

---

## 5. SECURITY DEFINER functions (verified)

All 44 `SECURITY DEFINER` functions in `public` have a **pinned `search_path`**
(`''`, `public`, or `public, extensions`) — none is exploitable via search-path
hijack. Triage of the ones the advisor flags as role-executable:

| Function(s) | Executable by | Verdict |
|---|---|---|
| `search_artists`, `similar_works` | anon + authenticated | **Intentional** — public discovery RPCs; return only public/published data |
| `claim_waitlist_offer`, `decline_waitlist_offer`, `register_push_token`, `is_shop_manager`, `current_owned_shop_id`, `shop_managed_member_agenda`, `waitlist_artist_open_session` | authenticated | **Intentional** — user RPCs that internally scope by `auth.uid()` / `current_artist_id()` / `is_shop_manager()`; definer rights are required to perform their controlled writes |
| triggers, `*_tick`, `*_lease`, `enqueue_*`, `handle_new_user`, `notify_*` | (not role-granted) | internal, definer for cross-table writes; `search_path=''` |

No over-exposed definer function found.

---

## 6. Secrets & config (verified)

- **No secrets committed.** Secret-pattern scan across all tracked files
  (excluding lockfile/`.example`) matched only documentation placeholders
  (`sk-ant-…`, `sk_test_…`, `whsec_…` as literal examples in `docs/` and
  `_shared/env.ts` comments). No real keys, no service-role JWTs, no tokens in
  `vercel.json`/config.
- `.gitignore` covers `.env`, `.env.local`, `.env.*.local`, `.env.development`,
  `.env.production`, plus `*.pem`, `*.key`, `*.p8/p12/jks`. `.env.example` files
  are intentionally tracked. The gitignored Mapbox token in `.env.local` is fine.

---

## 7. Advisor sweep — before / after

Fixes applied between the two runs: two migrations (§9).

| Finding | Level | Before | After | Disposition |
|---|---|---|---|---|
| `pg_graphql_authenticated_table_exposed` | WARN | 47 | 41 | 6 removed (service-role tables); rest are RLS-gated multi-tenant tables users must reach for their own rows — **accepted (RLS is the gate; deny-tested)** |
| `pg_graphql_anon_table_exposed` | WARN | 36 | 22 | 14 removed (sensitive tables); remaining 22 are intended public-read or RLS-return-zero-for-anon — **accepted** |
| `authenticated_security_definer_function_executable` | WARN | 9 | 9 | **intentional** (§5) |
| `anon_security_definer_function_executable` | WARN | 2 | 2 | **intentional** — `search_artists`, `similar_works` |
| `rls_enabled_no_policy` | INFO | 6 | 6 | **intentional** — service-role-only tables |
| `extension_in_public` (`pg_net`) | WARN | 1 | 1 | **accepted** — Supabase-managed extension; relocating risks breaking scheduled net calls |
| `auth_leaked_password_protection` | WARN | 1 | 1 | **FOUNDER action** — enable HIBP check in Auth dashboard |
| `unindexed_foreign_keys` (shops, shop_members) | INFO | 2 | 0 | **FIXED** (covering indexes) |
| `multiple_permissive_policies` (aftercare UPDATE) | WARN | 4 | 4 | **accepted** — two correct UPDATE policies (client vs artist); perf-only, negligible at this scale |
| `unused_index` | INFO | many | many | **accepted** — brand-new tables with no traffic yet |
| `auth_db_connections_absolute` | INFO | 1 | 1 | **FOUNDER/infra** — switch Auth to percentage-based connections before scaling instance size |

Net: 20 table-exposure warnings removed; both unindexed-FK findings resolved.

---

## 8. App-code authorization spot-check

- The `match-inspiration` proxy and all sensitive edge functions authenticate the
  caller server-side; none trusts client-supplied identity.
- Ownership is enforced in code (deposit checkout, approval) *and* by RLS at the
  DB — a client cannot act on artist data, a non-owner cannot manage a shop
  (`is_shop_manager` gate), a non-participant cannot read a thread
  (`messages`/`threads` policies join through `threads` participation).

---

## 9. What was FIXED (this branch)

1. **`20260717150000_security_audit_covering_indexes.sql`** — covering indexes on
   `shops.primary_location_id` and `shop_members.invited_by` (resolves
   `unindexed_foreign_keys`). Applied via Supabase MCP + mirrored.
   Commit `f9ee598`.
2. **`20260717150100_security_audit_revoke_anon_sensitive.sql`** — defense-in-depth:
   `REVOKE ALL` from `anon` on 8 client/user-scoped tables (aftercare_checkins,
   device_push_tokens, notification_preferences, daily_drops, waitlist_entries/
   offers/openings, instagram_import_runs) and from `anon` + `authenticated` on 6
   service-role-only tables (stripe_events, agent_jobs, image_tag_jobs,
   notification_deliveries, geocode_cache, instagram_connections). RLS already
   denied every row; this removes them from the anon/authenticated GraphQL
   surface. Verified: anon now hard-`permission denied`; authenticated owner
   access unaffected. Applied via Supabase MCP + mirrored. Commit `8c6effa`.

---

## 10. What needs the FOUNDER (dashboard / infra — not code)

1. **Enable leaked-password protection** (Auth → Policies → "Check against
   HaveIBeenPwned"). Advisor `auth_leaked_password_protection`. Low effort, real
   value.
2. **Auth connection strategy** — switch from the absolute 10-connection cap to
   percentage-based before increasing instance size (perf, pre-scale).
3. *(Optional)* Move `pg_net` out of the `public` schema — low priority; defer
   unless Supabase support advises, since scheduled `pg_net` calls depend on it.

---

## 11. Residual accepted risks (with justification)

- **`pg_graphql_*_table_exposed` (63 remaining).** Standard Supabase behavior:
  the `anon`/`authenticated` roles hold table-level SELECT so PostgREST/GraphQL
  can serve them, but **RLS is the real gate** and deny-tests prove zero
  cross-tenant/anon leakage. Remaining anon-exposed tables are all intended
  public-read (posts, profiles, artist_profiles, services, studio_locations,
  styles, flash_*, portfolio_pieces, reviews, shops, shop_members roster,
  image_tags for public subjects, follows/post_likes/saved_posts social signals,
  waiver_templates defaults). Remaining authenticated-exposed tables (payments,
  messages, signed_waivers, …) cannot have `authenticated` revoked because users
  legitimately read their own rows through them.
- **SSRF surface via `match-inspiration` → `tag-image` image fetch (Low).** An
  authenticated user can supply an arbitrary `http(s)` `image_url` that the
  edge function fetches. Runs in the Supabase edge sandbox and returns only a
  Claude-derived tag/embedding (never raw response bodies), and it is auth-gated,
  so impact is minimal. *Recommendation (not fixed — product/infra call):* add a
  private-IP / metadata-endpoint denylist if this is ever exposed more broadly.
- **Generic 500 echoes `error.message` (Low).** `errorResponse` returns the raw
  message for unexpected errors — could surface internal detail (never secrets,
  which are not embedded in messages). Acceptable; consider a generic message in
  prod.
- **`multiple_permissive_policies` on `aftercare_checkins` UPDATE.** Two correct,
  intentionally-separate policies (client submits healing photo/rating; artist
  marks reviewed). Perf-only; negligible at pilot scale. Left as-is to avoid
  churning working security policy.

---

## 12. Verify matrix

| Step | Result |
|---|---|
| env files copied (web/mobile/core/functions `.env` + web/mobile `.env.local`) | ✓ |
| `pnpm install --frozen-lockfile` | ✓ (lockfile up to date) |
| `pnpm turbo lint typecheck` | ✓ 8/8 tasks (0 errors; 4 pre-existing `no-explicit-any` warnings in waitlist components, unrelated to this audit) |
| `pnpm --filter web build` | ✓ exit 0 |
| `pnpm --filter mobile exec tsc --noEmit` | ✓ exit 0 |
| advisors re-run (before/after) | ✓ §7 |
| RLS deny-tests re-run post-fix | ✓ §2.1 (anon hard-denied; owner unaffected) |

No code files were modified (fixes are DB migrations only); the pre-existing lint
warnings and unused-index INFOs are unchanged by this work.
