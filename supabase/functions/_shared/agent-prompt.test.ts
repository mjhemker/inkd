// Offline snapshot-style tests for the prompt builder. We assert determinism
// (same context -> byte-identical prompt) plus the load-bearing invariants: the
// hard rules, the role, the JSON output keys, and that every published fact is
// rendered from context (so the model can ground against it).
//   node --test supabase/functions/_shared/agent-prompt.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildMessages, buildSystemPrompt, buildUserPrompt } from "./agent-prompt.ts";
import type { ArtistContext } from "./agent-tools.ts";

function messageContext(): ArtistContext {
  return {
    artistId: "artist-1",
    trigger: { kind: "message", id: "m1" },
    settings: {
      autonomy: "assisted",
      action_class_overrides: null,
      escalation_keywords: [],
      quote_min_cents: null,
      quote_max_cents: null,
      front_desk_enabled: true,
      booking_manager_enabled: true,
      client_disclosure_enabled: false,
    },
    profile: {
      display_name: "Nova Ink",
      handle: "nova",
      tagline: "Fine-line specialist",
      bio: null,
      classification: "independent",
    },
    services: [
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
    ],
    availability: { rules: [], blocks: [], bookingWindow: "2_3mo", minNoticeHours: 24 },
    bookableDays: [{ date: "2026-07-20", weekday: 1, windows: [{ start: "10:00", end: "18:00" }] }],
    bookingPolicy: {
      booking_window: "2_3mo",
      allow_image_uploads: true,
      allow_document_uploads: true,
      require_medical_disclosure: false,
      min_notice_hours: 24,
    },
    playbook: [{ title: "Tone", category: "tone", content: "warm and brief" }],
    thread: {
      id: "thread-1",
      subject: null,
      messages: [{ sender_kind: "client", body: "What are your hours?", created_at: "2026-07-13T00:00:00Z" }],
    },
    bookingRequest: null,
    contextUsed: [],
  };
}

test("system prompt: Front Desk role + all five hard rules + JSON keys", () => {
  const sys = buildSystemPrompt(messageContext());
  assert.ok(sys.includes("Front Desk"));
  assert.ok(sys.includes("GROUNDING: Never state a price"));
  assert.ok(sys.includes("you never discuss any design as your own"));
  assert.ok(sys.includes("ESCALATE"));
  assert.ok(sys.includes("Never promise a specific appointment as confirmed"));
  // the artist tone from the playbook is injected
  assert.ok(sys.includes("warm and brief"));
  // JSON output contract keys
  for (const key of [
    "action_type",
    "action_class",
    "reasoning_summary",
    "draft_text",
    "proposed_slots",
    "escalation_reason",
  ]) {
    assert.ok(sys.includes(key), `system prompt missing key ${key}`);
  }
});

test("system prompt: Booking Manager role for a booking_request trigger", () => {
  const ctx = messageContext();
  ctx.trigger = { kind: "booking_request", id: "br-1" };
  assert.ok(buildSystemPrompt(ctx).includes("Booking Manager"));
});

test("user prompt: renders services, availability, policy, playbook, conversation", () => {
  const user = buildUserPrompt(messageContext());
  assert.ok(user.includes("1-hour session"));
  assert.ok(user.includes("$200.00"));
  assert.ok(user.includes("$50.00 deposit"));
  assert.ok(user.includes("2026-07-20"));
  assert.ok(user.includes("10:00–18:00"));
  assert.ok(user.includes("What are your hours?"));
  assert.ok(user.includes("[tone]"));
});

test("prompt building is deterministic (snapshot-stable)", () => {
  const a = buildMessages(messageContext());
  const b = buildMessages(messageContext());
  assert.equal(a.system, b.system);
  assert.equal(a.user, b.user);
});
