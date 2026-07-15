// The runtime orchestrator. For one leased job it: loads context via the tool
// layer, builds the role prompt, calls the model (with one strict-JSON retry),
// then runs the DETERMINISTIC policy engine to decide tier + execute/propose, and
// emits a RunResult describing exactly what to persist. Splitting the decision
// (runJob, pure-ish over injected repo+model) from the writes (persistResult)
// keeps the whole pipeline testable offline with fakes.

import {
  AgentParseError,
  type AgentActionPayload,
  type ActionType,
  type ContextUsedEntry,
  type ProposedSlot,
  type Tier,
} from "./agent-contract.ts";
import { decideAction, type PolicyResult } from "./agent-policy.ts";
import { buildMessages } from "./agent-prompt.ts";
import { generateStructured, type ModelClient } from "./agent-model.ts";
import { proposeSlots } from "./agent-slots.ts";
import {
  collectContext,
  formatCents,
  resolveServiceDuration,
  type ArtistContext,
  type ContextRepo,
} from "./agent-tools.ts";

export type AgentRole = "front_desk" | "booking_manager";

/** A leased row of the agent_jobs queue. */
export interface AgentJob {
  id: string;
  artist_id: string;
  trigger_kind: "message" | "booking_request";
  trigger_id: string;
  thread_id: string | null;
  booking_request_id: string | null;
  attempts: number;
  max_attempts: number;
}

/** The agent_actions row the runner wants written. */
export interface AgentActionDraft {
  artist_id: string;
  agent_role: AgentRole;
  thread_id: string | null;
  booking_request_id: string | null;
  client_id: string | null;
  action_type: ActionType;
  tier: Tier;
  status: "proposed" | "executed";
  reasoning_summary: string;
  payload: AgentActionPayload;
  /** Mirror of payload.context_used onto the existing jsonb column (audit). */
  data_consulted: ContextUsedEntry[];
}

/** A client-facing message to post when an action executes. */
export interface MessageDraft {
  thread_id: string;
  sender_kind: "agent";
  body: string;
  drafted_by_agent: true;
}

export type RunResult =
  | {
      kind: "action";
      job: AgentJob;
      action: AgentActionDraft;
      /** Present only when the action executes AND is client-facing. */
      message: MessageDraft | null;
      policy: PolicyResult;
    }
  | { kind: "skipped"; job: AgentJob; reason: string };

// ---------------------------------------------------------------------------
// Role resolution + gating.
// ---------------------------------------------------------------------------
function roleFor(job: AgentJob): AgentRole {
  return job.trigger_kind === "booking_request" ? "booking_manager" : "front_desk";
}

function roleEnabled(ctx: ArtistContext, role: AgentRole): boolean {
  return role === "booking_manager"
    ? ctx.settings.booking_manager_enabled
    : ctx.settings.front_desk_enabled;
}

/** Cheap deterministic escalation: any configured keyword present in the latest
 * inbound text, or a medical flag on the booking request, forces a handoff even
 * before the model runs. */
function forcedHandoffReason(ctx: ArtistContext): string | null {
  if (ctx.bookingRequest?.has_medical_flags) {
    return "Booking request has medical flags — artist must review.";
  }
  const keywords = ctx.settings.escalation_keywords ?? [];
  if (keywords.length === 0) return null;
  const text = (ctx.thread?.messages ?? [])
    .map((m) => (m.body ?? "").toLowerCase())
    .join("  ");
  const hit = keywords.find((k) => k.trim() !== "" && text.includes(k.toLowerCase()));
  return hit ? `Escalation keyword "${hit}" detected — handed to artist.` : null;
}

// ---------------------------------------------------------------------------
// Build the message body for an executed action.
// ---------------------------------------------------------------------------
function slotsMessage(slots: ProposedSlot[]): string {
  const lines = slots.map((s) => `• ${formatDateTime(s.starts_at)}`);
  return ["Here are a few times that work:", ...lines, "Let me know which suits you."].join("\n");
}

