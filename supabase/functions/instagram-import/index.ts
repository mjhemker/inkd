// POST /functions/v1/instagram-import   (verify_jwt = true)
//
// Imports selected Instagram media into the artist's INKD portfolio.
// Body: { media_ids: string[] }  (capped at 50 per run).
//
// For each id we RE-FETCH the media fresh (Instagram CDN URLs are ephemeral),
// skip + count if it's already imported (posts.instagram_id dedupe) or
// unimportable (no media_url / copyright-flagged), download the image bytes into
// the `media-public` bucket (VIDEO -> use thumbnail_url as the still image), then
// create:
//   - one `posts` row  (source='instagram', instagram_id, instagram_permalink,
//     caption, media=[{url},...], cover_url)   -- carousels put every child image
//     in the media[] array (posts support multi-image), cover_url = first child.
//   - one `portfolio_pieces` row (post_id, instagram_media_id, image_url = cover,
//     title from caption, description = caption).
//
// Progress is tracked in an `instagram_import_runs` row (running -> completed |
// failed). The run row is returned.
import {
  handlePreflight,
  requireUser,
  getAdminClient,
  resolveArtistId,
  igConfig,
  notConfigured,
  jsonResponse,
  errorResponse,
  errors,
  igGetJson,
  imageUrlsFor,
  downloadToPublicBucket,
  IG_GRAPH,
  IG_MEDIA_FIELDS,
  type IgMedia,
  type SupabaseClient,
} from "../_shared/ig-common.ts";

