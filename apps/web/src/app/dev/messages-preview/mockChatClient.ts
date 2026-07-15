/**
 * In-memory Supabase client stand-in for the chat-attachments dev harness.
 *
 * This sandbox's egress policy blocks the live Supabase project
 * (khlpidflnvkqafkvkpfy.supabase.co) for outbound browser requests, so real
 * `media` bucket uploads/signed URLs can't be exercised from a screenshot
 * harness here. This mock implements just the `storage.from(bucket)` surface
 * `chatAttachments.ts` calls (`.upload()`, `.createSignedUrl()`,
 * `.createSignedUrls()`) — enough to drive the REAL `Composer` and
 * `MessageBubble` components end-to-end against fake network timing, so their
 * upload-progress / error / signed-URL-render code paths all actually run.
 *
 * Never imported outside `/dev/*`.
 */
import type { InkdSupabaseClient } from "@inkd/core/supabase";

export interface UploadBehavior {
  /** Simulated network latency before resolving. */
  delayMs?: number;
  /** Resolve with a Storage error instead of succeeding. */
  fail?: boolean;
}

/** A small inline placeholder "photo" — a flat-color SVG data URI so
 * thumbnails render without any network access. */
export function placeholderImage(hue: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="hsl(${hue},70%,45%)" />
        <stop offset="100%" stop-color="hsl(${(hue + 40) % 360},70%,30%)" />
      </linearGradient>
    </defs>
    <rect width="400" height="400" fill="url(#g)" />
    <circle cx="200" cy="160" r="60" fill="rgba(255,255,255,0.35)" />
    <rect x="90" y="240" width="220" height="120" rx="16" fill="rgba(255,255,255,0.25)" />
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Builds a mock Supabase client whose `storage.from(bucket).upload()` calls
 * resolve/reject according to `behaviorFor(byteSize)` — the harness page uses
 * this to force deterministic "uploading" / "done" / "error" preview states
 * for the screenshot walkthrough — and whose `createSignedUrl(s)` calls
 * resolve to stable placeholder images keyed by path.
 *
 * Keyed by the uploaded body's byte size, NOT the original filename: the real
 * `uploadChatAttachment` generates a random storage path
 * (`chat/{thread}/{sender}/{uuid}.{ext}`), so the picked file's original name
 * never reaches this mock — only its bytes do. The harness's fixture files are
 * sized distinctly (tiny / medium / large) so this stays deterministic.
 */
export function createMockChatClient(
  behaviorFor: (byteSize: number) => UploadBehavior,
): InkdSupabaseClient {
  const client = {
    storage: {
      from() {
        return {
          async upload(path: string, body: Blob) {
            const behavior = behaviorFor(body?.size ?? 0);
            if (behavior.delayMs) {
              await new Promise((resolve) => setTimeout(resolve, behavior.delayMs));
            }
            if (behavior.fail) {
              return { data: null, error: new Error("Simulated upload failure (mock harness)") };
            }
            return { data: { path, id: path, fullPath: path }, error: null };
          },
          async createSignedUrl(path: string) {
            const hue = hashToHue(path);
            return { data: { signedUrl: placeholderImage(hue), path }, error: null };
          },
          async createSignedUrls(paths: string[]) {
            return {
              data: paths.map((path) => ({
                path,
                signedUrl: placeholderImage(hashToHue(path)),
                error: null,
              })),
              error: null,
            };
          },
        };
      },
    },
  };
  return client as unknown as InkdSupabaseClient;
}

function hashToHue(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}
