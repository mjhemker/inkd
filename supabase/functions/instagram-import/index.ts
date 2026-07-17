// POST /functions/v1/instagram-import
//
// Authenticated artist -> pull their IG media (Instagram API with Instagram
// Login, scope instagram_business_basic — see docs/instagram-integration.md)
// and mirror it into INKD as `posts` + `portfolio_pieces`. KEY-GATED: requires
// both IG_* secrets (see _shared/env.ts) AND an existing `instagram_connections`
// row for the caller (created by instagram-oauth's callback).
//
// Idempotent by IG media id — `posts` reuses its existing
// (artist_id, instagram_id) unique index, `portfolio_pieces` gained
// `instagram_media_id` + a matching unique index in this migration. Safe to
// call repeatedly: already-imported media is detected and skipped before any
// download/upload happens.
//
// Capped at a few pages per invocation (Edge Function wall-clock limits) —
// call again to fetch the next batch; nothing duplicates. The mapping logic
// (what to create, what to skip) lives in `_shared/instagram-mapper.ts` and is
// unit-tested offline; this file only does I/O.
import { handlePreflight } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { isInstagramConfigured } from "../_shared/env.ts";
import { AppError, errors, errorResponse, jsonResponse } from "../_shared/errors.ts";
import { fetchInstagramMediaPage, type IgMediaItem } from "../_shared/instagram.ts";
import {
  buildPortfolioPieceInsert,
  filterAlreadyImported,
  inferImageExtension,
  mapInstagramMedia,
} from "../_shared/instagram-mapper.ts";

// Public bucket — IG-imported portfolio pieces are public-facing and served via
// getPublicUrl(), which only resolves for a public bucket (see migration
// 20260718010000_public_media_bucket).
const MEDIA_BUCKET = "media-public";
const MAX_PAGES = 3;
const PAGE_LIMIT = 25;

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    if (req.method !== "POST") throw errors.badRequest("Use POST");
    if (!isInstagramConfigured()) {
      throw errors.badRequest("Instagram isn't configured yet");
    }

    const user = await requireUser(req);
    const admin = getAdminClient();

    const { data: artist, error: artistErr } = await admin
      .from("artist_profiles")
      .select("id, profile_id")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (artistErr) throw errors.server(artistErr.message);
    if (!artist) throw errors.forbidden("Only artists can import from Instagram");

    const { data: connection, error: connErr } = await admin
      .from("instagram_connections")
      .select("access_token")
      .eq("artist_id", artist.id)
      .maybeSingle();
    if (connErr) throw errors.server(connErr.message);
    if (!connection) throw errors.badRequest("Connect Instagram before importing");

    const { data: run, error: runErr } = await admin
      .from("instagram_import_runs")
      .insert({ artist_id: artist.id, status: "running", started_at: new Date().toISOString() })
      .select("id")
      .single();
    if (runErr) throw errors.server(runErr.message);

    try {
      const summary = await runImport(admin, artist, connection.access_token);
      await admin
        .from("instagram_import_runs")
        .update({
          status: "completed",
          media_seen: summary.mediaSeen,
          posts_created: summary.postsCreated,
          pieces_created: summary.piecesCreated,
          media_skipped: summary.mediaSkipped,
          already_imported: summary.alreadyImported,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);
      await admin
        .from("instagram_connections")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("artist_id", artist.id);

      return jsonResponse({ run_id: run.id, status: "completed", ...summary });
    } catch (importErr) {
      const message = importErr instanceof Error ? importErr.message : "Import failed";
      await admin
        .from("instagram_import_runs")
        .update({ status: "failed", error_message: message, completed_at: new Date().toISOString() })
        .eq("id", run.id);
      throw errors.server(message);
    }
  } catch (err) {
    if (!(err instanceof AppError)) console.error("instagram-import:", err);
    return errorResponse(err);
  }
});

interface ImportSummary {
  mediaSeen: number;
  postsCreated: number;
  piecesCreated: number;
  mediaSkipped: number;
  alreadyImported: number;
}

