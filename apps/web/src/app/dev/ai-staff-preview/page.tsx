"use client";

/**
 * Dev-only preview harness for the AI staff trust surfaces (approvals inbox,
 * activity ledger, playbook editor, staff overview). Renders the REAL
 * `AiStaffView` against a mock Supabase client seeded with the same contract
 * shapes the runtime writes — so every code path (approve, edit-then-send,
 * reject, provenance, tier stamps) runs without the live DB. Never linked from
 * product nav.
 */
import { Suspense } from "react";
import { InkdProvider } from "@inkd/core/hooks";
import { ToastProvider } from "@inkd/ui/web";
import { AiStaffView } from "@/components/ai-staff/AiStaffView";
import { AiStaffDashboardCard } from "@/components/ai-staff/AiStaffDashboardCard";
import { createMockAiStaffClient, type AiStaffSeed } from "./mockAiStaffClient";

const NOW = new Date("2026-07-15T20:00:00.000Z");
const PROFILE_ID = "demo-profile-jayden";
const ARTIST_ID = "demo-artist-jayden";
const THREAD_A = "demo-thread-a";
const THREAD_B = "demo-thread-b";
const THREAD_C = "demo-thread-c";

function hoursAgo(h: number): string {
  return new Date(NOW.getTime() - h * 60 * 60 * 1000).toISOString();
}
function inDays(d: number, hour: number): { starts_at: string; ends_at: string } {
  const start = new Date(NOW);
  start.setDate(start.getDate() + d);
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start);
  end.setHours(hour + 4);
  return { starts_at: start.toISOString(), ends_at: end.toISOString() };
}

const messages = [
  {
    id: "msg-q1",
    thread_id: THREAD_A,
    sender_kind: "client",
    body: "Hey! How much for a half-day session on a forearm? And do you take a deposit?",
    created_at: hoursAgo(0.6),
    is_read: true,
  },
  {
    id: "msg-q2",
    thread_id: THREAD_B,
    sender_kind: "client",
    body: "Do you do cover-ups of old script tattoos? I have one on my wrist I'd love to redo.",
    created_at: hoursAgo(1.4),
    is_read: true,
  },
  {
    id: "msg-q3",
    thread_id: THREAD_C,
    sender_kind: "client",
    body: "I'm on blood thinners for a heart condition — is that a problem for getting tattooed?",
    created_at: hoursAgo(2.2),
    is_read: true,
  },
];

