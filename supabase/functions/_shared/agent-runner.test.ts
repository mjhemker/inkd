// Offline end-to-end tests for the runtime orchestrator: context -> prompt ->
// (fake) model -> policy -> persistable plan, plus batch leasing/dedupe. Uses an
// in-memory fake repo + a scripted fake model — no DB, no network.
//   node --test supabase/functions/_shared/agent-runner.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  processBatch,
  runJob,
  type AgentActionDraft,
  type AgentJob,
  type JobRepo,
  type MessageDraft,
} from "./agent-runner.ts";
import type {
  AgentSettingsFacts,
  AvailabilityFacts,
  BookingPolicyFacts,
  BookingRequestFacts,
  ContextRepo,
  PlaybookEntry,
  ProfileFacts,
  ServiceFact,
  ThreadFacts,
} from "./agent-tools.ts";
import type { ModelClient, ModelRequest } from "./agent-model.ts";

const NOW = new Date("2026-07-13T00:00:00Z"); // a Monday

class ScriptedModel implements ModelClient {
  private script: string[];
  constructor(script: string[]) {
    this.script = script;
  }
  generate(_req: ModelRequest): Promise<string> {
    const next = this.script.shift();
    return Promise.resolve(next ?? "no more script");
  }
}

interface FakeState {
  settings: AgentSettingsFacts;
  services: ServiceFact[];
  bookingRequest?: BookingRequestFacts | null;
  threadMessages?: { sender_kind: string; body: string | null; created_at: string }[];
}

function makeSettings(over: Partial<AgentSettingsFacts> = {}): AgentSettingsFacts {
  return {
    autonomy: "assisted",
    action_class_overrides: null,
    escalation_keywords: [],
    quote_min_cents: null,
    quote_max_cents: null,
    front_desk_enabled: true,
    booking_manager_enabled: true,
    client_disclosure_enabled: false,
    ...over,
  };
}

const SERVICES: ServiceFact[] = [
  {
    id: "svc-1",
    name: "1-hour session",
    description: "One hour in the chair.",
    duration_minutes: 60,
    price_type: "fixed",
    price_cents: 20000,
    deposit_type: "fixed",
    deposit_amount_cents: 5000,
    deposit_percent: null,
  },
];

const AVAILABILITY: AvailabilityFacts = {
  rules: [1, 2, 3, 4, 5, 6].map((w) => ({
    weekday: w,
    start_time: "10:00",
    end_time: "18:00",
    is_open: true,
  })),
  blocks: [],
  bookingWindow: "2_3mo",
  minNoticeHours: 24,
};

const POLICY: BookingPolicyFacts = {
  booking_window: "2_3mo",
  allow_image_uploads: true,
  allow_document_uploads: true,
  require_medical_disclosure: false,
  min_notice_hours: 24,
};

const PLAYBOOK: PlaybookEntry[] = [
  { title: "Tone", category: "tone", content: "warm and brief", },
];

/** In-memory fake implementing both IO contracts. Records everything persisted. */
class FakeRepo implements ContextRepo, JobRepo {
  jobs: (AgentJob & { status: string })[] = [];
  persisted: { action: AgentActionDraft; message: MessageDraft | null }[] = [];
  jobStatus = new Map<string, string>();
  private state: FakeState;

  constructor(state: FakeState) {
    this.state = state;
  }

  // ContextRepo
  readAgentSettings(): Promise<AgentSettingsFacts | null> {
    return Promise.resolve(this.state.settings);
  }
  readProfile(): Promise<ProfileFacts | null> {
    return Promise.resolve({
      display_name: "Nova Ink",
      handle: "nova",
      tagline: "Fine-line specialist",
      bio: null,
      classification: "independent",
    });
  }
  readServices(): Promise<ServiceFact[]> {
    return Promise.resolve(this.state.services);
  }
  readAvailability(): Promise<AvailabilityFacts> {
    return Promise.resolve(AVAILABILITY);
  }
  readBookingPolicy(): Promise<BookingPolicyFacts | null> {
    return Promise.resolve(POLICY);
  }
  readPlaybook(): Promise<PlaybookEntry[]> {
    return Promise.resolve(PLAYBOOK);
  }
  readThread(threadId: string): Promise<ThreadFacts | null> {
    return Promise.resolve({
      id: threadId,
      subject: null,
      messages:
        this.state.threadMessages ??
        [{ sender_kind: "client", body: "What are your hours?", created_at: NOW.toISOString() }],
    });
  }
  readBookingRequest(id: string): Promise<BookingRequestFacts | null> {
    return Promise.resolve(
      this.state.bookingRequest ?? {
        id,
        service_id: "svc-1",
        placement: "forearm",
        size_description: "palm-sized",
        description: "floral piece",
        budget_min_cents: 20000,
        budget_max_cents: 40000,
        has_medical_flags: false,
        is_first_tattoo: true,
      },
    );
  }

