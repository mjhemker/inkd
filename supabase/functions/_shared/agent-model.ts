// The model client. `ModelClient` is the injectable seam: the deployed function
// wires `AnthropicModelClient` (official Messages API over fetch — no SDK needed
// in Deno); tests pass a fake so the whole runtime runs offline.
//
// NOTE (no key yet): AnthropicModelClient reads ANTHROPIC_API_KEY / AGENT_MODEL /
// AGENT_MAX_TOKENS from the environment at call time. Nothing is hard-coded — when
// Michael sets the secret, the same code calls the real API. See
// docs/agents-runtime.md.

import {
  AgentParseError,
  parseAgentOutput,
  type AgentModelOutput,
} from "./agent-contract.ts";

export interface ModelMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ModelRequest {
  system: string;
  messages: ModelMessage[];
}

/** The single method the runtime depends on: prompt in, raw completion text out. */
export interface ModelClient {
  generate(req: ModelRequest): Promise<string>;
}

export const DEFAULT_AGENT_MODEL = "claude-sonnet-4-5";
export const DEFAULT_AGENT_MAX_TOKENS = 1024;

/** Resolve the model + token budget from env, with the documented defaults. */
export function resolveModelConfig(getEnv: (k: string) => string | undefined): {
  model: string;
  maxTokens: number;
} {
  const model = getEnv("AGENT_MODEL")?.trim() || DEFAULT_AGENT_MODEL;
  const raw = getEnv("AGENT_MAX_TOKENS");
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  const maxTokens = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_AGENT_MAX_TOKENS;
  return { model, maxTokens };
}

/** Anthropic Messages API client over fetch (Deno-native, no SDK dependency). */
export class AnthropicModelClient implements ModelClient {
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
    this.model = opts.model ?? DEFAULT_AGENT_MODEL;
    this.maxTokens = opts.maxTokens ?? DEFAULT_AGENT_MAX_TOKENS;
    this.endpoint = opts.endpoint ?? "https://api.anthropic.com/v1/messages";
  }

  async generate(req: ModelRequest): Promise<string> {
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
        system: req.system,
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 500)}`);
    }
    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text = (data.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("");
    if (!text) throw new Error("Anthropic API returned no text content");
    return text;
  }
}

const RETRY_INSTRUCTION =
  "Your previous message was not valid. Respond with ONLY the single JSON object described in the system prompt — no prose, no code fence, no explanation.";

/**
 * Call the model and strictly parse its structured output, retrying ONCE with a
 * corrective follow-up if the first completion fails to parse. Throws the last
 * AgentParseError if the retry also fails (the runner turns that into a
 * flag.handoff so a human sees the conversation).
 */
export async function generateStructured(
  client: ModelClient,
  req: ModelRequest,
): Promise<{ output: AgentModelOutput; raw: string; retried: boolean }> {
  const raw = await client.generate(req);
  try {
    return { output: parseAgentOutput(raw), raw, retried: false };
  } catch (err) {
    if (!(err instanceof AgentParseError)) throw err;
    // One corrective retry, feeding back the bad output.
    const retryReq: ModelRequest = {
      system: req.system,
      messages: [
        ...req.messages,
        { role: "assistant", content: raw },
        { role: "user", content: RETRY_INSTRUCTION },
      ],
    };
    const raw2 = await client.generate(retryReq);
    return { output: parseAgentOutput(raw2), raw: raw2, retried: true };
  }
}
