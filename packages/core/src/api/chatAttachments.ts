/**
 * Chat image attachments: upload into the shared `media` bucket under a
 * `chat/{thread_id}/{sender_id}/{uuid}.{ext}` path, plus signed-URL
 * resolution for rendering (SPEC §4 in-app chat).
 *
 * The `media` bucket is private; unlike avatar/portfolio paths, chat
 * attachments are NOT publicly readable — only the two thread participants
 * can read them (see migration 20260716010000_chat_attachments_storage.sql).
 * Callers must always resolve a signed URL before rendering an attachment;
 * never persist or reuse a signed URL past its `expiresIn` window.
 *
 * `sender_id` (the third path segment) is always the uploader's own
 * `auth.uid()` — which is `profiles.id` for a client sender AND for an
 * artist sender (an artist's `artist_profiles.id` is a different id; the
 * storage policy anchors on the auth uid, same identity either way).
 */
import type { InkdSupabaseClient } from "../supabase/client";
import { MEDIA_BUCKET } from "./media";

export type ChatAttachmentKind = "image";

/** Persisted shape of one entry in `messages.attachments` (jsonb array). */
export interface ChatAttachment {
  /** Storage object path within the `media` bucket. */
  path: string;
  kind: ChatAttachmentKind;
  width?: number;
  height?: number;
}

type UploadBody = Blob | ArrayBuffer | ArrayBufferView;

function randomId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function inferExtension(fileName: string, contentType?: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot > -1 && dot < fileName.length - 1) {
    return fileName.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  }
  if (contentType?.includes("/")) {
    return contentType.split("/")[1]!.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  }
  return "jpg";
}

export interface UploadChatAttachmentArgs {
  threadId: string;
  /** The uploader's own auth uid (`profiles.id`). Must match the storage
   * policy's "own sender folder" check — pass the CURRENT viewer's id, never
   * the counterpart's. */
  senderId: string;
  file: UploadBody;
  filename: string;
  contentType?: string;
  /** Pixel dimensions, when known (e.g. from `resizeImageForUpload`). */
  width?: number;
  height?: number;
}

/** Upload one image into a thread's `chat/` attachment folder and return
 * persistable metadata for `sendMessage`'s `attachments` field. */
export async function uploadChatAttachment(
  client: InkdSupabaseClient,
  args: UploadChatAttachmentArgs,
): Promise<ChatAttachment> {
  const ext = inferExtension(args.filename, args.contentType);
  const path = `chat/${args.threadId}/${args.senderId}/${randomId()}.${ext}`;
  const { error } = await client.storage.from(MEDIA_BUCKET).upload(path, args.file, {
    contentType: args.contentType,
    upsert: false,
  });
  if (error) throw error;
  return {
    path,
    kind: "image",
    ...(args.width ? { width: args.width } : {}),
    ...(args.height ? { height: args.height } : {}),
  };
}

/** Signed, time-limited URL for a private chat attachment (for rendering). */
export async function getChatAttachmentUrl(
  client: InkdSupabaseClient,
  path: string,
  expiresIn = 3600,
): Promise<string | null> {
  const { data, error } = await client.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Signed URLs for many attachment paths at once (a message with several
 * images, or a bubble list rendering pass). */
export async function getChatAttachmentUrls(
  client: InkdSupabaseClient,
  paths: string[],
  expiresIn = 3600,
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await client.storage
    .from(MEDIA_BUCKET)
    .createSignedUrls(paths, expiresIn);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  for (const row of data) {
    if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
  }
  return out;
}

/** Reads a `messages.attachments` jsonb value into typed metadata,
 * discarding anything malformed rather than throwing. */
export function toChatAttachments(value: unknown): ChatAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is ChatAttachment =>
      typeof v === "object" && v != null && typeof (v as { path?: unknown }).path === "string",
  );
}

// --- web-only resize helper -------------------------------------------------
export interface ResizedImage {
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Downscale an image Blob/File to a max dimension (default 1600px, matching
 * SPEC's "trivial resize" guidance) before upload, using `createImageBitmap`
 * + an offscreen canvas. Browser-only: on platforms without `document` (React
 * Native) this resolves to the original blob with `width`/`height` set to 0 —
 * mobile callers should skip calling this and upload the picked asset as-is
 * (Expo's image picker already downsamples reasonably).
 *
 * Images already at/under `maxDimension` are returned unresized (and
 * unrecompressed) to avoid a pointless quality hit.
 */
export async function resizeImageForUpload(
  file: Blob,
  maxDimension = 1600,
  quality = 0.85,
): Promise<ResizedImage> {
  if (
    typeof document === "undefined" ||
    typeof createImageBitmap === "undefined"
  ) {
    return { blob: file, width: 0, height: 0 };
  }

  const bitmap = await createImageBitmap(file);
  try {
    const longEdge = Math.max(bitmap.width, bitmap.height);
    if (longEdge <= maxDimension) {
      return { blob: file, width: bitmap.width, height: bitmap.height };
    }

    const scale = maxDimension / longEdge;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { blob: file, width: bitmap.width, height: bitmap.height };
    ctx.drawImage(bitmap, 0, 0, width, height);

    const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const resized = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outputType, quality),
    );
    if (!resized) return { blob: file, width: bitmap.width, height: bitmap.height };
    return { blob: resized, width, height };
  } finally {
    bitmap.close?.();
  }
}
