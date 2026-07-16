// POST /functions/v1/daily-drop
//
// The daily personalized "drop" generator (founder §engagement). Once a day the
// pg_cron `daily-drop-generate` tick (13:00 UTC) wakes this function; it iterates
// active users and, for each, selects ONE highlighted post/flash they haven't
// been shown — personalized via their style affinity (user_style_affinity) +
// optional similar_works seeding, with day-to-day variety and a cold-start
// fallback so no one gets a blank. It writes a `daily_drops` row (idempotent per
// (user, drop_date)) and enqueues an in-app `daily_drop` notification.
//
// Like agent-scheduled, this makes NO Anthropic call — the AI signal is the
// already-computed image_tags. It runs identically before/after the LLM key.
//
// AUTH: verify_jwt = false at the gateway (config.toml); the function enforces
// the AI-runtime bearer itself (AGENT_RUNNER_TOKEN, service-key fallback).
import { isAuthorizedRunner } from "../_shared/agent-auth.ts";
import { getAdminClient, type SupabaseClient } from "../_shared/supabaseAdmin.ts";
import { errorResponse, jsonResponse } from "../_shared/errors.ts";
import {
  selectDailyDrop,
  type DropCandidate,
  type PriorDrop,
  type StyleAffinity,
} from "../_shared/daily-drop.ts";

interface RequestBody {
  /** Override the drop day (YYYY-MM-DD, UTC). Defaults to today. Testing/backfill. */
  drop_date?: string;
  /** Generate for a single user only (on-demand / testing). */
  user_id?: string;
  /** Page size when iterating all active users. */
  batch_size?: number;
  /** Page offset when iterating all active users. */
  offset?: number;
}

interface Summary {
  drop_date: string;
  processed: number; // users considered
  created: number; // new daily_drops rows written
  skipped: number; // already had a drop (idempotent) or no eligible candidate
  failed: number;
}

const MAX_CANDIDATES = 400;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!isAuthorizedRunner(req)) return new Response("Unauthorized", { status: 401 });

  try {
    const body = await readBody(req);
    const dropDate = body.drop_date ?? utcDate(new Date());
    const admin = getAdminClient();

    const userIds = body.user_id
      ? [body.user_id]
      : await listActiveUserIds(admin, body.batch_size ?? 200, body.offset ?? 0);

    const summary: Summary = { drop_date: dropDate, processed: 0, created: 0, skipped: 0, failed: 0 };
    for (const userId of userIds) {
      summary.processed++;
      try {
        const created = await generateForUser(admin, userId, dropDate);
        if (created) summary.created++;
        else summary.skipped++;
      } catch (err) {
        summary.failed++;
        console.error(`daily-drop: user ${userId}:`, err);
      }
    }
    return jsonResponse({ ok: true, ...summary });
  } catch (err) {
    console.error("daily-drop:", err);
    return errorResponse(err);
  }
});

async function readBody(req: Request): Promise<RequestBody> {
  try {
    const text = await req.text();
    return text ? (JSON.parse(text) as RequestBody) : {};
  } catch {
    return {};
  }
}

/** UTC calendar date, YYYY-MM-DD. */
function utcDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Every profile is a client (dual-role model), so "active user" = every
 * profile. Paged so a large base can be swept across cron ticks. */
