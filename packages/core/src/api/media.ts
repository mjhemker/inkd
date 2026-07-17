/**
 * Media upload helper against Supabase Storage.
 *
 * Convention (SPEC — wave 2 portfolio/profile build): objects keyed by
 * `{user_id}/{folder}/{uuid}.{ext}`, owner-scoped writes anchored on the first
 * path segment (`storage.foldername(name)[1] = auth.uid()`).
 *
 * Buckets (project khlpidflnvkqafkvkpfy):
 *  - `media-public` (PUBLIC) — avatar / portfolio / posts / flash. Public-facing
 *    profile media served with durable `getPublicUrl()` links to anonymous
 *    discovery visitors. Uploads here.
 *  - `media` (PRIVATE) — chat attachments only (see chatAttachments.ts), served
 *    via short-lived signed URLs, never public.
 *
 * ROOT-CAUSE HISTORY (round 4): public media originally lived in the private
 * `media` bucket with an anon RLS SELECT policy, on the assumption that the
 * policy made avatar/portfolio paths publicly readable. It did not — Supabase's
 * public download endpoint (`/object/public/...`, what `getPublicUrl` returns)
 * keys off the BUCKET's `public` flag, not RLS, so every avatar/portfolio public
 * URL 404'd. The dedicated public bucket (migration 20260718010000) fixes this;
 * chat stays private in `media`.
 *
 * `posts` and `flash` are nested under a `portfolio/` prefix (historical: the old
 * per-path RLS only inspected the second segment). Harmless in the public bucket
 * — kept so existing stored URLs and the path convention stay stable.
 */
import type { InkdSupabaseClient } from "../supabase/client";

/** Private bucket — chat attachments (signed-URL access only). */
export const MEDIA_BUCKET = "media";

/** Public bucket — avatar / portfolio / posts / flash (durable public URLs). */
export const PUBLIC_MEDIA_BUCKET = "media-public";

/** Folders the app organizes uploads into. `posts` and `flash` are stored
 * under a `portfolio/` prefix (see file header) so they land in the bucket's
 * one public-read path segment. */
export type MediaFolder = "avatars" | "posts" | "portfolio" | "flash";

/** Maps a logical folder to the actual storage path segment(s) — must keep
 * `storage.foldername(name)[2]` equal to `avatar` or `portfolio` for the
 * `media_public_read` policy to grant anonymous reads. */
const FOLDER_PATH: Record<MediaFolder, string> = {
  avatars: "avatar",
  portfolio: "portfolio",
  posts: "portfolio/posts",
  flash: "portfolio/flash",
};

export interface UploadableFile {
  /** Raw bytes. A DOM `File`/`Blob` on web, or a `{ uri, name, type }`-derived
   * blob on native (see `@inkd/core` consumers' platform upload wrappers). */
  data: Blob | ArrayBuffer | Uint8Array;
  /** Original filename — used only to infer an extension. */
  name: string;
  /** MIME type, e.g. "image/jpeg". Falls back to octet-stream. */
  contentType?: string;
}

export interface UploadMediaResult {
  /** Storage object path (`{user_id}/{folder}/{uuid}.{ext}`). */
  path: string;
  /** Public URL — valid when the bucket/path is publicly readable. */
  publicUrl: string;
}

function inferExtension(fileName: string, contentType?: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot > -1 && dot < fileName.length - 1) {
    return fileName.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  }
  if (contentType?.includes("/")) {
    return contentType.split("/")[1]!.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  }
  return "bin";
}

function randomId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Upload a file into the `media` bucket under the current user's prefix and
 * return its storage path + public URL. Callers must pass the *owner's*
 * `userId` (RLS/storage policies should reject writes outside that prefix).
 */
export async function uploadMedia(
  client: InkdSupabaseClient,
  userId: string,
  folder: MediaFolder,
  file: UploadableFile,
): Promise<UploadMediaResult> {
  const ext = inferExtension(file.name, file.contentType);
  const path = `${userId}/${FOLDER_PATH[folder]}/${randomId()}.${ext}`;

  const { error } = await client.storage.from(PUBLIC_MEDIA_BUCKET).upload(path, file.data, {
    contentType: file.contentType,
    upsert: false,
  });
  if (error) throw error;

  const { data } = client.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

/** Remove an uploaded public-media object by its storage path. */
export async function deleteMedia(
  client: InkdSupabaseClient,
  path: string,
): Promise<void> {
  const { error } = await client.storage.from(PUBLIC_MEDIA_BUCKET).remove([path]);
  if (error) throw error;
}

/** Best-effort: derive the storage path from a public URL previously
 * returned by `uploadMedia`, so callers can clean up on delete without
 * having to persist the raw path separately. Returns null if it doesn't
 * look like a `media` bucket public URL. */
export function mediaPathFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // Match the current public bucket first, then the legacy `media` public-URL
  // shape (pre-round-4 stored URLs) so old rows still clean up.
  for (const bucket of [PUBLIC_MEDIA_BUCKET, MEDIA_BUCKET]) {
    const marker = `/object/public/${bucket}/`;
    const idx = url.indexOf(marker);
    if (idx !== -1) return decodeURIComponent(url.slice(idx + marker.length));
  }
  return null;
}
