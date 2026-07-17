// POST /functions/v1/tag-image
//
// AI auto-tagging for artist images (portfolio_pieces / posts / flash_items).
// Calls Claude Vision (REUSING the same ANTHROPIC_API_KEY as the agent runtime —
// no new key for the founder), maps the result onto the canonical style taxonomy,
// builds the deterministic semantic-fingerprint embedding, and upserts image_tags.
//
// Modes (JSON body):
//   { mode: "batch", batch_size? }              drain the image_tag_jobs queue
//   { mode: "single", subject_type, subject_id }tag one specific image + persist
//   { mode: "inline", image_url }               tag an arbitrary image, return
//                                               tags + embedding, DO NOT persist
//                                               (for the match-inspiration wave's
//                                                query images)
//
// AUTH: verify_jwt = false at the gateway (config.toml). The persisting modes
// (`batch` drain, `single` tag+persist) require the AI-runtime bearer token
// (pg_cron sends it — see _shared/agent-auth.ts; prefers AGENT_RUNNER_TOKEN,
// falls back to the service-role key). The read-only `inline` mode (classify a
// transient query image, return tags + embedding, persist NOTHING) additionally
// accepts an ordinary signed-in USER JWT, so the match-my-inspiration proxy
// needs NO server-side runner secret on localhost — it just forwards the user's
// own session token. Inline touches no rows, so a signed-in user calling it is
// safe (same cost surface the proxy already gated).
//
// NOTE (no key yet): needs ANTHROPIC_API_KEY. Absent → 503, nothing is leased.
// The heavy tag→slug + vector logic lives in _shared/image-tagging.ts and is
// unit-tested offline; this file is I/O + orchestration only.
import { isAuthorizedRunner } from "../_shared/agent-auth.ts";
import { tryResolveUser } from "../_shared/auth.ts";
import { getAdminClient, type SupabaseClient } from "../_shared/supabaseAdmin.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/errors.ts";
import {
  AnthropicVisionClient,
  resolveTagModelConfig,
  type VisionClient,
} from "../_shared/image-vision.ts";
import {
  buildImageVector,
  isZeroVector,
  mapVisionTags,
  MODEL_VERSION,
  parseVisionResponse,
  toPgVectorLiteral,
  type ImageTags,
} from "../_shared/image-tagging.ts";

type SubjectType = "portfolio_piece" | "post" | "flash_item";

interface TagJob {
  id: string;
  subject_type: SubjectType;
  subject_id: string;
  artist_id: string | null;
  image_url: string | null;
  attempts: number;
  max_attempts: number;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // Read the body first so auth can depend on the mode: `inline` (read-only)
  // accepts a signed-in user JWT; the persisting modes require the runner bearer.
  const body = await readBody(req);
  const runner = isAuthorizedRunner(req);
  if (!runner) {
    if (body.mode === "inline") {
      const uid = await tryResolveUser(req);
      if (!uid) return new Response("Unauthorized", { status: 401 });
    } else {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey || apiKey.trim() === "") {
    return jsonResponse(
      { error: { code: "not_configured", message: "ANTHROPIC_API_KEY is not set" } },
      503,
    );
  }

  try {
    const { model, maxTokens } = resolveTagModelConfig((k) => Deno.env.get(k));
    const vision = new AnthropicVisionClient({ apiKey, model, maxTokens });
    const admin = getAdminClient();

    if (body.mode === "inline") {
      if (!body.image_url) throw new Error("inline mode requires image_url");
      const { tags, embedding } = await classify(vision, body.image_url);
      return jsonResponse({
        ok: true,
        mode: "inline",
        tags,
        embedding, // caller passes this straight to similar_works
        model_version: MODEL_VERSION,
      });
    }

    if (body.mode === "single") {
      if (!body.subject_type || !body.subject_id) {
        throw new Error("single mode requires subject_type + subject_id");
      }
      const job = await loadSubjectAsJob(admin, body.subject_type, body.subject_id);
      if (!job) throw new Error("subject not found or has no image");
      const result = await processJob(admin, vision, job);
      return jsonResponse({ ok: true, mode: "single", ...result });
    }

    // default: batch drain.
    const batchSize = clampBatch(body.batch_size);
    const summary = await drainBatch(admin, vision, batchSize);
    return jsonResponse({ ok: true, mode: "batch", ...summary });
  } catch (err) {
    console.error("tag-image:", err);
    return errorResponse(err);
  }
});

// ---------------------------------------------------------------------------
async function classify(
  vision: VisionClient,
  imageUrl: string,
): Promise<{ tags: ImageTags; embedding: number[] }> {
  const raw = await vision.classify(imageUrl);
  const tags = mapVisionTags(parseVisionResponse(raw));
  return { tags, embedding: buildImageVector(tags) };
}

// Persist tags for one image. Styles below a confidence floor are dropped so the
// discovery facet stays clean (an unsure guess shouldn't make an artist show up
// under a style). A zero embedding (untaggable / "not a tattoo") is stored NULL.
const CONFIDENCE_FLOOR = 0.25;