async function listActiveUserIds(db: SupabaseClient, limit: number, offset: number): Promise<string[]> {
  const { data, error } = await db
    .from("profiles")
    .select("id")
    .order("created_at", { ascending: true })
    .range(offset, offset + Math.max(1, limit) - 1);
  if (error) throw new Error(`list users failed: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => r.id as string);
}

// ---------------------------------------------------------------------------
// Per-user generation
// ---------------------------------------------------------------------------
/** Returns true when a NEW drop was written (false = idempotent skip / no pick). */
async function generateForUser(db: SupabaseClient, userId: string, dropDate: string): Promise<boolean> {
  // Idempotency short-circuit (the unique index is the authoritative guard;
  // this just avoids the candidate work when a drop already exists).
  const { data: existing } = await db
    .from("daily_drops")
    .select("id")
    .eq("user_id", userId)
    .eq("drop_date", dropDate)
    .maybeSingle();
  if (existing) return false;

  const [affinity, priorDrops, excludeArtistId] = await Promise.all([
    loadAffinity(db, userId),
    loadPriorDrops(db, userId),
    loadOwnArtistId(db, userId),
  ]);

  const candidates = await loadCandidates(db, affinity, excludeArtistId);
  const selection = selectDailyDrop({ affinity, candidates, priorDrops, dropDate, userId, excludeArtistId });
  if (!selection) return false;

  const c = selection.candidate;
  // Idempotent insert: ignore duplicates so a racing/re-run tick is a no-op.
  const { data: inserted, error: insErr } = await db
    .from("daily_drops")
    .upsert(
      {
        user_id: userId,
        drop_date: dropDate,
        subject_type: c.subjectType,
        subject_id: c.subjectId,
        artist_id: c.artistId,
        reason: selection.reason,
        reason_style: selection.reasonStyle,
        is_cold_start: selection.isColdStart,
        score: selection.score,
      },
      { onConflict: "user_id,drop_date", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (insErr) throw new Error(`insert daily_drop failed: ${insErr.message}`);
  if (!inserted) return false; // lost the race — another tick already wrote today's drop.

  await enqueueDropNotification(db, userId, inserted.id as string, c, selection.reason);
  return true;
}

async function loadAffinity(db: SupabaseClient, userId: string): Promise<StyleAffinity[]> {
  const { data, error } = await db.rpc("user_style_affinity", { p_user_id: userId });
  if (error) throw new Error(`user_style_affinity failed: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    slug: r.style_slug as string,
    weight: Number(r.weight),
    source: (r.top_source as StyleAffinity["source"]) ?? undefined,
  }));
}

