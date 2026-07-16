# INKD AI Image Understanding — auto-tagging + visual similarity

Auto-tags every artist image with structured attributes and a similarity
embedding. This is the substrate for three product surfaces:

- **Discovery style filter** — artists **never tag manually**, so the style
  facet is only as good as this. `search_artists` now unions AI-derived styles
  with any manually-assigned `artist_styles`.
- **Match my inspiration** (later wave) — "find artists whose work looks like
  this reference." Backed by `similar_works(embedding)`.
- **Daily drop** — style/subject-aware selection over tagged work.

Everything is **code-complete against env placeholders** — the only thing gating
live tagging is the `ANTHROPIC_API_KEY` secret (the SAME key the agent runtime
uses; **no new key for the founder**). The schema, queue, triggers, discovery
extension, and `similar_works` are live now; the queue is pre-seeded so tagging
begins the moment `tag-image` is deployed with the key.

---

## The embedding approach (and the tradeoff) — READ THIS

**Anthropic has no embeddings API.** Rather than make the founder add another
paid key (a hosted CLIP endpoint, an OpenAI/Cohere embeddings key, etc.), the
embedding is a **deterministic "semantic fingerprint"** built from the
structured tags Claude Vision returns:

| Block | Dims | Content |
| --- | --- | --- |
| styles | 25 | confidence-weighted, one slot per canonical style slug |
| placement | 20 | multi-hot over the canonical placement vocab |
| color_type | 4 | color / black_grey / both |
| size_estimate | 4 | small / medium / large |
| subject_matter | 107 | signed feature-hashing (FNV-1a) over the subject nouns |
| description | 96 | signed feature-hashing over description content words |
| **total** | **256** | L2-normalized → cosine similarity via pgvector `<=>` |

`vector(256)` = `VECTOR_DIM` in `supabase/functions/_shared/image-tagging.ts`.
The builder is pure, deterministic, and **unit-tested offline** — the same code
writes stored embeddings and builds query embeddings, so they're always
comparable.

**Why this and not a real visual embedding.** It needs **zero extra
infrastructure and no new key**, is byte-for-byte reproducible, fully testable
without network, and is built from exactly the axes discovery + match-inspiration
care about (style × placement × color × subject).

**The tradeoff — be honest about it.** This is a *semantic-tag* fingerprint, not
a pixel-level embedding. Two images a human finds visually similar but that the
model *tags* differently will score lower than a true CLIP model would; two
images with the same tags get the same vector regardless of composition. In
practice tattoo "similarity" is dominated by style/subject/color/placement — the
things we tag — so the fingerprint aligns well with intent.

**The upgrade path is a drop-in.** If a real CLIP/text embedding is ever wanted:
swap `buildImageVector()` for a call to that model, keep (or resize) `vector(N)`,
re-run the backfill. The DB, `similar_works()`, RLS, and the discovery extension
are **untouched** — `VECTOR_DIM` is the only contract both sides pin to.

---

## Schema (migration `20260717070000_ai_image_tagging.sql`)

- **pgvector** enabled in the `extensions` schema (0.8.0 → HNSW + ivfflat).
- **`image_tags`** — one row per image, polymorphic to
  `portfolio_pieces` / `posts` / `flash_items` via `(subject_type, subject_id)`
  (unique). Columns: `styles text[]` + parallel `style_confidences real[]`,
  `placement text[]`, `color_type` / `size_estimate` enums, `subject_matter
  text[]`, `description`, `embedding vector(256)` (NULL for untaggable images),
  `model_version`, `tagged_at`. Denormalized `artist_id` for cheap RLS + facet
  aggregation. **HNSW cosine index** on `embedding`; GIN on `styles`.
  - **RLS**: readable where the parent image is public (or by the owning artist
    for their own private images). **No write policies** — only the service-role
    `tag-image` function writes (mirrors `agent_jobs` / `stripe_events`).
- **`image_tag_jobs`** — durable tagging queue (RLS default-deny, service-role
  only). `image_tag_jobs_lease(N)` leases with `FOR UPDATE SKIP LOCKED`.
- **`similar_works(p_embedding, p_limit, p_exclude_artist, p_style_slugs)`** —
  SECURITY DEFINER cosine-KNN over PUBLIC tagged images; returns
  `similarity = 1 - cosine_distance`. Granted to anon + authenticated.
- **`search_artists`** — REPLACED (same signature/return); the `styles` facet is
  now `artist_styles ∪ (distinct AI tags from the artist's public images)`.
  Purely additive — broader matches, no caller change.

## Pipeline: backfill + new uploads

- **Enqueue trigger** — one generic SECURITY DEFINER trigger
  (`enqueue_image_tag_job`) on `portfolio_pieces` / `posts` / `flash_items`
  fires on INSERT and on an image-column change. It reads the right image column
  per table (`to_jsonb(new)`), so it covers **manual uploads AND Instagram
  imports** (both just INSERT rows) with **no edits to the upload/import code**.
  Idempotent by `dedupe_key = '<subject_type>:<id>'`; a changed image re-queues.
- **Backfill** — `enqueue_untagged_images()` (service-role) enqueues every image
  with no `image_tags` row. The migration seeds it once on apply (27 demo images
  queued at build time). On first deploy the queue drains and tags them.
