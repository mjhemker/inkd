// Offline tests for the approve/reject transition logic (trust UI's control).
//   node --test supabase/functions/_shared/agent-approval.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  applyApproval,
  AppError,
  type ApprovalActionRow,
  type ApprovalRepo,
} from "./agent-approval.ts";
import type { AgentActionPayload } from "./agent-contract.ts";

function payload(over: Partial<AgentActionPayload> = {}): AgentActionPayload {
  return { context_used: [], trigger: { kind: "message", id: "m1" }, ...over };
}

class FakeApprovalRepo implements ApprovalRepo {
  messages: { thread_id: string; body: string; agent_action_id: string }[] = [];
  executed: { actionId: string; executedMessageId: string | null; editedDraft?: string }[] = [];
  rejected: string[] = [];
  private action: ApprovalActionRow | null;
  constructor(action: ApprovalActionRow | null) {
    this.action = action;
  }
  getAction(): Promise<ApprovalActionRow | null> {
    return Promise.resolve(this.action);
  }
  insertAgentMessage(input: { thread_id: string; body: string; agent_action_id: string }): Promise<string> {
    this.messages.push(input);
    return Promise.resolve(`msg-${this.messages.length}`);
  }
  markExecuted(input: { actionId: string; approverProfileId: string; executedMessageId: string | null; editedDraft?: string }): Promise<void> {
    this.executed.push({
      actionId: input.actionId,
      executedMessageId: input.executedMessageId,
      editedDraft: input.editedDraft,
    });
    return Promise.resolve();
  }
  markRejected(input: { actionId: string; approverProfileId: string }): Promise<void> {
    this.rejected.push(input.actionId);
    return Promise.resolve();
  }
}

const OWNER = { approverArtistId: "artist-1", approverProfileId: "prof-1" };

function proposedReply(): ApprovalActionRow {
  return {
    id: "act-1",
    artist_id: "artist-1",
    action_type: "reply.draft",
    status: "proposed",
    thread_id: "thread-1",
    payload: payload({ draft_text: "We're open Tuesday to Saturday." }),
  };
}

test("approve a proposed reply -> executed + message posted with edited-draft link", async () => {
  const repo = new FakeApprovalRepo(proposedReply());
  const res = await applyApproval(repo, { ...OWNER, actionId: "act-1", decision: "approve" });
  assert.equal(res.status, "executed");
  assert.equal(res.messageId, "msg-1");
  assert.equal(repo.messages[0].body, "We're open Tuesday to Saturday.");
  assert.equal(repo.executed[0].executedMessageId, "msg-1");
});

test("approve with an edited draft sends + records the edit", async () => {
  const repo = new FakeApprovalRepo(proposedReply());
  const res = await applyApproval(repo, {
    ...OWNER,
    actionId: "act-1",
    decision: "approve",
    editedDraft: "Hey! We're open Tue–Sat, come by.",
  });
  assert.equal(res.status, "executed");
  assert.equal(repo.messages[0].body, "Hey! We're open Tue–Sat, come by.");
  assert.equal(repo.executed[0].editedDraft, "Hey! We're open Tue–Sat, come by.");
});

test("reject a proposed action -> rejected, nothing sent", async () => {
  const repo = new FakeApprovalRepo(proposedReply());
  const res = await applyApproval(repo, { ...OWNER, actionId: "act-1", decision: "reject" });
  assert.equal(res.status, "rejected");
  assert.equal(res.messageId, null);
  assert.equal(repo.messages.length, 0);
  assert.equal(repo.rejected[0], "act-1");
});

test("approving propose_slots posts a slots message", async () => {
  const action: ApprovalActionRow = {
    id: "act-2",
    artist_id: "artist-1",
    action_type: "booking.propose_slots",
    status: "proposed",
    thread_id: "thread-1",
    payload: payload({
      proposed_slots: [{ starts_at: "2026-07-20T10:00:00Z", ends_at: "2026-07-20T11:00:00Z" }],
    }),
  };
  const repo = new FakeApprovalRepo(action);
  const res = await applyApproval(repo, { ...OWNER, actionId: "act-2", decision: "approve" });
  assert.equal(res.status, "executed");
  assert.ok(repo.messages[0].body.includes("2026-07-20"));
});

test("approving a flag.handoff executes but posts nothing", async () => {
  const action: ApprovalActionRow = {
    id: "act-3",
    artist_id: "artist-1",
    action_type: "flag.handoff",
    status: "proposed",
    thread_id: "thread-1",
    payload: payload(),
  };
  const repo = new FakeApprovalRepo(action);
  const res = await applyApproval(repo, { ...OWNER, actionId: "act-3", decision: "approve" });
  assert.equal(res.status, "executed");
  assert.equal(res.messageId, null);
  assert.equal(repo.messages.length, 0);
});

test("cannot act on an action you don't own -> forbidden", async () => {
  const repo = new FakeApprovalRepo(proposedReply());
  await assert.rejects(
    () => applyApproval(repo, { approverArtistId: "artist-2", approverProfileId: "p2", actionId: "act-1", decision: "approve" }),
    (err: unknown) => err instanceof AppError && err.status === 403,
  );
});

test("cannot re-act on an already-executed action -> conflict", async () => {
  const action = { ...proposedReply(), status: "executed" };
  const repo = new FakeApprovalRepo(action);
  await assert.rejects(
    () => applyApproval(repo, { ...OWNER, actionId: "act-1", decision: "approve" }),
    (err: unknown) => err instanceof AppError && err.status === 409,
  );
});

test("missing action -> not found", async () => {
  const repo = new FakeApprovalRepo(null);
  await assert.rejects(
    () => applyApproval(repo, { ...OWNER, actionId: "nope", decision: "approve" }),
    (err: unknown) => err instanceof AppError && err.status === 404,
  );
});

test("approving a reply with empty draft -> bad request", async () => {
  const action = { ...proposedReply(), payload: payload({ draft_text: "   " }) };
  const repo = new FakeApprovalRepo(action);
  await assert.rejects(
    () => applyApproval(repo, { ...OWNER, actionId: "act-1", decision: "approve" }),
    (err: unknown) => err instanceof AppError && err.status === 400,
  );
});
