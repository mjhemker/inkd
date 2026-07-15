/**
 * Media upload helper against Supabase Storage.
 *
 * Convention (SPEC — wave 2 portfolio/profile build): a single private
 * `media` bucket, objects keyed by `{user_id}/{folder}/{uuid}.{ext}`, with
 * storage policies granting public read on portfolio/avatar paths
 * (owner-only write everywhere else).
 *
 * Bucket confirmed against the merged media_storage_bucket migration and the
 * live `media` bucket (project khlpidflnvkqafkvkpfy,
 * created by the onboarding agent's parallel branch): the bucket is private,
 * writes are owner-scoped by the first path segment (`storage.foldername(name)[1]
 * = auth.uid()`), and `media_public_read` only grants anonymous SELECT when the
 * *second* path segment is exactly `avatar` or `portfolio` — no public-read grant
 * exists for `posts`/`flash`. Since the policy only inspects that one segment (not
 * the full depth), `posts` and `flash` uploads are nested under a `portfolio/`
 * prefix below so every public-facing folder round-trips through a working public
 * URL without needing a migration change.
 */
import type { InkdSupabaseClient } from "../supabase/client";

export const MEDIA_BUCKET = "media";

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

  const { error } = await client.storage.from(MEDIA_BUCKET).upload(path, file.data, {
    contentType: file.contentType,
    upsert: false,
  });
  if (error) throw error;

  const { data } = client.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

/** Remove an uploaded object by its storage path. */
export async function deleteMedia(
  client: InkdSupabaseClient,
  path: string,
): Promise<void> {
  const { error } = await client.storage.from(MEDIA_BUCKET).remove([path]);
  if (error) throw error;
}

/** Best-effort: derive the storage path from a public URL previously
 * returned by `uploadMedia`, so callers can clean up on delete without
 * having to persist the raw path separately. Returns null if it doesn't
 * look like a `media` bucket public URL. */
export function mediaPathFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/object/public/${MEDIA_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}
