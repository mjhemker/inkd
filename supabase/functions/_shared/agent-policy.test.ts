// Offline tests for the deterministic policy engine + grounding validator.
//   node --test supabase/functions/_shared/agent-policy.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  classifyTier,
  decideAction,
  validateGrounding,
  type Autonomy,
} from "./agent-policy.ts";
import type { ActionClass, ActionType, ContextUsedEntry } from "./agent-contract.ts";

// --- tier classification ----------------------------------------------------
test("classifyTier: published-facts reply is tier 1", () => {
  assert.equal(classifyTier("reply.autosend", "answer_faq"), 1);
  assert.equal(classifyTier("reply.draft", "answer_faq"), 1);
  assert.equal(classifyTier("reply.draft", "collect_intake"), 1);
  assert.equal(classifyTier("note.log", "answer_faq"), 1);
});

test("classifyTier: scheduling / quotes are tier 2", () => {
  assert.equal(classifyTier("booking.propose_slots", "propose_slots"), 2);
  assert.equal(classifyTier("reply.draft", "quote_in_range"), 2);
  assert.equal(classifyTier("reply.draft", "reschedule"), 2);
});

test("classifyTier: payments + handoff are tier 3", () => {
  assert.equal(classifyTier("flag.handoff", "answer_faq"), 3);
  assert.equal(classifyTier("reply.draft", "payments"), 3);
  assert.equal(classifyTier("booking.propose_slots", "payments"), 3);
});

// --- the 4 autonomy x 3 tier matrix -----------------------------------------
// Representative action per tier.
const TIER_CASE: Record<1 | 2 | 3, { type: ActionType; cls: ActionClass }> = {
  1: { type: "reply.autosend", cls: "answer_faq" },
  2: { type: "booking.propose_slots", cls: "propose_slots" },
  3: { type: "flag.handoff", cls: "payments" },
};

// Expected decision (execute | propose) with NO overrides + grounded content.
const EXPECTED: Record<Autonomy, Record<1 | 2 | 3, "execute" | "propose">> = {
  no_ai: { 1: "propose", 2: "propose", 3: "propose" },
  draft_only: { 1: "propose", 2: "propose", 3: "propose" },
  assisted: { 1: "execute", 2: "propose", 3: "propose" },
  managed: { 1: "execute", 2: "propose", 3: "propose" },
};

const AUTONOMIES: Autonomy[] = ["no_ai", "draft_only", "assisted", "managed"];
const TIERS: (1 | 2 | 3)[] = [1, 2, 3];

for (const autonomy of AUTONOMIES) {
  for (const tier of TIERS) {
    test(`matrix: ${autonomy} x tier ${tier} -> ${EXPECTED[autonomy][tier]}`, () => {
      const c = TIER_CASE[tier];
      const res = decideAction({
        autonomy,
        actionType: c.type,
        actionClass: c.cls,
        contextUsed: [],
        draftText: c.type === "reply.autosend" ? "Our shop is open Tuesday to Saturday." : undefined,
      });
      assert.equal(res.tier, tier);
      assert.equal(res.decision, EXPECTED[autonomy][tier]);
      assert.equal(res.status, EXPECTED[autonomy][tier] === "execute" ? "executed" : "proposed");
    });
  }
}

// --- overrides --------------------------------------------------------------
test("override 'ask' forces propose even under managed tier 1", () => {
  const res = decideAction({
    autonomy: "managed",
    actionType: "reply.autosend",
    actionClass: "answer_faq",
    overrides: { answer_faq: "ask" },
    contextUsed: [],
    draftText: "Hours are Tuesday to Saturday.",
  });
  assert.equal(res.decision, "propose");
});

test("override 'auto' upgrades a tier-2 slot proposal to execute under draft_only", () => {
  const res = decideAction({
    autonomy: "draft_only",
    actionType: "booking.propose_slots",
    actionClass: "propose_slots",
    overrides: { propose_slots: "auto" },
    contextUsed: [],
  });
  assert.equal(res.tier, 2);
  assert.equal(res.decision, "execute");
});

test("override 'auto' NEVER upgrades tier 3 (payments stay artist-only)", () => {
  const res = decideAction({
    autonomy: "managed",
    actionType: "reply.draft",
    actionClass: "payments",
    overrides: { payments: "auto" },
    contextUsed: [],
    draftText: "Sure, send me your card number.",
  });
  assert.equal(res.tier, 3);
  assert.equal(res.decision, "propose");
});

test("override 'off' proposes the class", () => {
  const res = decideAction({
    autonomy: "assisted",
    actionType: "reply.autosend",
    actionClass: "answer_faq",
    overrides: { answer_faq: "off" },
    contextUsed: [],
    draftText: "We're open Tuesday to Saturday.",
  });
  assert.equal(res.decision, "propose");
});

test("note.log always executes (internal), even under no_ai", () => {
  const res = decideAction({
    autonomy: "no_ai",
    actionType: "note.log",
    actionClass: "answer_faq",
    contextUsed: [],
  });
  assert.equal(res.decision, "execute");
});

// --- grounding validator ----------------------------------------------------
const CTX: ContextUsedEntry[] = [
  { source: "services", detail: "1-hour session: $200.00, $50.00 deposit, 60 min" },
  { source: "availability", detail: "2026-07-20 (10:00–18:00)" },
];

test("grounding: passes when every price + date appears in context", () => {
  const g = validateGrounding(
    "A 1-hour session is $200.00 with a $50.00 deposit. I have 2026-07-20 open.",
    CTX,
  );
  assert.equal(g.grounded, true);
  assert.equal(g.violations.length, 0);
});

test("grounding: catches an invented price", () => {
  const g = validateGrounding("That'll be $999.00.", CTX);
  assert.equal(g.grounded, false);
  assert.equal(g.violations.some((v) => v.kind === "money" && v.token === "$999.00"), true);
});

test("grounding: catches an invented date", () => {
  const g = validateGrounding("How about 2026-12-31?", CTX);
  assert.equal(g.grounded, false);
  assert.equal(g.violations.some((v) => v.kind === "datetime"), true);
});

test("grounding: no draft text is vacuously grounded", () => {
  const g = validateGrounding(undefined, CTX);
  assert.equal(g.grounded, true);
});

test("decideAction: ungrounded draft downgrades execute -> propose", () => {
  const res = decideAction({
    autonomy: "assisted",
    actionType: "reply.autosend",
    actionClass: "answer_faq",
    contextUsed: CTX,
    draftText: "It's only $5.00 today!", // $5.00 not in context
  });
  assert.equal(res.tier, 1);
  assert.equal(res.decision, "propose");
  assert.equal(res.grounding.grounded, false);
  assert.ok(res.reasons.some((r) => r.includes("grounding")));
});