async function runImport(
  admin: ReturnType<typeof getAdminClient>,
  artist: { id: string; profile_id: string },
  accessToken: string,
): Promise<ImportSummary> {
  // 1. Page through the artist's IG media (capped — see file header).
  const allItems: IgMediaItem[] = [];
  let after: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await fetchInstagramMediaPage({ accessToken, after, limit: PAGE_LIMIT });
    allItems.push(...result.data);
    after = result.paging?.cursors?.after;
    if (!after || result.data.length === 0) break;
  }

  // 2. Skip anything already imported (idempotent by IG media id).
  const { data: existingRows, error: existingErr } = await admin
    .from("posts")
    .select("instagram_id")
    .eq("artist_id", artist.id)
    .not("instagram_id", "is", null);
  if (existingErr) throw existingErr;
  const alreadyImportedIds = new Set(
    (existingRows ?? []).map((r) => r.instagram_id as string),
  );
  const newItems = filterAlreadyImported(allItems, alreadyImportedIds);
  const mapped = mapInstagramMedia(newItems);

  const summary: ImportSummary = {
    mediaSeen: allItems.length,
    postsCreated: 0,
    piecesCreated: 0,
    mediaSkipped: 0,
    alreadyImported: allItems.length - newItems.length,
  };

  let sortCursor = 0;
  for (const item of mapped) {
    if (item.skip || !item.sourceImageUrl) {
      summary.mediaSkipped += 1;
      continue;
    }
    try {
      // Download the IG-hosted image and re-host it in our own bucket — IG
      // CDN URLs expire; we need a stable public URL.
      const imgRes = await fetch(item.sourceImageUrl);
      if (!imgRes.ok) {
        summary.mediaSkipped += 1;
        continue;
      }
      const contentType = imgRes.headers.get("content-type");
      const bytes = new Uint8Array(await imgRes.arrayBuffer());
      const ext = inferImageExtension(item.sourceImageUrl, contentType);
      const path = `${artist.profile_id}/portfolio/instagram/${item.mediaId}.${ext}`;

      const { error: uploadErr } = await admin.storage
        .from(MEDIA_BUCKET)
        .upload(path, bytes, {
          contentType: contentType ?? `image/${ext === "jpg" ? "jpeg" : ext}`,
          upsert: true,
        });
      if (uploadErr) throw uploadErr;

      const { data: pub } = admin.storage.from(MEDIA_BUCKET).getPublicUrl(path);
      const imageUrl = pub.publicUrl;

      // find-or-create post (explicit check rather than ON CONFLICT — the
      // backing index is partial (`where instagram_id is not null`), which
      // Postgres won't infer from a bare column-list upsert).
      const { data: existingPost, error: findPostErr } = await admin
        .from("posts")
        .select("id")
        .eq("artist_id", artist.id)
        .eq("instagram_id", item.mediaId)
        .maybeSingle();
      if (findPostErr) throw findPostErr;

      let postId = existingPost?.id as string | undefined;
      if (!postId) {
        const { data: newPost, error: postErr } = await admin
          .from("posts")
          .insert({
            artist_id: artist.id,
            caption: item.post.caption,
            media: [{ url: imageUrl, kind: "image" }],
            cover_url: imageUrl,
            source: "instagram",
            instagram_id: item.mediaId,
            instagram_permalink: item.post.instagram_permalink,
            is_public: true,
          })
          .select("id")
          .single();
        if (postErr) throw postErr;
        postId = newPost.id as string;
        summary.postsCreated += 1;
      }

      // find-or-create the matching portfolio piece.
      const { data: existingPiece, error: findPieceErr } = await admin
        .from("portfolio_pieces")
        .select("id")
        .eq("artist_id", artist.id)
        .eq("instagram_media_id", item.mediaId)
        .maybeSingle();
      if (findPieceErr) throw findPieceErr;

      if (!existingPiece) {
        const pieceInsert = buildPortfolioPieceInsert({
          mediaId: item.mediaId,
          postId,
          imageUrl,
          sortOrder: sortCursor++,
        });
        const { error: pieceErr } = await admin
          .from("portfolio_pieces")
          .insert({ artist_id: artist.id, ...pieceInsert });
        if (pieceErr) throw pieceErr;
        summary.piecesCreated += 1;
      }
    } catch (itemErr) {
      // One bad item never aborts the run — log + count it as skipped.
      console.error(`instagram-import: failed media ${item.mediaId}:`, itemErr);
      summary.mediaSkipped += 1;
    }
  }

  return summary;
}