async function persist(
  admin: SupabaseClient,
  subjectType: SubjectType,
  subjectId: string,
  artistId: string | null,
  imageUrl: string | null,
  tags: ImageTags,
  embedding: number[],
): Promise<void> {
  const kept = tags.styles.filter((s) => s.confidence >= CONFIDENCE_FLOOR);
  const row = {
    subject_type: subjectType,
    subject_id: subjectId,
    artist_id: artistId,
    image_url: imageUrl,
    styles: kept.map((s) => s.slug),
    style_confidences: kept.map((s) => Number(s.confidence.toFixed(4))),
    placement: tags.placement,
    color_type: tags.color_type,
    size_estimate: tags.size_estimate,
    subject_matter: tags.subject_matter,
    description: tags.description || null,
    embedding: isZeroVector(embedding) ? null : toPgVectorLiteral(embedding),
    model_version: MODEL_VERSION,
    tagged_at: new Date().toISOString(),
  };
  const { error } = await admin
    .from("image_tags")
    .upsert(row, { onConflict: "subject_type,subject_id" });
  if (error) throw new Error(`upsert image_tags failed: ${error.message}`);
}

async function processJob(
  admin: SupabaseClient,
  vision: VisionClient,
  job: TagJob,
): Promise<{ subject_type: SubjectType; subject_id: string; styles: string[] }> {
  if (!job.image_url) throw new Error("job has no image_url");
  const { tags, embedding } = await classify(vision, job.image_url);
  await persist(
    admin,
    job.subject_type,
    job.subject_id,
    job.artist_id,
    job.image_url,
    tags,
    embedding,
  );
  return {
    subject_type: job.subject_type,
    subject_id: job.subject_id,
    styles: tags.styles.map((s) => s.slug),
  };
}

async function drainBatch(
  admin: SupabaseClient,
  vision: VisionClient,
  batchSize: number,
): Promise<{ processed: number; tagged: number; failed: number }> {
  const { data, error } = await admin.rpc("image_tag_jobs_lease", { p_limit: batchSize });
  if (error) throw new Error(`lease failed: ${error.message}`);
  const jobs = (data ?? []) as TagJob[];

  let tagged = 0;
  let failed = 0;
  for (const job of jobs) {
    try {
      await processJob(admin, vision, job);
      await admin.from("image_tag_jobs").update({ status: "done" }).eq("id", job.id);
      tagged += 1;
    } catch (jobErr) {
      failed += 1;
      const message = jobErr instanceof Error ? jobErr.message : "tagging failed";
      // attempts was incremented at lease; re-queue until the cap, then park.
      const capped = job.attempts >= job.max_attempts;
      await admin
        .from("image_tag_jobs")
        .update({ status: capped ? "failed" : "pending", last_error: message.slice(0, 2000) })
        .eq("id", job.id);
      console.error(`tag-image: job ${job.id} failed:`, message);
    }
  }
  return { processed: jobs.length, tagged, failed };
}

// Load a subject row as a synthetic job (for single mode; bypasses the queue).
async function loadSubjectAsJob(
  admin: SupabaseClient,
  subjectType: SubjectType,
  subjectId: string,
): Promise<TagJob | null> {
  const spec: Record<SubjectType, { table: string; imageCol: string }> = {
    portfolio_piece: { table: "portfolio_pieces", imageCol: "image_url" },
    post: { table: "posts", imageCol: "cover_url" },
    flash_item: { table: "flash_items", imageCol: "image_url" },
  };
  const { table, imageCol } = spec[subjectType];
  const { data, error } = await admin
    .from(table)
    .select(`id, artist_id, ${imageCol}`)
    .eq("id", subjectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const imageUrl = (data as Record<string, unknown>)[imageCol] as string | null;
  if (!imageUrl) return null;
  return {
    id: `single:${subjectType}:${subjectId}`,
    subject_type: subjectType,
    subject_id: subjectId,
    artist_id: (data as Record<string, unknown>).artist_id as string | null,
    image_url: imageUrl,
    attempts: 0,
    max_attempts: 1,
  };
}

// ---------------------------------------------------------------------------
interface RequestBody {
  mode?: "batch" | "single" | "inline";
  batch_size?: unknown;
  subject_type?: SubjectType;
  subject_id?: string;
  image_url?: string;
}

async function readBody(req: Request): Promise<RequestBody> {
  try {
    const text = await req.text();
    if (!text) return { mode: "batch" };
    const parsed = JSON.parse(text) as RequestBody;
    return parsed && typeof parsed === "object" ? parsed : { mode: "batch" };
  } catch {
    return { mode: "batch" };
  }
}

function clampBatch(raw: unknown): number {
  const n = typeof raw === "number" ? raw : 5;
  return Math.min(20, Math.max(1, Math.floor(Number.isFinite(n) ? n : 5)));
}