- **Drain** — `tag-image` in `batch` mode leases + tags. A guarded pg_cron job
  **`image-tag-drain`** (every 2 min) POSTs to the function; it **no-ops** while
  the queue is empty OR the Vault secrets are absent, so it's safe right now —
  nothing fires against a missing endpoint (same pattern as `agent_run_tick`).

## `tag-image` edge function

`POST /functions/v1/tag-image` · `verify_jwt = false` (gateway) · requires the
AI-runtime bearer (`AGENT_RUNNER_TOKEN`, or the service key) — identical to
`agent-run`. Needs `ANTHROPIC_API_KEY`; absent → `503 not_configured`.

| Body | Behavior |
| --- | --- |
| `{ "mode": "batch", "batch_size"? }` | drain the queue (default) |
| `{ "mode": "single", "subject_type", "subject_id" }` | tag one image + persist |
| `{ "mode": "inline", "image_url" }` | classify + return `{ tags, embedding }`, **no persist** (match-inspiration query images) |

It fetches the image server-side → base64 → Claude Vision with the classifier
prompt (which pins the model to the canonical style slugs) → maps to canonical
tags → drops styles below 0.25 confidence → builds the embedding (NULL if the
image is untaggable) → upserts `image_tags`.

## Client surface (`packages/core/src/api/similarWorks.ts`)

`findSimilarWorks(client, { embedding, limit?, excludeArtistId?, styleSlugs? })`,
`tagInspirationImage(client, imageUrl)` (calls `tag-image` inline), and the
one-shot `matchMyInspiration(client, imageUrl, opts)`. Self-contained types; the
`similar_works` RPC / `image_tags` table land in `database.ts` on the next type
regen (deferred post-merge, per the repo convention).

---

## Environment

Set as Supabase function secrets. `tag-image` **reuses** the agent runtime key.

| Var | Required | Default | Purpose |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | ✅ (for `tag-image`) | — | Vision + agent runtime (shared). Absent → 503. |
| `TAG_MODEL` | — | `AGENT_MODEL` / `claude-sonnet-4-5` | Vision model. |
| `TAG_MAX_TOKENS` | — | `700` | Per-image output cap. |
| `AGENT_RUNNER_TOKEN` | — | — | The bearer pg_cron sends (else the service key). |

One Vault secret drives the pg_cron drain (set after deploy):

| Vault secret | Value |
| --- | --- |
| `image_tagger_url` | `https://khlpidflnvkqafkvkpfy.functions.supabase.co/tag-image` |
| `agent_runner_service_key` | (already registered for agent-run; reused as the bearer) |

## Deploying / going live

`tag-image` is deployed (via MCP). To go live once the key exists:

```bash
# 1. Secret (reuses the agent runtime key)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-… --project-ref khlpidflnvkqafkvkpfy

# 2. (authoritative redeploy from the repo)
cd supabase/functions && deno task check
supabase functions deploy tag-image --project-ref khlpidflnvkqafkvkpfy --no-verify-jwt

# 3. Vault secret so the cron can reach it
#    select vault.create_secret(
#      'https://khlpidflnvkqafkvkpfy.functions.supabase.co/tag-image', 'image_tagger_url');
#    ('agent_runner_service_key' is already registered.)
```

Then the `image-tag-drain` cron (already scheduled, every 2 min) drains the
pre-seeded queue and tags all existing images; new uploads/IG imports enqueue
automatically and get tagged within a couple minutes. No code change to go live.

**In-sandbox note.** Live image egress is blocked in the build sandbox, so the
demo backfill wasn't run here (and the demo images are placeholder graphics, not
real tattoos — the model would classify them "not a tattoo" anyway). The
deterministic tag→slug mapper and embedding builder are proven by offline unit
tests, and `similar_works` + the AI-style discovery extension were proven live
against DB fixtures built by the same TS builder. Real backfill runs on first
deploy in the live env.

## Tests (offline, zero dependencies)

```bash
node --test supabase/functions/_shared/image-tagging.test.ts
# 21 tests — tag→slug mapping (aliases, unknown-drop, dedupe/confidence,
# 0..100 scale), placement/color/size mapping, mapVisionTags end-to-end, the
# deterministic vector builder (dimension, L2-norm, same-style > cross-style
# similarity, shared-subject ranking), and the vision-response parser.
```

---

## Wave-1 founder go-live config (consolidated)

The AI-tagging half needs only items 3 (and the already-set `ANTHROPIC_API_KEY`)
below. Full cross-feature checklist also lives in `docs/notifications.md`:

| # | What | Notes |
| --- | --- | --- |
| 1 | Resend API key + verified `getinkd.co` domain | Notifications email channel only. |
| 2 | Vault secrets for `notify-dispatch` | Notifications cron drain. |
| 3 | **Vault secrets for `tag-image`**: `agent_runner_service_key` (set) + `image_tagger_url` | Enables the `image-tag-drain` cron. Vision reuses the shared `ANTHROPIC_API_KEY` — no new key for the founder. |
| 4 | EAS creds for prod push | Notifications push in a production build. |

Everything is inert-until-configured: the drain no-ops while the URL secret is
absent, so setting item 3 is all that's required to start backfilling tags.
