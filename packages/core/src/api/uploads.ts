/**
 * Reference-upload helpers for the booking intake flow. Files live in the
 * private `booking-uploads` bucket under `<client_id>/<batch_id>/<filename>`
 * (see migration 20260715110000). RLS lets the owning client read/write their
 * folder and the target artist read once a request links them.
 *
 * Platform-neutral: pass any body Supabase Storage accepts (a web `File`/`Blob`,
 * an `ArrayBuffer`, or a typed array from Expo). Private objects are served via
 * short-lived signed URLs.
 */
import type { InkdSupabaseClient } from "../supabase/client";

export const BOOKING_UPLOADS_BUCKET = "booking-uploads";

/** Metadata persisted into `booking_requests.reference_uploads` (jsonb array). */
export interface ReferenceUpload {
  /** Storage object path within the bucket. */
  path: string;
  /** Original filename, for display. */
  name: string;
  /** Bytes, when known. */
  size?: number;
  /** MIME type, when known. */
  content_type?: string;
  /** "image" | "document" — drives the gallery vs. file-chip rendering. */
  kind: "image" | "document";
}

type UploadBody = Blob | ArrayBuffer | ArrayBufferView;

/** A collision-resistant id for grouping one request's uploads into a folder. */
export function newUploadBatchId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Strip a filename to a storage-safe token, preserving the extension. */
function safeName(name: string): string {
  const cleaned = name.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_");
  return cleaned.slice(-120) || "file";
}

function kindFor(contentType?: string, name?: string): "image" | "document" {
  if (contentType?.startsWith("image/")) return "image";
  if (name && /\.(png|jpe?g|gif|webp|heic|heif|avif)$/i.test(name)) return "image";
  return "document";
}

export interface UploadReferenceArgs {
  clientId: string;
  batchId: string;
  file: UploadBody;
  filename: string;
  contentType?: string;
  size?: number;
}

/** Upload a single reference file and return its persistable metadata. */
export async function uploadBookingReference(
  client: InkdSupabaseClient,
  args: UploadReferenceArgs,
): Promise<ReferenceUpload> {
  const name = safeName(args.filename);
  const path = `${args.clientId}/${args.batchId}/${Date.now()}_${name}`;
  const { error } = await client.storage
    .from(BOOKING_UPLOADS_BUCKET)
    .upload(path, args.file, {
      contentType: args.contentType,
      upsert: false,
    });
  if (error) throw error;
  return {
    path,
    name: args.filename,
    size: args.size,
    content_type: args.contentType,
    kind: kindFor(args.contentType, args.filename),
  };
}

/** Signed, time-limited URL for a private reference object (for display). */
export async function getBookingReferenceUrl(
  client: InkdSupabaseClient,
  path: string,
  expiresIn = 3600,
): Promise<string | null> {
  const { data, error } = await client.storage
    .from(BOOKING_UPLOADS_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Signed URLs for many objects at once (references gallery). */
export async function getBookingReferenceUrls(
  client: InkdSupabaseClient,
  paths: string[],
  expiresIn = 3600,
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await client.storage
    .from(BOOKING_UPLOADS_BUCKET)
    .createSignedUrls(paths, expiresIn);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  for (const row of data) {
    if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
  }
  return out;
}

/** Remove an uploaded reference (client dropping a file before submit). */
export async function removeBookingReference(
  client: InkdSupabaseClient,
  path: string,
): Promise<void> {
  const { error } = await client.storage
    .from(BOOKING_UPLOADS_BUCKET)
    .remove([path]);
  if (error) throw error;
}
