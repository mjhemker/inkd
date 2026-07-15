// Offline tests for the contract parser + dedupe key.
//   node --test supabase/functions/_shared/agent-contract.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  AgentParseError,
  dedupeKeyFor,
  extractJsonObject,
  parseAgentOutput,
} from "./agent-contract.ts";

test("parseAgentOutput: valid reply", () => {
  const out = parseAgentOutput(
    JSON.stringify({
      action_type: "reply.autosend",
      action_class: "answer_faq",
      reasoning_summary: "Answered from published hours.",
      draft_text: "We're open Tuesday to Saturday.",
    }),
  );
  assert.equal(out.action_type, "reply.autosend");
  assert.equal(out.action_class, "answer_faq");
  assert.equal(out.draft_text, "We're open Tuesday to Saturday.");
});

test("extractJsonObject: strips a ```json fence and prose", () => {
  const raw = 'Sure!\n```json\n{"a":1}\n```\nHope that helps.';
  assert.equal(extractJsonObject(raw), '{"a":1}');
});

test("parseAgentOutput: tolerates fence + surrounding prose", () => {
  const raw =
    'Here you go:\n```json\n{"action_type":"note.log","action_class":"answer_faq","reasoning_summary":"Logged."}\n```';
  const out = parseAgentOutput(raw);
  assert.equal(out.action_type, "note.log");
});

test("parseAgentOutput: propose_slots parses slots", () => {
  const out = parseAgentOutput(
    JSON.stringify({
      action_type: "booking.propose_slots",
      action_class: "propose_slots",
      reasoning_summary: "Offered openings.",
      proposed_slots: [{ starts_at: "2026-07-20T10:00:00Z", ends_at: "2026-07-20T11:00:00Z" }],
    }),
  );
  assert.equal(out.proposed_slots?.length, 1);
});

test("parseAgentOutput: rejects an unknown action_type", () => {
  assert.throws(
    () =>
      parseAgentOutput(
        JSON.stringify({ action_type: "reply.yolo", action_class: "answer_faq", reasoning_summary: "x" }),
      ),
    AgentParseError,
  );
});

test("parseAgentOutput: rejects an unknown action_class", () => {
  assert.throws(
    () =>
      parseAgentOutput(
        JSON.stringify({ action_type: "note.log", action_class: "vibes", reasoning_summary: "x" }),
      ),
    AgentParseError,
  );
});

test("parseAgentOutput: reply without draft_text is invalid", () => {
  assert.throws(
    () =>
      parseAgentOutput(
        JSON.stringify({
          action_type: "reply.draft",
          action_class: "answer_faq",
          reasoning_summary: "x",
        }),
      ),
    AgentParseError,
  );
});

test("parseAgentOutput: propose_slots without slots is invalid", () => {
  assert.throws(
    () =>
      parseAgentOutput(
        JSON.stringify({
          action_type: "booking.propose_slots",
          action_class: "propose_slots",
          reasoning_summary: "x",
        }),
      ),
    AgentParseError,
  );
});

test("parseAgentOutput: non-JSON throws AgentParseError", () => {
  assert.throws(() => parseAgentOutput("not json at all"), AgentParseError);
});

test("parseAgentOutput: empty reasoning_summary is invalid", () => {
  assert.throws(
    () =>
      parseAgentOutput(
        JSON.stringify({
          action_type: "note.log",
          action_class: "answer_faq",
          reasoning_summary: "  ",
        }),
      ),
    AgentParseError,
  );
});

test("dedupeKeyFor mirrors the SQL enqueue triggers", () => {
  assert.equal(dedupeKeyFor("message", "abc"), "message:abc");
  assert.equal(dedupeKeyFor("booking_request", "xyz"), "booking_request:xyz");
});
