// The approval execution path used by the trust UI's approve/reject controls.
// Pure transition logic over an injected ApprovalRepo so it tests offline. The
// edge function (approve-agent-action) authenticates the caller (JWT ->
// current_artist_id) and backs the repo with the service-role client.
//
// Rules: only a `proposed` action can transition; only the OWNING artist may act.
// Approve → executes the action (posts the agent message when client-facing),
// sets status=executed + executed_message_id + approved_by/at. Reject → rejected.
// An edited draft is honoured on approve and recorded into payload.edited.

import type { ActionType, AgentActionPayload, ProposedSlot } from "./agent-contract.ts";
import { AppError, errors } from "./errors.ts";

export interface ApprovalActionRow {
  id: string;
  artist_id: string;
  action_type: ActionType;
  status: string;
  thread_id: string | null;
  payload: AgentActionPayload;
}

export interface ApprovalRepo {
  getAction(actionId: string): Promise<ApprovalActionRow | null>;
  /** Insert an agent-authored message and return its id. */
  insertAgentMessage(input: {
    thread_id: string;
    body: string;
    agent_action_id: string;
  }): Promise<string>;
  /** Finalize an approved action: status=executed, link executed_message_id,
   *  stamp approver, and (if edited) merge payload.edited. */
  markExecuted(input: {
    actionId: string;
    approverProfileId: string;
    executedMessageId: string | null;
    editedDraft?: string;
  }): Promise<void>;
  markRejected(input: { actionId: string; approverProfileId: string }): Promise<void>;
}

export interface ApprovalInput {
  actionId: string;
  decision: "approve" | "reject";
  /** artist_profiles.id of the caller (from current_artist_id). */
  approverArtistId: string;
  /** profiles.id of the caller (auth.uid) — stamped as approved_by. */
  approverProfileId: string;
  /** Optional replacement text for a reply, on approve. */
  editedDraft?: string;
}

export interface ApprovalResult {
  status: "executed" | "rejected";
  messageId: string | null;
}

function slotsMessageBody(slots: ProposedSlot[]): string {
  const lines = slots.map((s) => {
    const d = new Date(s.starts_at);
    const day = d.toISOString().slice(0, 10);
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    return `• ${day} ${hh}:${mm} UTC`;
  });
  return ["Here are a few times that work:", ...lines, "Let me know which suits you."].join("\n");
}

/** Resolve the client-facing body for an approved action, or null when the
 * action type posts nothing (handoff / internal note). */
function bodyForApproval(
  action: ApprovalActionRow,
  editedDraft: string | undefined,
): string | null {
  const t: ActionType = action.action_type;
  if (t === "reply.autosend" || t === "reply.draft") {
    const body = (editedDraft ?? action.payload.draft_text ?? "").trim();
    if (body === "") throw errors.badRequest("Nothing to send: draft_text is empty");
    return body;
  }
  if (t === "booking.propose_slots") {
    const slots = action.payload.proposed_slots ?? [];
    if (slots.length === 0) throw errors.badRequest("No proposed slots to send");
    return slotsMessageBody(slots);
  }
  // flag.handoff / note.log — approving just acknowledges; nothing is posted.
  return null;
}

/**
 * Apply an approve/reject decision. Throws AppError (404/403/409/400) on an
 * invalid transition so the edge function maps it to the right HTTP status.
 */
export async function applyApproval(
  repo: ApprovalRepo,
  input: ApprovalInput,
): Promise<ApprovalResult> {
  const action = await repo.getAction(input.actionId);
  if (!action) throw errors.notFound("Agent action not found");
  if (action.artist_id !== input.approverArtistId) {
    throw errors.forbidden("You can only act on your own assistant's actions");
  }
  if (action.status !== "proposed") {
    throw errors.conflict(`Action is already ${action.status}`);
  }

  if (input.decision === "reject") {
    await repo.markRejected({
      actionId: action.id,
      approverProfileId: input.approverProfileId,
    });
    return { status: "rejected", messageId: null };
  }

  // approve → execute
  const body = bodyForApproval(action, input.editedDraft);
  let messageId: string | null = null;
  if (body && action.thread_id) {
    messageId = await repo.insertAgentMessage({
      thread_id: action.thread_id,
      body,
      agent_action_id: action.id,
    });
  }
  await repo.markExecuted({
    actionId: action.id,
    approverProfileId: input.approverProfileId,
    executedMessageId: messageId,
    editedDraft: input.editedDraft,
  });
  return { status: "executed", messageId };
}

export { AppError };