  // JobRepo
  clientIdForThread(): Promise<string | null> {
    return Promise.resolve("client-1");
  }
  clientIdForBookingRequest(): Promise<string | null> {
    return Promise.resolve("client-1");
  }
  leasePendingJobs(limit: number): Promise<AgentJob[]> {
    const leased = this.jobs
      .filter((j) => j.status === "pending" && j.attempts < j.max_attempts)
      .slice(0, limit);
    for (const j of leased) {
      j.status = "running";
      j.attempts += 1;
    }
    return Promise.resolve(leased.map(({ status: _s, ...rest }) => rest));
  }
  persistResult(action: AgentActionDraft, message: MessageDraft | null) {
    this.persisted.push({ action, message });
    return Promise.resolve({ actionId: `act-${this.persisted.length}`, messageId: message ? "msg-1" : null });
  }
  markJobDone(jobId: string, status: "done" | "skipped"): Promise<void> {
    this.jobStatus.set(jobId, status);
    const j = this.jobs.find((x) => x.id === jobId);
    if (j) j.status = status;
    return Promise.resolve();
  }
  markJobFailed(jobId: string, error: string): Promise<void> {
    this.jobStatus.set(jobId, `failed:${error}`);
    const j = this.jobs.find((x) => x.id === jobId);
    if (j) j.status = "failed";
    return Promise.resolve();
  }
}

function messageJob(over: Partial<AgentJob> = {}): AgentJob {
  return {
    id: "job-1",
    artist_id: "artist-1",
    trigger_kind: "message",
    trigger_id: "msg-in-1",
    thread_id: "thread-1",
    booking_request_id: null,
    attempts: 0,
    max_attempts: 3,
    ...over,
  };
}

function bookingJob(over: Partial<AgentJob> = {}): AgentJob {
  return {
    id: "job-b",
    artist_id: "artist-1",
    trigger_kind: "booking_request",
    trigger_id: "br-1",
    thread_id: null,
    booking_request_id: "br-1",
    attempts: 0,
    max_attempts: 3,
    ...over,
  };
}

function reply(draft: string, cls = "answer_faq"): string {
  return JSON.stringify({
    action_type: "reply.autosend",
    action_class: cls,
    reasoning_summary: "Answered from published info.",
    draft_text: draft,
  });
}

// --- decisions --------------------------------------------------------------
test("assisted tier-1 grounded reply -> executed + agent message posted", async () => {
  const repo = new FakeRepo({ settings: makeSettings({ autonomy: "assisted" }), services: SERVICES });
  const model = new ScriptedModel([reply("We're open Tuesday to Saturday — come by any time that week.")]);
  const res = await runJob({ repo, model, now: NOW }, messageJob());
  assert.equal(res.kind, "action");
  if (res.kind !== "action") return;
  assert.equal(res.action.tier, 1);
  assert.equal(res.action.status, "executed");
  assert.ok(res.message);
  assert.equal(res.message?.sender_kind, "agent");
  assert.equal(res.message?.drafted_by_agent, true);
  // Contract: context_used + trigger are recorded on the payload.
  assert.ok(res.action.payload.context_used.length > 0);
  assert.equal(res.action.payload.trigger.kind, "message");
});

test("draft_only -> tier-1 reply is proposed, no message", async () => {
  const repo = new FakeRepo({ settings: makeSettings({ autonomy: "draft_only" }), services: SERVICES });
  const model = new ScriptedModel([reply("We're open Tuesday to Saturday.")]);
  const res = await runJob({ repo, model, now: NOW }, messageJob());
  assert.equal(res.kind, "action");
  if (res.kind !== "action") return;
  assert.equal(res.action.status, "proposed");
  assert.equal(res.message, null);
});

test("grounding downgrade: an invented price forces proposed even under assisted", async () => {
  const repo = new FakeRepo({ settings: makeSettings({ autonomy: "assisted" }), services: SERVICES });
  const model = new ScriptedModel([reply("Today only, sessions are $5.00!")]);
  const res = await runJob({ repo, model, now: NOW }, messageJob());
  assert.equal(res.kind, "action");
  if (res.kind !== "action") return;
  assert.equal(res.action.status, "proposed");
  assert.equal(res.message, null);
  assert.equal(res.policy.grounding.grounded, false);
});