function formatDateTime(iso: string): string {
  // Deterministic, locale-free rendering (UTC) for reproducible output.
  const d = new Date(iso);
  const day = d.toISOString().slice(0, 10);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${hh}:${mm} UTC`;
}

// ---------------------------------------------------------------------------
// runJob — decide, don't write. Returns the plan to persist.
// ---------------------------------------------------------------------------
export interface RunDeps {
  repo: ContextRepo & JobRepo;
  model: ModelClient;
  now?: Date;
}

export async function runJob(deps: RunDeps, job: AgentJob): Promise<RunResult> {
  const trigger = { kind: job.trigger_kind, id: job.trigger_id } as const;
  const ctx = await collectContext(
    deps.repo,
    {
      artistId: job.artist_id,
      trigger,
      threadId: job.thread_id ?? undefined,
      bookingRequestId: job.booking_request_id ?? undefined,
    },
    { now: deps.now },
  );

  const role = roleFor(job);
  if (!roleEnabled(ctx, role)) {
    return { kind: "skipped", job, reason: `${role} is disabled for this artist` };
  }

  const clientId = job.thread_id
    ? await deps.repo.clientIdForThread(job.thread_id)
    : job.booking_request_id
      ? await deps.repo.clientIdForBookingRequest(job.booking_request_id)
      : null;

  // Deterministic pre-model escalation.
  const forced = forcedHandoffReason(ctx);
  if (forced) {
    return buildActionResult(job, ctx, role, clientId, {
      action_type: "flag.handoff",
      action_class: "payments",
      reasoning_summary: forced,
      escalation_reason: forced,
    });
  }

  // Call the model with strict-JSON retry; a hard parse failure becomes a
  // handoff so a human still sees the conversation.
  const prompt = buildMessages(ctx);
  let output;
  try {
    const res = await generateStructured(deps.model, {
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
    });
    output = res.output;
  } catch (err) {
    if (err instanceof AgentParseError) {
      return buildActionResult(job, ctx, role, clientId, {
        action_type: "flag.handoff",
        action_class: "payments",
        reasoning_summary:
          "I couldn't compose a reliable reply, so I've flagged this for you to handle.",
        escalation_reason: `Model output failed validation: ${err.message}`,
      });
    }
    throw err; // network/other → fail the job, let it retry
  }

  return buildActionResult(job, ctx, role, clientId, output);
}

/** Shared assembly of the action + optional message from a resolved output. */
function buildActionResult(
  job: AgentJob,
  ctx: ArtistContext,
  role: AgentRole,
  clientId: string | null,
  output: {
    action_type: ActionType;
    action_class:
      | "answer_faq"
      | "send_reminders"
      | "collect_intake"
      | "propose_slots"
      | "quote_in_range"
      | "reschedule"
      | "payments";
    reasoning_summary: string;
    draft_text?: string;
    proposed_slots?: ProposedSlot[];
    escalation_reason?: string;
  },
): RunResult {
  // The Booking Manager's slots are filled AUTHORITATIVELY from real availability
  // (never the model's dates) so they are grounded by construction.
  let proposed: ProposedSlot[] | undefined;
  if (output.action_type === "booking.propose_slots") {
    const dur = resolveServiceDuration(ctx);
    proposed = proposeSlots({ days: ctx.bookableDays, durationMinutes: dur, count: 3 });
  }

  const payload: AgentActionPayload = {
    context_used: ctx.contextUsed,
    trigger: ctx.trigger,
  };
  if (ctx.thread) payload.thread_id = ctx.thread.id;
  if (ctx.bookingRequest) payload.booking_request_id = ctx.bookingRequest.id;
  if (output.draft_text) payload.draft_text = output.draft_text;
  if (proposed && proposed.length > 0) payload.proposed_slots = proposed;

  const policy = decideAction({
    autonomy: ctx.settings.autonomy,
    actionType: output.action_type,
    actionClass: output.action_class,
    overrides: ctx.settings.action_class_overrides,
    draftText: output.draft_text,
    contextUsed: ctx.contextUsed,
  });

  const reasoning =
    output.action_type === "flag.handoff" && output.escalation_reason
      ? `${output.reasoning_summary} (${output.escalation_reason})`
      : output.reasoning_summary;

  const action: AgentActionDraft = {
    artist_id: job.artist_id,
    agent_role: role,
    thread_id: ctx.thread?.id ?? null,
    booking_request_id: ctx.bookingRequest?.id ?? null,
    client_id: clientId,
    action_type: output.action_type,
    tier: policy.tier,
    status: policy.status,
    reasoning_summary: reasoning,
    payload,
    data_consulted: ctx.contextUsed,
  };

  // A message is posted only when the action executes AND is client-facing.
  let message: MessageDraft | null = null;
  if (policy.status === "executed" && ctx.thread) {
    if (
      (output.action_type === "reply.autosend" || output.action_type === "reply.draft") &&
      output.draft_text
    ) {
      message = {
        thread_id: ctx.thread.id,
        sender_kind: "agent",
        body: output.draft_text,
        drafted_by_agent: true,
      };
    } else if (output.action_type === "booking.propose_slots" && proposed && proposed.length > 0) {
      message = {
        thread_id: ctx.thread.id,
        sender_kind: "agent",
        body: slotsMessage(proposed),
        drafted_by_agent: true,
      };
    }
  }

  return { kind: "action", job, action, message, policy };
}

// ---------------------------------------------------------------------------
// Persistence contract + batch drain.
// ---------------------------------------------------------------------------
export interface JobRepo {
  clientIdForThread(threadId: string): Promise<string | null>;
  clientIdForBookingRequest(bookingRequestId: string): Promise<string | null>;
  /** Atomically move up to `limit` pending jobs (attempts < max) to running. */
  leasePendingJobs(limit: number): Promise<AgentJob[]>;
  /** Insert the agent_action; when a message is present, insert it too and link
   *  both directions (message.agent_action_id + action.executed_message_id).
   *  Returns the new action id. */
  persistResult(action: AgentActionDraft, message: MessageDraft | null): Promise<{
    actionId: string;
    messageId: string | null;
  }>;
  markJobDone(jobId: string, status: "done" | "skipped"): Promise<void>;
  markJobFailed(jobId: string, error: string): Promise<void>;
}

export interface ProcessSummary {
  processed: number;
  executed: number;
  proposed: number;
  skipped: number;
  failed: number;
}

/** Process one already-leased job end-to-end (decide + persist + mark). */
export async function processJob(deps: RunDeps, job: AgentJob): Promise<RunResult> {
  try {
    const result = await runJob(deps, job);
    if (result.kind === "skipped") {
      await deps.repo.markJobDone(job.id, "skipped");
      return result;
    }
    await deps.repo.persistResult(result.action, result.message);
    await deps.repo.markJobDone(job.id, "done");
    return result;
  } catch (err) {
    await deps.repo.markJobFailed(job.id, (err as Error).message ?? String(err));
    throw err;
  }
}

/** Lease a batch and process each job, isolating per-job failures. */
export async function processBatch(deps: RunDeps, batchSize = 10): Promise<ProcessSummary> {
  const jobs = await deps.repo.leasePendingJobs(batchSize);
  const summary: ProcessSummary = {
    processed: 0,
    executed: 0,
    proposed: 0,
    skipped: 0,
    failed: 0,
  };
  for (const job of jobs) {
    summary.processed++;
    try {
      const result = await processJob(deps, job);
      if (result.kind === "skipped") summary.skipped++;
      else if (result.action.status === "executed") summary.executed++;
      else summary.proposed++;
    } catch {
      summary.failed++; // already marked failed in processJob
    }
  }
  return summary;
}