async function loadPriorDrops(db: SupabaseClient, userId: string): Promise<PriorDrop[]> {
  const { data, error } = await db
    .from("daily_drops")
    .select("subject_type, subject_id, artist_id, reason_style, drop_date")
    .eq("user_id", userId)
    .order("drop_date", { ascending: false })
    .limit(90);
  if (error) throw new Error(`load prior drops failed: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    subjectType: r.subject_type as PriorDrop["subjectType"],
    subjectId: r.subject_id as string,
    artistId: (r.artist_id as string | null) ?? null,
    reasonStyle: (r.reason_style as string | null) ?? null,
    dropDate: r.drop_date as string,
  }));
}

async function loadOwnArtistId(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await db.from("artist_profiles").select("id").eq("profile_id", userId).maybeSingle();
  return data ? (data.id as string) : null;
}

// ---------------------------------------------------------------------------
// Candidate pool: public posts (trending + followed) and available flash, each
// enriched with its AI image_tags styles/confidences so the ranker can match
// them to the user's affinity even when nothing was tagged manually.
// ---------------------------------------------------------------------------
async function loadCandidates(
  db: SupabaseClient,
  affinity: StyleAffinity[],
  excludeArtistId: string | null,
): Promise<DropCandidate[]> {
  const [postsRes, flashRes] = await Promise.all([
    db
      .from("posts")
      .select("id, artist_id, like_count, created_at")
      .eq("is_public", true)
      .order("like_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(MAX_CANDIDATES),
    db
      .from("flash_items")
      .select("id, artist_id, created_at, flash_sheets!inner(is_public)")
      .eq("is_available", true)
      .eq("flash_sheets.is_public", true)
      .order("created_at", { ascending: false })
      .limit(MAX_CANDIDATES),
  ]);
  if (postsRes.error) throw new Error(`load posts failed: ${postsRes.error.message}`);
  if (flashRes.error) throw new Error(`load flash failed: ${flashRes.error.message}`);

  const posts = (postsRes.data ?? []) as Record<string, unknown>[];
  const flash = (flashRes.data ?? []) as Record<string, unknown>[];

  const postIds = posts.map((p) => p.id as string);
  const flashIds = flash.map((f) => f.id as string);
  const tags = await loadTags(db, postIds, flashIds);

  const candidates: DropCandidate[] = [];
  for (const p of posts) {
    const t = tags.get(`post:${p.id}`);
    candidates.push({
      subjectType: "post",
      subjectId: p.id as string,
      artistId: (p.artist_id as string | null) ?? null,
      styles: t?.styles ?? [],
      styleConfidences: t?.confidences,
      likeCount: Number(p.like_count ?? 0),
      isAvailable: true,
      createdAt: p.created_at as string,
    });
  }
  for (const f of flash) {
    const t = tags.get(`flash_item:${f.id}`);
    candidates.push({
      subjectType: "flash",
      subjectId: f.id as string,
      artistId: (f.artist_id as string | null) ?? null,
      styles: t?.styles ?? [],
      styleConfidences: t?.confidences,
      likeCount: 0,
      isAvailable: true,
      createdAt: f.created_at as string,
    });
  }

  // Best-effort: expand with similar_works neighbors seeded from the user's most
  // recent saved/liked tagged post, so visual similarity (not just style slugs)
  // can drive a pick. Never fatal — embeddings may be absent pre-backfill.
  try {
    await seedSimilarWorks(db, affinity, candidates, excludeArtistId);
  } catch (err) {
    console.warn("daily-drop: similar_works seeding skipped:", err);
  }

  return candidates;
}

interface TagRow {
  styles: string[];
  confidences: number[];
}

async function loadTags(
  db: SupabaseClient,
  postIds: string[],
  flashIds: string[],
): Promise<Map<string, TagRow>> {
  const map = new Map<string, TagRow>();
  const ids = [...postIds, ...flashIds];
  if (ids.length === 0) return map;
  // image_tags is polymorphic; fetch both subject types in one pass.
  const { data, error } = await db
    .from("image_tags")
    .select("subject_type, subject_id, styles, style_confidences")
    .in("subject_id", ids)
    .in("subject_type", ["post", "flash_item"]);
  if (error) throw new Error(`load image_tags failed: ${error.message}`);
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    map.set(`${r.subject_type as string}:${r.subject_id as string}`, {
      styles: (r.styles as string[]) ?? [],
      confidences: (r.style_confidences as number[]) ?? [],
    });
  }
  return map;
}

/** Merge similar_works similarity onto matching candidates (best-effort). */
async function seedSimilarWorks(
  db: SupabaseClient,
  affinity: StyleAffinity[],
  candidates: DropCandidate[],
  excludeArtistId: string | null,
): Promise<void> {
  // Only bother when we have some affinity to bias the neighbor style filter.
  if (candidates.length === 0) return;
  const styleSlugs = affinity.slice(0, 5).map((a) => a.slug);
  // Find a seed embedding: the tagged image_tags row of one of our candidates
  // with the strongest affinity overlap (proxy for "something they'd like").
  const seedId = candidates.find((c) => c.styles.some((s) => styleSlugs.includes(s)))?.subjectId;
  if (!seedId) return;
  const { data: seedRow } = await db
    .from("image_tags")
    .select("embedding")
    .eq("subject_id", seedId)
    .not("embedding", "is", null)
    .maybeSingle();
  const embedding = seedRow?.embedding;
  if (!embedding) return;

  const { data, error } = await db.rpc("similar_works", {
    p_embedding: embedding,
    p_limit: 30,
    p_exclude_artist: excludeArtistId ?? undefined,
    p_style_slugs: styleSlugs.length > 0 ? styleSlugs : undefined,
  });
  if (error) return;
  const byKey = new Map(candidates.map((c) => [`${c.subjectType}:${c.subjectId}`, c]));
  for (const n of (data ?? []) as Record<string, unknown>[]) {
    const st = n.subject_type === "flash_item" ? "flash" : (n.subject_type as string);
    const key = `${st}:${n.subject_id as string}`;
    const cand = byKey.get(key);
    if (cand) cand.similarity = Math.max(cand.similarity ?? 0, Number(n.similarity ?? 0));
  }
}

// ---------------------------------------------------------------------------
// Delivery — an in-app Wave-1 notification (bell + realtime badge). Its fan-out
// trigger leaves an uncategorized `daily_drop` type in-app only (no push/email
// spam); enabling push is a one-line category addition owned by the
// notifications lane (see docs/daily-drop.md).
// ---------------------------------------------------------------------------
async function enqueueDropNotification(
  db: SupabaseClient,
  userId: string,
  dropId: string,
  candidate: DropCandidate,
  reason: string,
): Promise<void> {
  let artistName = "an INKD artist";
  if (candidate.artistId) {
    const { data } = await db
      .from("artist_profiles")
      .select("profiles(display_name, handle)")
      .eq("id", candidate.artistId)
      .maybeSingle();
    const prof = data?.profiles as { display_name?: string; handle?: string } | null | undefined;
    artistName = prof?.display_name || (prof?.handle ? `@${prof.handle}` : artistName);
  }
  const kind = candidate.subjectType === "flash" ? "flash drop" : "piece";
  const { error } = await db.from("notifications").insert({
    profile_id: userId,
    type: "daily_drop",
    title: "Today's drop",
    body: `${artistName}'s ${kind}, picked for you — ${reason.toLowerCase()}.`,
    action_url: "/daily-drop",
    data: {
      drop_id: dropId,
      subject_type: candidate.subjectType,
      subject_id: candidate.subjectId,
      artist_id: candidate.artistId,
    },
  });
  if (error) throw new Error(`insert daily_drop notification failed: ${error.message}`);
}
