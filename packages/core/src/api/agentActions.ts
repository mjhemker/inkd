/**
 * Data access: agent_actions — the "every move visible" ledger + approval queue
 * for the artist's AI staff (SPEC §5, Visibility & trust — hard requirements).
 *
 * Agent internals are strictly artist-only under RLS. The agent RUNTIME writes
 * proposed actions server-side with the service role; this module is the
 * artist-facing read + approve/reject surface, scoped by the caller's session.
 *
 * ── CONTRACT ────────────────────────────────────────────────────────────────
 * A parallel runtime agent writes rows against a fixed shape (see
 * `AgentActionPayload` / `AgentActionType` below). Because the physical table
 * keeps a few links as top-level columns (`thread_id`, `booking_request_id`,
 * `data_consulted`, `result`) while the contract nests them under `payload`,
 * every row is normalized through `toAgentActionView` into a single
 * contract-shaped `AgentActionView` the UI reads from. This keeps screens
 * decoupled from where a field physically lives.
 */
import { z } from "zod";

import type { InkdSupabaseClient } from "../supabase/client";
import { subscribeShared } from "./realtimeShare";
import type {
  AgentAction,
  AgentActionStatus,
  AgentActionUpdate,
  Message,
  MessageInsert,
} from "../types/rows";
import { clampLimit, unwrap, unwrapList, unwrapMaybe } from "./helpers";

// ── Contract types (code against these exactly) ──────────────────────────────

/** The v1 action types the policy engine + runtime emit. */
export type AgentActionType =
  | "reply.draft"
  | "reply.autosend"
  | "booking.propose_slots"
  | "flag.handoff"
  | "note.log";

export type AgentActionTier = 1 | 2 | 3;

/** One grounding citation — where a fact in the draft came from. Agents may
 * never state a price/date not read from a tool, so every action lists what it
 * consulted. */
export interface AgentContextEntry {
  source: "services" | "availability" | "booking_policy" | "playbook" | "profile";
  detail: string;
}

export interface AgentProposedSlot {
  starts_at: string;
  ends_at: string;
}

/** The `payload` jsonb shape the runtime writes (and this module reads). */
export interface AgentActionPayload {
  thread_id?: string;
  booking_request_id?: string;
  draft_text?: string;
  proposed_slots?: AgentProposedSlot[];
  context_used: AgentContextEntry[];
  trigger: { kind: "message" | "booking_request"; id: string };
}

/**
 * A normalized, contract-shaped agent action. Extends the raw row so the UI
 * still gets `created_at`, `tier`, `status`, `reasoning_summary`, `agent_role`
 * etc., and adds:
 *   - `contract`: the typed `payload` (with `thread_id` / `booking_request_id`
 *     resolved from the column when the payload omits them).
 *   - `executedMessageId`: the row's `executed_message_id` column — the message
 *     an executed action produced. Written by the runtime's approve endpoint
 *     (and the direct-update fallback here).
 */
export interface AgentActionView extends AgentAction {
  contract: AgentActionPayload;
  executedMessageId: string | null;
}

const CONTEXT_SOURCES: AgentContextEntry["source"][] = [
  "services",
  "availability",
  "booking_policy",
  "playbook",
  "profile",
];

/** Best-effort coercion of the legacy `data_consulted` column into the
 * contract's `context_used` list, for rows a runtime wrote before it populated
 * `payload.context_used`. */
function contextFromDataConsulted(raw: unknown): AgentContextEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: AgentContextEntry[] = [];
  for (const item of raw) {
    if (item && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      const source = rec.source;
      const detail = rec.detail;
      if (
        typeof source === "string" &&
        (CONTEXT_SOURCES as string[]).includes(source) &&
        typeof detail === "string"
      ) {
        out.push({ source: source as AgentContextEntry["source"], detail });
      }
    }
  }
  return out;
}