Deno.serve(async (req) => {
  const pf = handlePreflight(req);
  if (pf) return pf;
  try {
    if (req.method !== "POST") throw errors.badRequest("Use POST");

    const cfg = igConfig();
    if (!cfg) return notConfigured();

    const user = await requireUser(req);
    const admin = getAdminClient();
    const artistId = await resolveArtistId(admin, user.id);

    const body = await safeJson(req);
    const rawIds = Array.isArray(body?.media_ids) ? (body!.media_ids as unknown[]) : [];
    const mediaIds = Array.from(
      new Set(rawIds.filter((v): v is string => typeof v === "string" && v !== "")),
    ).slice(0, 50);
    if (mediaIds.length === 0) throw errors.badRequest("media_ids must be a non-empty array");

    const conn = await getConnection(admin, artistId);

    // Create the run row (status running).
    const startedAt = new Date().toISOString();
    const { data: run, error: runErr } = await admin
      .from("instagram_import_runs")
      .insert({ artist_id: artistId, status: "running", started_at: startedAt })
      .select("*")
      .single();
    if (runErr) throw errors.server(`Could not create import run: ${runErr.message}`);

    const counters = {
      media_seen: 0,
      posts_created: 0,
      pieces_created: 0,
      media_skipped: 0,
      already_imported: 0,
    };

    // Next sort_order for portfolio pieces (append to the artist's existing set).
    let nextSort = await maxSortOrder(admin, artistId);

    try {
      for (const id of mediaIds) {
        counters.media_seen += 1;

        // Re-fetch this media fresh (ephemeral CDN URLs).
        let media: IgMedia;
        try {
          const url = new URL(`${IG_GRAPH}/${id}`);
          url.searchParams.set("fields", IG_MEDIA_FIELDS);
          url.searchParams.set("access_token", conn.access_token);
          media = await igGetJson(url.toString());
        } catch (_e) {
          counters.media_skipped += 1;
          continue;
        }
        if (!media?.id) {
          counters.media_skipped += 1;
          continue;
        }

        // Dedupe: already imported for this artist?
        if (await isAlreadyImported(admin, artistId, media.id)) {
          counters.already_imported += 1;
          continue;
        }

        // Importability: needs at least one downloadable image.
        const sourceUrls = imageUrlsFor(media);
        if (sourceUrls.length === 0) {
          counters.media_skipped += 1;
          continue;
        }

        // Download every image into the public bucket.
        const storedUrls: string[] = [];
        for (const src of sourceUrls) {
          try {
            storedUrls.push(await downloadToPublicBucket(admin, artistId, src));
          } catch (_e) {
            // Skip an individual bad image but keep the rest of the item.
          }
        }
        if (storedUrls.length === 0) {
          counters.media_skipped += 1;
          continue;
        }

        const caption = media.caption ?? null;
        const coverUrl = storedUrls[0];

        // posts row
        const { data: post, error: postErr } = await admin
          .from("posts")
          .insert({
            artist_id: artistId,
            caption,
            media: storedUrls.map((u) => ({ url: u })),
            cover_url: coverUrl,
            source: "instagram",
            instagram_id: media.id,
            instagram_permalink: media.permalink ?? null,
            is_public: true,
          })
          .select("id")
          .single();
        if (postErr) {
          // Unique-violation (race) => treat as already imported, else skip.
          if ((postErr as { code?: string }).code === "23505") counters.already_imported += 1;
          else counters.media_skipped += 1;
          continue;
        }
        counters.posts_created += 1;

        // portfolio_pieces row (single cover image)
        const { error: pieceErr } = await admin.from("portfolio_pieces").insert({
          artist_id: artistId,
          post_id: post.id,
          title: titleFromCaption(caption),
          description: caption,
          image_url: coverUrl,
          style_tags: [],
          is_public: true,
          sort_order: nextSort,
          instagram_media_id: media.id,
        });
        if (!pieceErr) {
          counters.pieces_created += 1;
          nextSort += 1;
        }
      }

      const completedAt = new Date().toISOString();
      const { data: finalRun, error: finErr } = await admin
        .from("instagram_import_runs")
        .update({ status: "completed", completed_at: completedAt, ...counters })
        .eq("id", run.id)
        .select("*")
        .single();
      if (finErr) throw errors.server(finErr.message);

      // Touch last_synced_at on the connection.
      await admin
        .from("instagram_connections")
        .update({ last_synced_at: completedAt })
        .eq("artist_id", artistId);

      return jsonResponse({ run: finalRun });
    } catch (loopErr) {
      const message = loopErr instanceof Error ? loopErr.message : "import failed";
      await admin
        .from("instagram_import_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: message.slice(0, 500),
          ...counters,
        })
        .eq("id", run.id);
      throw errors.server(message);
    }
  } catch (err) {
    if (!(err && (err as { name?: string }).name === "AppError")) console.error("instagram-import:", err);
    return errorResponse(err);
  }
});

async function getConnection(admin: SupabaseClient, artistId: string): Promise<{ access_token: string }> {
  const { data, error } = await admin
    .from("instagram_connections")
    .select("access_token, token_expires_at")
    .eq("artist_id", artistId)
    .maybeSingle();
  if (error) throw errors.server(error.message);
  if (!data) throw errors.notFound("No Instagram account connected");
  if (data.token_expires_at && new Date(data.token_expires_at).getTime() < Date.now()) {
    throw errors.conflict("Instagram token expired — reconnect required");
  }
  return { access_token: data.access_token as string };
}

async function isAlreadyImported(admin: SupabaseClient, artistId: string, mediaId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("posts")
    .select("id")
    .eq("artist_id", artistId)
    .eq("instagram_id", mediaId)
    .maybeSingle();
  if (error) throw errors.server(error.message);
  return !!data;
}

async function maxSortOrder(admin: SupabaseClient, artistId: string): Promise<number> {
  const { data, error } = await admin
    .from("portfolio_pieces")
    .select("sort_order")
    .eq("artist_id", artistId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw errors.server(error.message);
  return data ? Number(data.sort_order) + 1 : 0;
}

function titleFromCaption(caption: string | null): string | null {
  if (!caption) return null;
  const firstLine = caption.split("\n")[0].trim();
  if (firstLine === "") return null;
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
}

async function safeJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const t = await req.text();
    return t ? (JSON.parse(t) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
