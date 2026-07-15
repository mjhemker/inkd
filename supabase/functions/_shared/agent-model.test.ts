// Offline tests for generateStructured's strict-JSON-with-one-retry behaviour
// and the env-driven model config. Uses a scripted fake ModelClient — no network.
//   node --test supabase/functions/_shared/agent-model.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_AGENT_MAX_TOKENS,
  DEFAULT_AGENT_MODEL,
  generateStructured,
  resolveModelConfig,
  type ModelClient,
  type ModelRequest,
} from "./agent-model.ts";
import { AgentParseError } from "./agent-contract.ts";

/** A fake that returns each scripted completion in order. */
class ScriptedModel implements ModelClient {
  calls: ModelRequest[] = [];
  private script: string[];
  constructor(script: string[]) {
    this.script = script;
  }
  generate(req: ModelRequest): Promise<string> {
    this.calls.push(req);
    const next = this.script.shift();
    if (next === undefined) throw new Error("ScriptedModel: out of responses");
    return Promise.resolve(next);
  }
}

const GOOD = JSON.stringify({
  action_type: "reply.autosend",
  action_class: "answer_faq",
  reasoning_summary: "Answered from hours.",
  draft_text: "We're open Tuesday to Saturday.",
});

const REQ: ModelRequest = { system: "sys", messages: [{ role: "user", content: "hi" }] };

test("generateStructured: parses a good first completion (no retry)", async () => {
  const model = new ScriptedModel([GOOD]);
  const res = await generateStructured(model, REQ);
  assert.equal(res.retried, false);
  assert.equal(res.output.action_type, "reply.autosend");
  assert.equal(model.calls.length, 1);
});

test("generateStructured: retries once on a bad first completion, then succeeds", async () => {
  const model = new ScriptedModel(["totally not json", GOOD]);
  const res = await generateStructured(model, REQ);
  assert.equal(res.retried, true);
  assert.equal(res.output.action_type, "reply.autosend");
  assert.equal(model.calls.length, 2);
  // The retry must feed back the bad output + a corrective instruction.
  const retryMsgs = model.calls[1].messages;
  assert.equal(retryMsgs[retryMsgs.length - 2].role, "assistant");
  assert.equal(retryMsgs[retryMsgs.length - 1].role, "user");
});

test("generateStructured: throws AgentParseError when the retry also fails", async () => {
  const model = new ScriptedModel(["nope", "still nope"]);
  await assert.rejects(() => generateStructured(model, REQ), AgentParseError);
  assert.equal(model.calls.length, 2);
});

test("resolveModelConfig: defaults when env is empty", () => {
  const cfg = resolveModelConfig(() => undefined);
  assert.equal(cfg.model, DEFAULT_AGENT_MODEL);
  assert.equal(cfg.maxTokens, DEFAULT_AGENT_MAX_TOKENS);
});

test("resolveModelConfig: reads AGENT_MODEL + AGENT_MAX_TOKENS", () => {
  const env: Record<string, string> = {
    AGENT_MODEL: "claude-test-model",
    AGENT_MAX_TOKENS: "2048",
  };
  const cfg = resolveModelConfig((k) => env[k]);
  assert.equal(cfg.model, "claude-test-model");
  assert.equal(cfg.maxTokens, 2048);
});

test("resolveModelConfig: bad AGENT_MAX_TOKENS falls back to default", () => {
  const cfg = resolveModelConfig((k) => (k === "AGENT_MAX_TOKENS" ? "-5" : undefined));
  assert.equal(cfg.maxTokens, DEFAULT_AGENT_MAX_TOKENS);
});