/** Normalize a raw row into the contract-shaped view the UI consumes. */
export function toAgentActionView(row: AgentAction): AgentActionView {
  const payload = (row.payload ?? {}) as Partial<AgentActionPayload>;
  const trigger: AgentActionPayload["trigger"] =
    payload.trigger ??
    (row.booking_request_id
      ? { kind: "booking_request", id: row.booking_request_id }
      : { kind: "message", id: row.thread_id ?? row.id });

  return {
    ...row,
    contract: {
      thread_id: payload.thread_id ?? row.thread_id ?? undefined,
      booking_request_id:
        payload.booking_request_id ?? row.booking_request_id ?? undefined,
      draft_text: payload.draft_text,
      proposed_slots: payload.proposed_slots,
      context_used:
        payload.context_used ?? contextFromDataConsulted(row.data_consulted),
      trigger,
    },
    executedMessageId: row.executed_message_id ?? null,
  };
}

// ── Reads ────────────────────────────────────────────────────────────────────

export interface ListAgentActionsOpts {
  /** Filter to a single lifecycle status (e.g. "proposed" for the inbox). */
  status?: AgentActionStatus;
  /** Filter to a single action_type (e.g. "flag.handoff"). */
  type?: string;
  limit?: number;
}

/** Newest-first agent_actions for an artist, optionally filtered. */
export async function listAgentActions(
  client: InkdSupabaseClient,
  artistId: string,
  opts: ListAgentActionsOpts = {},
): Promise<AgentActionView[]> {
  let query = client
    .from("agent_actions")
    .select("*")
    .eq("artist_id", artistId)
    .order("created_at", { ascending: false })
    .limit(clampLimit(opts.limit, 100));
  if (opts.status) query = query.eq("status", opts.status);
  if (opts.type) query = query.eq("action_type", opts.type);
  return unwrapList<AgentAction>(await query).map(toAgentActionView);
}

/**
 * The client message that triggered this action, for the "what it responds to"
 * context on an approval card. Returns null for booking-request triggers (no
 * message) or if the message is gone. RLS scopes visibility to the thread.
 */
export async function getAgentActionTriggerMessage(
  client: InkdSupabaseClient,
  action: AgentActionView,
): Promise<Message | null> {
  if (action.contract.trigger.kind !== "message") return null;
  return unwrapMaybe(
    await client
      .from("messages")
      .select("*")
      .eq("id", action.contract.trigger.id)
      .maybeSingle(),
  );
}

/** Count of actions awaiting the artist's approval (the inbox badge). */
export async function countProposedAgentActions(
  client: InkdSupabaseClient,
  artistId: string,
): Promise<number> {
  const { count, error } = await client
    .from("agent_actions")
    .select("id", { count: "exact", head: true })
    .eq("artist_id", artistId)
    .eq("status", "proposed");
  if (error) throw error;
  return count ?? 0;
}

// ── Approve / reject (the WIRE point for the runtime's execute endpoint) ──────

export interface ApproveAgentActionInput {
  action: AgentActionView;
  /** Replaces the draft body before sending (the "edit then send" path). */
  editedDraftText?: string;
  /** Approving artist's profile id, stamped into `approved_by`. */
  approverProfileId?: string;
}

/**
 * Approve (and execute) a proposed action.
 *
 * The authoritative executor is the `approve-agent-action` edge function: it
 * re-verifies the caller owns the action, posts the client-facing message when
 * applicable, and stamps `executed` + `executed_message_id` atomically with the
 * service role. We invoke it here and re-read the row for the returned view.
 *
 * The direct, RLS-scoped fallback (`approveAgentActionDirect`) runs ONLY when
 * the functions API is unavailable — e.g. the offline `/dev/ai-staff-preview`
 * harness, whose mock client has no `.functions` and throws on access. A
 * structured error FROM the endpoint (409 already-executed, 403 not-owner) is
 * surfaced, never silently retried through the direct path.
 */
export async function approveAgentAction(
  client: InkdSupabaseClient,
  input: ApproveAgentActionInput,
): Promise<AgentActionView> {
  let invoked: { data: unknown; error: unknown } | undefined;
  try {
    invoked = await client.functions.invoke("approve-agent-action", {
      body: {
        action_id: input.action.id,
        decision: "approve",
        edited_draft: input.editedDraftText,
      },
    });
  } catch {
    // Functions API absent (offline dev harness) — reproduce the executor's
    // observable result with a direct RLS-scoped write so previews still work.
    return approveAgentActionDirect(client, input);
  }
  if (invoked.error) throw invoked.error;
  // Endpoint executed server-side; re-read the authoritative row for the view.
  const updated = unwrap(
    await client.from("agent_actions").select("*").eq("id", input.action.id).single(),
  );
  return toAgentActionView(updated);
}

