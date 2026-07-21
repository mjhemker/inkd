// GET|POST /functions/v1/instagram-media-list   (verify_jwt = true)
//
// Artist-scoped listing of the connected account's media, annotated for the
// import picker UI. Fetches a page of /me/media (cursor `after` pass-through,
// capped at 50 items) and marks each item:
//   - importable:       has a downloadable image (media_url, or a carousel with
//                       >=1 child image, or a video thumbnail_url)
//   - already_imported: posts.instagram_id already exists for this artist
// The access token is NEVER returned to the client.
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
  previewUrl,
  isImportable,
  IG_GRAPH,
  IG_MEDIA_FIELDS,
  type IgMedia,
} from "../_shared/ig-common.ts";

Deno.serve(async (req) => {
  const pf = handlePreflight(req);
  if (pf) return pf;
  try {
    const cfg = igConfig();
    if (!cfg) return notConfigured();

    const user = await requireUser(req);
    const admin = getAdminClient();
    const artistId = await resolveArtistId(admin, user.id);

    const reqUrl = new URL(req.url);
    const body = req.method === "POST" ? await safeJson(req) : null;
    const after = (body?.after as string) ?? reqUrl.searchParams.get("after") ?? null;
    const rawLimit = Number(body?.limit ?? reqUrl.searchParams.get("limit") ?? 25);
    const limit = Math.max(1, Math.min(50, Number.isFinite(rawLimit) ? rawLimit : 25));

    const conn = await getConnection(admin, artistId);

    const mediaUrl = new URL(`${IG_GRAPH}/me/media`);
    mediaUrl.searchParams.set("fields", IG_MEDIA_FIELDS);
    mediaUrl.searchParams.set("limit", String(limit));
    mediaUrl.searchParams.set("access_token", conn.access_token);
    if (after) mediaUrl.searchParams.set("after", after);

    const page = await igGetJson(mediaUrl.toString());
    const items: IgMedia[] = Array.isArray(page?.data) ? page.data : [];

    // Which of these are already imported for this artist?
    const ids = items.map((m) => m.id).filter(Boolean);
    const importedSet = await alreadyImportedSet(admin, artistId, ids);

    const annotated = items.map((m) => ({
      id: m.id,
      caption: m.caption ?? null,
      media_type: m.media_type ?? null,
      permalink: m.permalink ?? null,
      timestamp: m.timestamp ?? null,
      preview_url: previewUrl(m) || null,
      child_count: m.children?.data?.length ?? 0,
      importable: isImportable(m),
      already_imported: importedSet.has(m.id),
    }));

    const nextCursor: string | null = page?.paging?.cursors?.after ?? null;

    return jsonResponse({ items: annotated, next_cursor: nextCursor });
  } catch (err) {
    if (!(err && (err as { name?: string }).name === "AppError")) console.error("instagram-media-list:", err);
    return errorResponse(err);
  }
});

async function getConnection(admin: any, artistId: string): Promise<{ access_token: string }> {
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

async function alreadyImportedSet(admin: any, artistId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data, error } = await admin
    .from("posts")
    .select("instagram_id")
    .eq("artist_id", artistId)
    .in("instagram_id", ids);
  if (error) throw errors.server(error.message);
  return new Set((data ?? []).map((r: { instagram_id: string }) => r.instagram_id));
}

async function safeJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const t = await req.text();
    return t ? (JSON.parse(t) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
