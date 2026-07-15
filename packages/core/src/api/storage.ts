/**
 * Data access: the private `media` Storage bucket (avatars, portfolio images,
 * misc studio media). See migration 20260715105500_media_storage_bucket.
 *
 * Path convention (enforced by RLS): `{user_id}/{category}/{file}`. Every object
 * lives under the owner's uid folder; avatar + portfolio paths are additionally
 * world-readable. Writes are always owner-scoped.
 *
 * The bucket is private, so reads go through signed URLs. Callers persist the
 * returned `url` (a long-lived signed URL) into `profiles.avatar_url` /
 * `portfolio_pieces.image_url`. Use `createMediaSignedUrl` to re-sign later.
 */
import type { InkdSupabaseClient } from "../supabase/client";

export const MEDIA_BUCKET = "media";

/** How images are foldered under a user. Avatar + portfolio are public-readable. */
export type MediaCategory = "avatar" | "portfolio" | "misc";

/** Default signed-URL lifetime: 1 year (pilot-grade; re-sign on demand later). */
export const MEDIA_URL_TTL_SECONDS = 60 * 60 * 24 * 365;

/** Anything the Supabase Storage client accepts as an upload body. */
export type UploadBody = Blob | ArrayBuffer | ArrayBufferView | File | FormData;

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

/** Collision-resistant object id without a crypto.randomUUID dependency (Hermes-safe). */
function objectId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rand}`;
}

function extFor(contentType: string | undefined, fallbackName?: string): string {
  if (contentType && EXT_BY_TYPE[contentType]) return EXT_BY_TYPE[contentType];
  const fromName = fallbackName?.split(".").pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  return "jpg";
}

export interface UploadMediaParams {
  /** The owner's auth user id — folder root, enforced by RLS. */
  userId: string;
  category: MediaCategory;
  body: UploadBody;
  /** MIME type, e.g. "image/png". Used for the object metadata + extension. */
  contentType?: string;
  /** Original filename, used only to guess an extension if contentType is absent. */
  fileName?: string;
  /** Overwrite an existing object at the generated path (default false). */
  upsert?: boolean;
  /** Signed-URL lifetime for the returned `url`. Defaults to 1 year. */
  signedUrlTtl?: number;
}

export interface UploadedMedia {
  /** The storage object path, e.g. "<uid>/portfolio/abc.jpg". */
  path: string;
  /** A signed, directly-renderable URL for the object. */
  url: string;
}

/**
 * Upload an image to the media bucket under `{userId}/{category}/{id}.{ext}` and
 * return the object path plus a long-lived signed URL ready to persist/render.
 */
export async function uploadMedia(
  client: InkdSupabaseClient,
  params: UploadMediaParams,
): Promise<UploadedMedia> {
  const { userId, category, body, contentType, fileName, upsert, signedUrlTtl } =
    params;
  const ext = extFor(contentType, fileName);
  const path = `${userId}/${category}/${objectId()}.${ext}`;

  const { error } = await client.storage
    .from(MEDIA_BUCKET)
    .upload(path, body, {
      contentType: contentType ?? undefined,
      upsert: upsert ?? false,
    });
  if (error) throw error;

  const url = await createMediaSignedUrl(
    client,
    path,
    signedUrlTtl ?? MEDIA_URL_TTL_SECONDS,
  );
  return { path, url };
}

/** Create a fresh signed URL for a stored object path. */
export async function createMediaSignedUrl(
  client: InkdSupabaseClient,
  path: string,
  expiresIn: number = MEDIA_URL_TTL_SECONDS,
): Promise<string> {
  const { data, error } = await client.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

/** Delete one or more objects from the media bucket (owner-scoped by RLS). */
export async function removeMedia(
  client: InkdSupabaseClient,
  paths: string | string[],
): Promise<void> {
  const list = Array.isArray(paths) ? paths : [paths];
  if (list.length === 0) return;
  const { error } = await client.storage.from(MEDIA_BUCKET).remove(list);
  if (error) throw error;
}