const agentActions = [
  // ── Proposed: two reply.drafts (tier 1) ────────────────────────────────────
  {
    id: "act-draft-1",
    artist_id: ARTIST_ID,
    agent_role: "front_desk",
    thread_id: THREAD_A,
    action_type: "reply.draft",
    tier: 1,
    status: "proposed",
    reasoning_summary:
      "They asked your half-day rate and deposit terms — both are in your published pricing, so I drafted a direct answer. I didn't quote anything you haven't set.",
    data_consulted: [],
    payload: {
      thread_id: THREAD_A,
      draft_text:
        "Hey! A half-day session (up to 4 hours) is $600, and I take a $100 deposit to lock in your date — it comes off your total on the day. Want me to check some openings for you?",
      context_used: [
        { source: "services", detail: "Half-day session (4 hrs) — $600" },
        { source: "booking_policy", detail: "Deposit: $100, applied to session total" },
      ],
      trigger: { kind: "message", id: "msg-q1" },
    },
    created_at: hoursAgo(0.5),
  },
  {
    id: "act-draft-2",
    artist_id: ARTIST_ID,
    agent_role: "front_desk",
    thread_id: THREAD_B,
    action_type: "reply.draft",
    tier: 1,
    status: "proposed",
    reasoning_summary:
      "Cover-ups are covered in your playbook, so I answered from that and pointed them toward a consult, which your policy recommends for cover-ups.",
    data_consulted: [],
    payload: {
      thread_id: THREAD_B,
      draft_text:
        "Yes — cover-ups are one of my favorite things to do, and old script covers really well. Best first step is a quick consult so I can see the piece and talk through options. Want me to set one up?",
      context_used: [
        { source: "playbook", detail: "Cover-ups: yes, consult-first for anything over 2\"" },
        { source: "services", detail: "Consultation — 30 min, free" },
      ],
      trigger: { kind: "message", id: "msg-q2" },
    },
    created_at: hoursAgo(1.3),
  },
  // ── Proposed: booking.propose_slots (tier 2) ───────────────────────────────
  {
    id: "act-slots-1",
    artist_id: ARTIST_ID,
    agent_role: "booking_manager",
    thread_id: THREAD_A,
    booking_request_id: "demo-booking-req-1",
    action_type: "booking.propose_slots",
    tier: 2,
    status: "proposed",
    reasoning_summary:
      "They're ready to book a half-day. I pulled three open 4-hour windows from your calendar that fit the session length and your lead time. Nothing is held until you confirm.",
    data_consulted: [],
    payload: {
      booking_request_id: "demo-booking-req-1",
      thread_id: THREAD_A,
      proposed_slots: [inDays(6, 11), inDays(9, 13), inDays(13, 11)],
      context_used: [
        { source: "availability", detail: "Open 4-hr windows, next 2 weeks" },
        { source: "services", detail: "Half-day session — 4 hrs" },
        { source: "booking_policy", detail: "Lead time: 48 hrs minimum" },
      ],
      trigger: { kind: "booking_request", id: "demo-booking-req-1" },
    },
    created_at: hoursAgo(0.4),
  },
  // ── Proposed: flag.handoff (medical → tier 3) ──────────────────────────────
  {
    id: "act-handoff-1",
    artist_id: ARTIST_ID,
    agent_role: "front_desk",
    thread_id: THREAD_C,
    action_type: "flag.handoff",
    tier: 3,
    status: "proposed",
    reasoning_summary:
      "This mentions a heart condition and blood thinners — that's a medical question I'm not allowed to answer. I've prepared a safe, warm holding reply, but I won't send anything until you decide.",
    data_consulted: [],
    payload: {
      thread_id: THREAD_C,
      draft_text:
        "Thanks for flagging that — I want to make sure we do this safely. Let me get back to you personally on the best way forward.",
      context_used: [
        { source: "playbook", detail: "Escalate: anything medical, always hand to artist" },
      ],
      trigger: { kind: "message", id: "msg-q3" },
    },
    created_at: hoursAgo(2.1),
  },
  // ── Executed: three tier-1 autosends ───────────────────────────────────────
  {
    id: "act-auto-1",
    artist_id: ARTIST_ID,
    agent_role: "front_desk",
    thread_id: THREAD_A,
    action_type: "reply.autosend",
    tier: 1,
    status: "executed",
    reasoning_summary: "Standard hours question — answered straight from your published hours.",
    data_consulted: [],
    payload: {
      thread_id: THREAD_A,
      draft_text: "I'm in the shop Tuesday–Saturday, 11am–7pm. Sundays and Mondays I'm off!",
      context_used: [{ source: "availability", detail: "Hours: Tue–Sat 11:00–19:00" }],
      trigger: { kind: "message", id: "msg-auto-1" },
    },
    result: { executed_message_id: "sent-1" },
    created_at: hoursAgo(20),
  },
  {
    id: "act-auto-2",
    artist_id: ARTIST_ID,
    agent_role: "front_desk",
    thread_id: THREAD_B,
    action_type: "reply.autosend",
    tier: 1,
    status: "executed",
    reasoning_summary: "Location question — sent your published studio address.",
    data_consulted: [],
    payload: {
      thread_id: THREAD_B,
      draft_text:
        "I'm at Ironline Studio, 214 Read St in Baltimore — street parking is easiest on the north side.",
      context_used: [{ source: "profile", detail: "Studio: Ironline, 214 Read St, Baltimore MD" }],
      trigger: { kind: "message", id: "msg-auto-2" },
    },
    result: { executed_message_id: "sent-2" },
    created_at: hoursAgo(27),
  },
  {
    id: "act-auto-3",
    artist_id: ARTIST_ID,
    agent_role: "front_desk",
    thread_id: THREAD_C,
    action_type: "reply.autosend",
    tier: 1,
    status: "executed",
    reasoning_summary: "Aftercare follow-up the day after a session — sent your standard aftercare note.",
    data_consulted: [],
    payload: {
      thread_id: THREAD_C,
      draft_text:
        "Hope the new piece is settling in! Keep it clean, moisturize lightly 2–3x a day, and no pools or direct sun for two weeks. Message me if anything looks off.",
      context_used: [{ source: "playbook", detail: "Aftercare: standard healing instructions" }],
      trigger: { kind: "message", id: "msg-auto-3" },
    },
    result: { executed_message_id: "sent-3" },
    created_at: hoursAgo(40),
  },
  // ── Rejected ───────────────────────────────────────────────────────────────
  {
    id: "act-rejected-1",
    artist_id: ARTIST_ID,
    agent_role: "front_desk",
    thread_id: THREAD_B,
    action_type: "reply.draft",
    tier: 1,
    status: "rejected",
    reasoning_summary: "Drafted a quick turnaround estimate for a large back piece.",
    data_consulted: [],
    payload: {
      thread_id: THREAD_B,
      draft_text: "A full back piece usually takes around 3 sessions — we could probably wrap it in a month or so.",
      context_used: [{ source: "services", detail: "Full-day session — 8 hrs, $1200" }],
      trigger: { kind: "message", id: "msg-rej-1" },
    },
    result: { rejected_reason: "Too optimistic on timeline — a back piece is more like 5–6 sessions for me." },
    created_at: hoursAgo(48),
  },
];

