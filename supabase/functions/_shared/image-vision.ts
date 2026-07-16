// Anthropic Vision client for the tag-image function. Fetches an image, sends it
// to Claude with the INKD classifier prompt (image-tagging.ts), and returns the
// raw model text (parsed downstream by tagsFromVisionResponse).
//
// Mirrors _shared/agent-model.ts: official Messages API over fetch (no SDK in
// Deno), reads ANTHROPIC_API_KEY / TAG_MODEL from the env at call time. REUSES
// the SAME ANTHROPIC_API_KEY as the agent runtime — no new key for the founder.
//
// The image is fetched server-side and sent as base64 (works for our private
// `media` bucket signed/public URLs and IG-rehosted URLs alike). If the image
// host is unreachable (sandbox egress blocked), fetchImageAsBase64 throws a
// clear error the caller turns into a per-job failure (re-queued/retried).

import { buildVisionSystemPrompt } from "./image-tagging.ts";

export const DEFAULT_TAG_MODEL = "claude-sonnet-4-5";
export const DEFAULT_TAG_MAX_TOKENS = 700;

const ALLOWED_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export interface VisionClient {
  classify(imageUrl: string): Promise<string>;
}

export function resolveTagModelConfig(getEnv: (k: string) => string | undefined): {
  model: string;
  maxTokens: number;
} {
  const model = getEnv("TAG_MODEL")?.trim() || getEnv("AGENT_MODEL")?.trim() ||
    DEFAULT_TAG_MODEL;
  const raw = getEnv("TAG_MAX_TOKENS");
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  const maxTokens = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TAG_MAX_TOKENS;
  return { model, maxTokens };
}

/** Download an image and return its base64 body + normalized media type. */
export async function fetchImageAsBase64(
  url: string,
): Promise<{ data: string; mediaType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`image fetch ${res.status} for ${url.slice(0, 120)}`);
  let mediaType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
    // Fall back to the extension; Anthropic needs a supported image media type.
    if (/\.png(\?|$)/i.test(url)) mediaType = "image/png";
    else if (/\.webp(\?|$)/i.test(url)) mediaType = "image/webp";
    else if (/\.gif(\?|$)/i.test(url)) mediaType = "image/gif";
    else mediaType = "image/jpeg";
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  // base64 in chunks to avoid call-stack limits on large images.
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    binary += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return { data: btoa(binary), mediaType };
}

export class AnthropicVisionClient implements VisionClient {
  private apiKey: string;
  private model: string;
  private maxTokens: number;
  private endpoint: string;

  constructor(opts: {
    apiKey: string;
    model?: string;
    maxTokens?: number;
    endpoint?: string;
  }) {
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? DEFAULT_TAG_MODEL;
    this.maxTokens = opts.maxTokens ?? DEFAULT_TAG_MAX_TOKENS;
    this.endpoint = opts.endpoint ?? "https://api.anthropic.com/v1/messages";
  }

  async classify(imageUrl: string): Promise<string> {
    const { data, mediaType } = await fetchImageAsBase64(imageUrl);
    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        system: buildVisionSystemPrompt(),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data },
              },
              { type: "text", text: "Classify this tattoo. Respond with only the JSON object." },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Anthropic Vision ${res.status}: ${text.slice(0, 400)}`);
    }
    const body = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (body.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("");
    if (!text) throw new Error("Anthropic Vision returned no text content");
    return text;
  }
}