test("booking request -> booking_manager proposes slots grounded from real availability", async () => {
  const repo = new FakeRepo({ settings: makeSettings({ autonomy: "managed" }), services: SERVICES });
  const model = new ScriptedModel([
    JSON.stringify({
      action_type: "booking.propose_slots",
      action_class: "propose_slots",
      reasoning_summary: "Offered a few openings.",
      proposed_slots: [{ starts_at: "2099-01-01T00:00:00Z", ends_at: "2099-01-01T01:00:00Z" }],
    }),
  ]);
  const res = await runJob({ repo, model, now: NOW }, bookingJob());
  assert.equal(res.kind, "action");
  if (res.kind !== "action") return;
  assert.equal(res.action.agent_role, "booking_manager");
  assert.equal(res.action.tier, 2);
  assert.equal(res.action.status, "proposed"); // tier 2 under managed is proposed
  const slots = res.action.payload.proposed_slots ?? [];
  assert.ok(slots.length > 0);
  // The runner replaces the model's fantasy date with a REAL availability slot.
  assert.notEqual(slots[0].starts_at, "2099-01-01T00:00:00Z");
  assert.ok(slots[0].starts_at.startsWith("2026-07-"));
});

test("role disabled -> skipped", async () => {
  const repo = new FakeRepo({
    settings: makeSettings({ front_desk_enabled: false }),
    services: SERVICES,
  });
  const model = new ScriptedModel([reply("hi")]);
  const res = await runJob({ repo, model, now: NOW }, messageJob());
  assert.equal(res.kind, "skipped");
});

test("model parse failure (twice) -> graceful flag.handoff, tier 3, proposed", async () => {
  const repo = new FakeRepo({ settings: makeSettings({ autonomy: "managed" }), services: SERVICES });
  const model = new ScriptedModel(["garbage", "still garbage"]);
  const res = await runJob({ repo, model, now: NOW }, messageJob());
  assert.equal(res.kind, "action");
  if (res.kind !== "action") return;
  assert.equal(res.action.action_type, "flag.handoff");
  assert.equal(res.action.tier, 3);
  assert.equal(res.action.status, "proposed");
});

test("forced handoff: booking request with medical flags never reaches the model", async () => {
  const repo = new FakeRepo({
    settings: makeSettings({ autonomy: "managed" }),
    services: SERVICES,
    bookingRequest: {
      id: "br-1",
      service_id: "svc-1",
      placement: "back",
      size_description: "large",
      description: "cover-up",
      budget_min_cents: null,
      budget_max_cents: null,
      has_medical_flags: true,
      is_first_tattoo: false,
    },
  });
  // Empty script: if the model were called it would produce "no more script" and fail to parse.
  const model = new ScriptedModel([]);
  const res = await runJob({ repo, model, now: NOW }, bookingJob());
  assert.equal(res.kind, "action");
  if (res.kind !== "action") return;
  assert.equal(res.action.action_type, "flag.handoff");
  assert.equal(res.action.tier, 3);
});

// --- batch leasing / dedupe -------------------------------------------------
test("processBatch: leases + processes each job once; a second drain leases nothing", async () => {
  const repo = new FakeRepo({ settings: makeSettings({ autonomy: "assisted" }), services: SERVICES });
  repo.jobs = [
    { ...messageJob({ id: "j1", trigger_id: "m1" }), status: "pending" },
    { ...messageJob({ id: "j2", trigger_id: "m2" }), status: "pending" },
  ];
  const model = new ScriptedModel([reply("We're open Tuesday to Saturday."), reply("We're open Tuesday to Saturday.")]);

  const first = await processBatch({ repo, model, now: NOW }, 10);
  assert.equal(first.processed, 2);
  assert.equal(first.executed + first.proposed, 2);
  assert.equal(repo.persisted.length, 2);
  assert.equal(repo.jobStatus.get("j1"), "done");
  assert.equal(repo.jobStatus.get("j2"), "done");

  // Nothing pending now.
  const second = await processBatch({ repo, model, now: NOW }, 10);
  assert.equal(second.processed, 0);
});

test("processBatch: a failing job is marked, others still process", async () => {
  const repo = new FakeRepo({ settings: makeSettings({ autonomy: "assisted" }), services: SERVICES });
  repo.jobs = [{ ...messageJob({ id: "jx", trigger_id: "mx" }), status: "pending" }];
  // Model that throws a NON-parse error (network-like) -> job fails.
  const boom: ModelClient = { generate: () => Promise.reject(new Error("network down")) };
  const summary = await processBatch({ repo, model: boom, now: NOW }, 10);
  assert.equal(summary.processed, 1);
  assert.equal(summary.failed, 1);
  assert.equal(repo.jobs[0].status, "failed");
});