async function approveAgentActionDirect(
  client: InkdSupabaseClient,
  { action, editedDraftText, approverProfileId }: ApproveAgentActionInput,
): Promise<AgentActionView> {
  const now = new Date().toISOString();
  const draftText = editedDraftText ?? action.contract.draft_text ?? null;
  const threadId = action.contract.thread_id ?? action.thread_id ?? null;
  const producesMessage =
    Boolean(draftText) &&
    Boolean(threadId) &&
    (action.action_type === "reply.draft" ||
      action.action_type === "reply.autosend");

  let executedMessageId: string | null = null;
  if (producesMessage && threadId && draftText) {
    const insert: MessageInsert = {
      thread_id: threadId,
      sender_kind: "agent",
      sender_profile_id: null,
      agent_action_id: action.id,
      body: draftText,
      drafted_by_agent: true,
    };
    const message = unwrap(
      await client.from("messages").insert(insert).select("*").single(),
    );
    executedMessageId = message.id;
    // Best-effort thread recency bump; ignore RLS/no-op failures.
    await client
      .from("threads")
      .update({ last_message_at: message.created_at })
      .eq("id", threadId);
  }

  const priorPayload = (action.payload ?? {}) as Record<string, unknown>;
  const priorResult = (action.result ?? {}) as Record<string, unknown>;
  const patch: AgentActionUpdate = {
    status: "executed",
    approved_at: now,
    executed_at: now,
    approved_by: approverProfileId ?? null,
    executed_message_id: executedMessageId,
    result: {
      ...priorResult,
      edited: Boolean(editedDraftText),
    },
    payload: editedDraftText
      ? ({ ...priorPayload, draft_text: draftText } as AgentActionUpdate["payload"])
      : (action.payload as AgentActionUpdate["payload"]),
  };
  const updated = unwrap(
    await client
      .from("agent_actions")
      .update(patch)
      .eq("id", action.id)
      .select("*")
      .single(),
  );
  return toAgentActionView(updated);
}

const rejectSchema = z.object({ reason: z.string().max(2000).optional() });

/** Reject a proposed action (optionally recording a reason note). */
export async function rejectAgentAction(
  client: InkdSupabaseClient,
  actionId: string,
  input: z.input<typeof rejectSchema> = {},
): Promise<AgentActionView> {
  const { reason } = rejectSchema.parse(input);
  const patch: AgentActionUpdate = {
    status: "rejected",
    rejected_at: new Date().toISOString(),
    result: reason ? { rejected_reason: reason } : null,
  };
  const updated = unwrap(
    await client
      .from("agent_actions")
      .update(patch)
      .eq("id", actionId)
      .select("*")
      .single(),
  );
  return toAgentActionView(updated);
}

// ── Realtime ─────────────────────────────────────────────────────────────────

/**
 * Subscribe to agent_actions changes for an artist (new proposals, and status
 * transitions as they're approved/rejected). Mirrors
 * `subscribeToNotifications` — RLS still scopes delivery to the owning artist.
 * Returns an unsubscribe function.
 *
 * Shared per `artistId` via `subscribeShared` — `AiStaffView` calls
 * `useAgentActions` twice (proposed queue + activity feed), and both now fan
 * out from one underlying channel instead of each opening their own.
 */
export function subscribeToAgentActions(
  client: InkdSupabaseClient,
  artistId: string,
  onChange: () => void,
): () => void {
  return subscribeShared<void>(
    client,
    `agent_actions:${artistId}`,
    (channel, dispatch) =>
      channel
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "agent_actions",
            filter: `artist_id=eq.${artistId}`,
          },
          () => dispatch(undefined),
        )
        .subscribe(),
    () => onChange(),
  );
}
