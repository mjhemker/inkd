// The DETERMINISTIC policy engine (SPEC §5) — NOT the model. It maps every
// action to a tier, applies the artist's autonomy + per-action-class overrides
// to decide execute-now vs propose, and grounds the draft against the context
// the tools actually returned. The LLM cannot bypass any of this: tier and the
// execute/propose decision are computed here from the labeled action, never
// taken from the model's word.
//
// Pure + dependency-free (erasable TypeScript) → runs under Deno and node --test.

import type {
  ActionClass,
  ActionType,
  ContextUsedEntry,
  Tier,
} from "./agent-contract.ts";

/** The four autonomy levels (agent_settings.autonomy). */
export type Autonomy = "no_ai" | "draft_only" | "assisted" | "managed";

/** Per-action-class override values (agent_settings.action_class_overrides jsonb).
 *  `auto` forces execute where the tier allows; `ask` forces propose; `off`
 *  disables the class (the runtime hands it to the artist). */
export type ActionOverride = "auto" | "ask" | "off";

/** The decision the engine hands back to the runner. */
export type PolicyDecision = "execute" | "propose";

export interface PolicyInput {
  autonomy: Autonomy;
  actionType: ActionType;
  actionClass: ActionClass;
  /** agent_settings.action_class_overrides — { [actionClass]: 'auto'|'ask'|'off' }. */
  overrides?: Record<string, string> | null;
  /** The proposed client-facing text, for grounding (undefined for note.log). */
  draftText?: string;
  /** Everything the tools surfaced — grounding is checked against these details. */
  contextUsed: ContextUsedEntry[];
}

export interface GroundingViolation {
  /** The literal token (a $ amount or a date/time) not found in any context. */
  token: string;
  kind: "money" | "datetime";
}

export interface GroundingResult {
  grounded: boolean;
  violations: GroundingViolation[];
}

export interface PolicyResult {
  tier: Tier;
  decision: PolicyDecision;
  /** Final persisted status: 'executed' when decision resolves to execute AND
   *  grounding passes; otherwise 'proposed'. */
  status: "executed" | "proposed";
  grounding: GroundingResult;
  /** Plain-language reasons that shaped the decision (audit-friendly). */
  reasons: string[];
}

// ---------------------------------------------------------------------------
// 1. Tier classification. action_type is primary; action_class refines a
//    generic draft (a reply that quotes a price or commits a time is tier 2).
//    Hard rule: payments/refunds/verification/external + any handoff are tier 3.
// ---------------------------------------------------------------------------

/** Action classes that inherently commit scheduling or money → tier 2. */
const TIER2_CLASSES: ReadonlySet<ActionClass> = new Set<ActionClass>([
  "propose_slots",
  "quote_in_range",
  "reschedule",
]);

/** Action classes that are always artist-only → tier 3. */
const TIER3_CLASSES: ReadonlySet<ActionClass> = new Set<ActionClass>(["payments"]);

export function classifyTier(
  actionType: ActionType,
  actionClass: ActionClass,
): Tier {
  // Escalations are always artist-only.
  if (actionType === "flag.handoff") return 3;
  // Payments/refunds/verification/external — always tier 3, regardless of how
  // the action is otherwise shaped.
  if (TIER3_CLASSES.has(actionClass)) return 3;
  // Slot proposals are a scheduling commitment.
  if (actionType === "booking.propose_slots") return 2;
  // A reply that carries a scheduling/quote class is tier 2; a plain published-
  // facts reply is tier 1.
  if (actionType === "reply.draft" || actionType === "reply.autosend") {
    return TIER2_CLASSES.has(actionClass) ? 2 : 1;
  }
  // note.log is internal bookkeeping.
  return 1;
}

// ---------------------------------------------------------------------------
// 2. Grounding validator. Every $ amount and every date/time mentioned in the
//    draft must appear verbatim (normalized) in some context_used detail. A
//    violation downgrades an execute to a proposed, with the reason flagged.
// ---------------------------------------------------------------------------

const MONEY_RE = /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\$\s?\d+(?:\.\d{2})?/g;
// Dates (2026-07-20, 7/20, July 20, Jul 20th) + clock times (3pm, 3:30 PM, 15:00).
const DATE_RE =
  /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?)\b/gi;
const TIME_RE = /\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b|\b\d{1,2}:\d{2}\b/gi;

/** Normalize a token for whitespace-insensitive, case-insensitive comparison. */
function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

function findAll(text: string, re: RegExp): string[] {
  const out: string[] = [];
  const r = new RegExp(re.source, re.flags);
  let m: RegExpExecArray | null;
  while ((m = r.exec(text)) !== null) {
    if (m[0]) out.push(m[0]);
    if (m.index === r.lastIndex) r.lastIndex++; // guard zero-width
  }
  return out;
}

