// The INKD agent-runtime CONTRACT — the exact shape an `agent_actions` row's
// payload takes, plus the strict parser for the model's structured output. A
// trust-UI agent builds against this same shape in parallel, so nothing here may
// drift without a coordinated change on both sides.
//
// Pure + dependency-free (erasable TypeScript only) so it runs identically under
// Deno (the deployed edge function) and Node's built-in test runner.

// ---------------------------------------------------------------------------
// Enumerations (as const arrays so we can both type AND validate at runtime).
// ---------------------------------------------------------------------------

/** Every action the runtime can record. Client-facing except `note.log`. */
export const ACTION_TYPES = [
  "reply.draft",
  "reply.autosend",
  "booking.propose_slots",
  "flag.handoff",
  "note.log",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

/** Deterministic policy tier (SPEC §5). Assigned by the policy engine, never
 * by the model. */
export type Tier = 1 | 2 | 3;

/** Lifecycle status recorded on agent_actions for the runtime + approval path.
 * (The DB enum also carries `failed`/`superseded` for other transitions.) */
export const ACTION_STATUSES = [
  "proposed",
  "approved",
  "executed",
  "rejected",
] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

/** Which structured artist datum grounded a piece of the reply/decision. */
export const CONTEXT_SOURCES = [
  "services",
  "availability",
  "booking_policy",
  "playbook",
  "profile",
] as const;
export type ContextSource = (typeof CONTEXT_SOURCES)[number];

/** The action classes the model labels an output with; the policy engine maps
 * each to a fixed tier (mirrors ACTION_CLASSES in @inkd/core onboarding). */
export const ACTION_CLASSES = [
  "answer_faq",
  "send_reminders",
  "collect_intake",
  "propose_slots",
  "quote_in_range",
  "reschedule",
  "payments",
] as const;
export type ActionClass = (typeof ACTION_CLASSES)[number];

// ---------------------------------------------------------------------------
// Payload shape — persisted verbatim into agent_actions.payload (jsonb).
// ---------------------------------------------------------------------------

/** A concrete slot the Booking Manager proposes. ISO-8601 timestamps. */
export interface ProposedSlot {
  starts_at: string;
  ends_at: string;
}

/** One piece of grounding: which source, and the human-readable fact used. */
export interface ContextUsedEntry {
  source: ContextSource;
  detail: string;
}

/** What triggered this run — the message or booking_request that enqueued it. */
export interface TriggerRef {
  kind: "message" | "booking_request";
  id: string;
}

/** The canonical agent_actions.payload jsonb. */
export interface AgentActionPayload {
  thread_id?: string;
  booking_request_id?: string;
  draft_text?: string;
  proposed_slots?: ProposedSlot[];
  context_used: ContextUsedEntry[];
  trigger: TriggerRef;
  /** Present only on an approved-with-edits execution (approval path). */
  edited?: { draft_text: string; edited_by: string; edited_at: string };
}

// ---------------------------------------------------------------------------
// Model output — the strict JSON the LLM must emit. The policy engine derives
// tier + the execute/propose decision from this; the model never sets tier.
// ---------------------------------------------------------------------------
export interface AgentModelOutput {
  action_type: ActionType;
  action_class: ActionClass;
  reasoning_summary: string;
  draft_text?: string;
  proposed_slots?: ProposedSlot[];
  /** Why this was escalated — required when action_type = 'flag.handoff'. */
  escalation_reason?: string;
}

/** Thrown when the model output can't be parsed into a valid AgentModelOutput. */
export class AgentParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentParseError";
  }
}

// ---------------------------------------------------------------------------
// Parsing the model's raw text into a validated structured output.
// ---------------------------------------------------------------------------

/**
 * Extract the JSON object from a raw model completion. Tolerates a ```json
 * fenced block or leading/trailing prose by slicing to the outermost braces.
 */
export function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  // Strip a ```json ... ``` (or bare ```) fence if present.
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1].trim() : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new AgentParseError("No JSON object found in model output");
  }
  return body.slice(start, end + 1);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseSlots(value: unknown): ProposedSlot[] | undefined {
  if (value == null) return undefined;
  if (!Array.isArray(value)) {
    throw new AgentParseError("proposed_slots must be an array");
  }
  return value.map((s, i) => {
    if (!isPlainObject(s)) {
      throw new AgentParseError(`proposed_slots[${i}] must be an object`);
    }
    const startsAt = s.starts_at;
    const endsAt = s.ends_at;
    if (typeof startsAt !== "string" || typeof endsAt !== "string") {
      throw new AgentParseError(
        `proposed_slots[${i}] needs string starts_at + ends_at`,
      );
    }
    return { starts_at: startsAt, ends_at: endsAt };
  });
}

/**
 * Strictly parse + validate a raw model completion into an AgentModelOutput.
 * Throws AgentParseError on any structural or enum violation. The caller retries
 * once (see generateStructured) before giving up and flagging for the artist.
 */
export function parseAgentOutput(raw: string): AgentModelOutput {
  let json: unknown;
  try {
    json = JSON.parse(extractJsonObject(raw));
  } catch (err) {
    if (err instanceof AgentParseError) throw err;
    throw new AgentParseError(
      `Model output was not valid JSON: ${(err as Error).message}`,
    );
  }

  if (!isPlainObject(json)) {
    throw new AgentParseError("Model output was not a JSON object");
  }

  const actionType = json.action_type;
  if (typeof actionType !== "string" || !ACTION_TYPES.includes(actionType as ActionType)) {
    throw new AgentParseError(`Invalid action_type: ${String(actionType)}`);
  }

  const actionClass = json.action_class;
  if (
    typeof actionClass !== "string" ||
    !ACTION_CLASSES.includes(actionClass as ActionClass)
  ) {
    throw new AgentParseError(`Invalid action_class: ${String(actionClass)}`);
  }

  const reasoning = json.reasoning_summary;
  if (typeof reasoning !== "string" || reasoning.trim() === "") {
    throw new AgentParseError("reasoning_summary is required");
  }

  const draftText = json.draft_text;
  if (draftText != null && typeof draftText !== "string") {
    throw new AgentParseError("draft_text must be a string");
  }

  const escalation = json.escalation_reason;
  if (escalation != null && typeof escalation !== "string") {
    throw new AgentParseError("escalation_reason must be a string");
  }

  const out: AgentModelOutput = {
    action_type: actionType as ActionType,
    action_class: actionClass as ActionClass,
    reasoning_summary: reasoning.trim(),
  };
  if (typeof draftText === "string") out.draft_text = draftText;
  const slots = parseSlots(json.proposed_slots);
  if (slots) out.proposed_slots = slots;
  if (typeof escalation === "string") out.escalation_reason = escalation;

  // Cross-field invariants: a client-facing reply needs text; propose_slots
  // needs slots; a handoff needs a reason.
  if (
    (out.action_type === "reply.draft" || out.action_type === "reply.autosend") &&
    (!out.draft_text || out.draft_text.trim() === "")
  ) {
    throw new AgentParseError(`${out.action_type} requires draft_text`);
  }
  if (out.action_type === "booking.propose_slots" && (!slots || slots.length === 0)) {
    throw new AgentParseError("booking.propose_slots requires proposed_slots");
  }

  return out;
}

// ---------------------------------------------------------------------------
// Dedupe key — mirrors the SQL enqueue triggers ('message:' / 'booking_request:'
// + id). Exposed so the runner can reason about a job's identity.
// ---------------------------------------------------------------------------
export function dedupeKeyFor(kind: TriggerRef["kind"], id: string): string {
  return `${kind}:${id}`;
}