const playbooks = [
  {
    id: "pb-1",
    artist_id: ARTIST_ID,
    title: "Do you do cover-ups?",
    category: "faq",
    content:
      "Yes. Old script and small dark pieces cover well. Anything over 2 inches needs a consult first so I can see it in person and set expectations on what's possible.",
    source: "manual",
    is_active: true,
    priority: 10,
    created_at: hoursAgo(300),
  },
  {
    id: "pb-2",
    artist_id: ARTIST_ID,
    title: "Deposits & rescheduling",
    category: "policy",
    content:
      "A $100 deposit locks in the date and comes off the session total. Reschedules are fine with 48 hours' notice; inside 48 hours the deposit is forfeit.",
    source: "onboarding",
    is_active: true,
    priority: 8,
    created_at: hoursAgo(300),
  },
  {
    id: "pb-3",
    artist_id: ARTIST_ID,
    title: "Tone",
    category: "tone",
    content:
      "Warm, direct, a little playful. Short sentences. Never pushy about booking — offer, don't chase.",
    source: "onboarding",
    is_active: true,
    priority: 6,
    created_at: hoursAgo(300),
  },
  {
    id: "pb-4",
    artist_id: ARTIST_ID,
    title: "Always escalate",
    category: "policy",
    content:
      "Anything medical (conditions, medications, healing problems), anyone under 18, complaints, or aggressive messages — hand to me. Never answer medical or legal questions.",
    source: "manual",
    is_active: true,
    priority: 10,
    created_at: hoursAgo(300),
  },
];

const seed: AiStaffSeed = {
  profileId: PROFILE_ID,
  profile: {
    id: PROFILE_ID,
    handle: "jayden.ink",
    display_name: "Jayden Cole",
    is_artist: true,
    is_public: true,
    city: "Baltimore",
    state: "MD",
    created_at: hoursAgo(1000),
    updated_at: hoursAgo(1000),
  },
  artistProfile: {
    id: ARTIST_ID,
    profile_id: PROFILE_ID,
    is_published: true,
    created_at: hoursAgo(1000),
    updated_at: hoursAgo(1000),
  },
  agentSettings: {
    id: "settings-1",
    artist_id: ARTIST_ID,
    autonomy: "assisted",
    action_class_overrides: {},
    front_desk_enabled: true,
    booking_manager_enabled: true,
    studio_manager_enabled: false,
    growth_advisor_enabled: false,
    client_disclosure_enabled: false,
    escalation_keywords: [],
    quote_min_cents: null,
    quote_max_cents: null,
    created_at: hoursAgo(1000),
    updated_at: hoursAgo(1000),
  },
  agentActions,
  playbooks,
  messages,
};

const mockClient = createMockAiStaffClient(seed);

export default function AiStaffPreviewPage() {
  return (
    <InkdProvider client={mockClient}>
      <ToastProvider>
        <div className="min-h-dvh bg-surface-base text-content-primary">
          <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-10">
            <section data-testid="dashboard-card-preview" className="max-w-md">
              <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-content-muted">
                Dashboard card (wired to real data)
              </p>
              <AiStaffDashboardCard />
            </section>
            <Suspense fallback={null}>
              <AiStaffView />
            </Suspense>
          </main>
        </div>
      </ToastProvider>
    </InkdProvider>
  );
}