export function validateGrounding(
  draftText: string | undefined,
  contextUsed: ContextUsedEntry[],
): GroundingResult {
  if (!draftText || draftText.trim() === "") {
    return { grounded: true, violations: [] };
  }
  const haystack = norm(contextUsed.map((c) => c.detail).join("  "));
  const violations: GroundingViolation[] = [];

  for (const money of findAll(draftText, MONEY_RE)) {
    if (!haystack.includes(norm(money))) {
      violations.push({ token: money.trim(), kind: "money" });
    }
  }
  for (const token of [
    ...findAll(draftText, DATE_RE),
    ...findAll(draftText, TIME_RE),
  ]) {
    if (!haystack.includes(norm(token))) {
      violations.push({ token: token.trim(), kind: "datetime" });
    }
  }

  return { grounded: violations.length === 0, violations };
}

// ---------------------------------------------------------------------------
// 3. Autonomy decision. Given the tier + autonomy + overrides, decide execute
//    vs propose. Then grounding can only DOWNGRADE execute → propose.
//
//    Base rules (SPEC §5):
//      no_ai      → nothing client-facing (only note.log executes; other jobs
//                   aren't even enqueued, but we stay safe here).
//      draft_only → everything proposed (note.log still executes: internal).
//      assisted   → tier-1 reply.autosend executes; tier 2/3 proposed.
//      managed    → tier-1 executes; tier-2 proposed (one-tap approve);
//                   tier-3 always proposed (artist-only).
//    Overrides: 'ask' forces propose; 'auto' allows execute for tier 1 & 2;
//    'off' hands the class to the artist (propose). Tier 3 can NEVER be
//    upgraded to execute — payments/verification/external stay artist-only.
// ---------------------------------------------------------------------------

function baseDecision(autonomy: Autonomy, tier: Tier, actionType: ActionType): {
  decision: PolicyDecision;
  reason: string;
} {
  // note.log is internal bookkeeping — it always "executes" (writes the log).
  if (actionType === "note.log") {
    return { decision: "execute", reason: "note.log is internal-only" };
  }
  // Tier 3 is artist-only under every autonomy level.
  if (tier === 3) {
    return { decision: "propose", reason: "tier 3 is always artist-only" };
  }
  switch (autonomy) {
    case "no_ai":
      return { decision: "propose", reason: "no_ai: nothing client-facing auto-sends" };
    case "draft_only":
      return { decision: "propose", reason: "draft_only: every action is proposed" };
    case "assisted":
      if (tier === 1 && actionType === "reply.autosend") {
        return { decision: "execute", reason: "assisted: tier-1 auto-reply sends" };
      }
      return { decision: "propose", reason: "assisted: tier 2+ (or non-autosend) is proposed" };
    case "managed":
      if (tier === 1) {
        return { decision: "execute", reason: "managed: tier-1 executes" };
      }
      return { decision: "propose", reason: "managed: tier-2 proposed for one-tap approve" };
  }
}

function applyOverride(
  base: { decision: PolicyDecision; reason: string },
  override: ActionOverride | undefined,
  tier: Tier,
): { decision: PolicyDecision; reason: string } {
  if (!override) return base;
  if (override === "ask" || override === "off") {
    return { decision: "propose", reason: `override '${override}': proposed` };
  }
  // 'auto' — allow execute for tier 1 & 2 only; tier 3 stays artist-only.
  if (override === "auto") {
    if (tier === 3) {
      return { decision: "propose", reason: "override 'auto' ignored: tier 3 stays artist-only" };
    }
    return { decision: "execute", reason: "override 'auto': executes" };
  }
  return base;
}

function readOverride(
  overrides: Record<string, string> | null | undefined,
  actionClass: ActionClass,
): ActionOverride | undefined {
  const v = overrides?.[actionClass];
  if (v === "auto" || v === "ask" || v === "off") return v;
  return undefined;
}

/**
 * The single entry point the runner calls. Returns the tier, the execute/propose
 * decision, the resulting persisted status, the grounding result, and the audit
 * reasons. Grounding failure forces `proposed`.
 */
export function decideAction(input: PolicyInput): PolicyResult {
  const tier = classifyTier(input.actionType, input.actionClass);
  const reasons: string[] = [];

  const base = baseDecision(input.autonomy, tier, input.actionType);
  reasons.push(base.reason);

  const override = readOverride(input.overrides, input.actionClass);
  const afterOverride = applyOverride(base, override, tier);
  if (afterOverride.reason !== base.reason) reasons.push(afterOverride.reason);

  let decision = afterOverride.decision;

  // Grounding gate: only client-facing text is checked; a violation downgrades.
  const grounding = validateGrounding(input.draftText, input.contextUsed);
  if (decision === "execute" && !grounding.grounded && input.actionType !== "note.log") {
    decision = "propose";
    reasons.push(
      `grounding: downgraded to proposed — ungrounded ${grounding.violations
        .map((v) => v.token)
        .join(", ")}`,
    );
  }

  const status: "executed" | "proposed" = decision === "execute" ? "executed" : "proposed";
  return { tier, decision, status, grounding, reasons };
}
