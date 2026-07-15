// Prompt builder for the Front Desk / Booking Manager roles. Pure + deterministic
// (given a fixed context) so it snapshot-tests cleanly. The system prompt encodes
// INKD's hard rules; the user prompt is entirely assembled from tool output, so
// the model is never handed a fact it can't ground against.

import { ACTION_CLASSES, ACTION_TYPES } from "./agent-contract.ts";
import {
  formatCents,
  type ArtistContext,
  type PlaybookEntry,
} from "./agent-tools.ts";

/** The JSON envelope the model must emit — described in-prompt AND enforced by
 * the strict parser (see parseAgentOutput). */
export const OUTPUT_SCHEMA = {
  action_type: ACTION_TYPES,
  action_class: ACTION_CLASSES,
  reasoning_summary: "1–2 plain sentences, no jargon",
  draft_text: "string, required for reply.draft / reply.autosend",
  proposed_slots: "array of { starts_at, ends_at } — only for booking.propose_slots",
  escalation_reason: "string, required for flag.handoff",
} as const;

function toneLine(playbook: PlaybookEntry[]): string {
  const tone = playbook.find((p) => p.category === "tone");
  return tone ? tone.content.trim() : "warm, concise, and professional";
}

/**
 * INKD's non-negotiable operating rules for the AI staff (SPEC §5). These live
 * in the SYSTEM prompt, above any artist-specific data, and the deterministic
 * policy engine enforces the tiering regardless of what the model returns.
 */
export function buildSystemPrompt(ctx: ArtistContext): string {
  const role = ctx.trigger.kind === "booking_request" ? "Booking Manager" : "Front Desk";
  const artist = ctx.profile?.display_name ?? "the artist";
  const tone = toneLine(ctx.playbook);

  return [
    `You are the ${role}, an operations assistant working for ${artist}, an independent tattoo artist on INKD.`,
    `You are staff, not the artist. You handle inbound client messages and booking requests.`,
    ``,
    `HARD RULES (never break these):`,
    `1. GROUNDING: Never state a price, deposit, date, or time that is not present in the CONTEXT below. If you don't have a fact, say you'll check with ${artist} — do not guess.`,
    `2. You do NOT make tattoo art and you never discuss any design as your own creation. You are an assistant, not the artist.`,
    `3. ESCALATE to the artist (action_type "flag.handoff") for anything involving: medical issues, minors, complaints or conflict, harassment, payment/refund/deposit disputes, sharing or requesting payment-card details, identity verification, or anything you are unsure about. Prepare a note; never resolve these yourself.`,
    `4. Never promise a specific appointment as confirmed. You may PROPOSE times (action_type "booking.propose_slots"); the artist confirms.`,
    `5. Be ${tone}. Keep replies short and human. No emoji unless the client uses them first.`,
    ``,
    `HOW TO ACT:`,
    `- Answering a question from the published facts below → "reply.autosend" (simple) or "reply.draft", action_class "answer_faq".`,
    `- Collecting missing booking details (placement, size, references, budget) → "reply.draft", action_class "collect_intake".`,
    `- Offering appointment times → "booking.propose_slots", action_class "propose_slots". List candidate slots; the runtime will finalize them from real availability.`,
    `- A quote, only within the artist's allowed range → action_class "quote_in_range". Outside the range → "flag.handoff".`,
    `- Anything in rule 3 → "flag.handoff".`,
    `- Internal note only, nothing to send → "note.log".`,
    ``,
    `OUTPUT: Respond with ONLY a single JSON object, no prose, no code fence, with keys:`,
    `  action_type: one of ${ACTION_TYPES.join(" | ")}`,
    `  action_class: one of ${ACTION_CLASSES.join(" | ")}`,
    `  reasoning_summary: ${OUTPUT_SCHEMA.reasoning_summary}`,
    `  draft_text: ${OUTPUT_SCHEMA.draft_text}`,
    `  proposed_slots: ${OUTPUT_SCHEMA.proposed_slots}`,
    `  escalation_reason: ${OUTPUT_SCHEMA.escalation_reason}`,
  ].join("\n");
}

function servicesBlock(ctx: ArtistContext): string {
  if (ctx.services.length === 0) return "  (no published services)";
  return ctx.services
    .map((s) => {
      const price =
        s.price_type === "quote"
          ? "quote on request"
          : s.price_type === "hourly"
            ? `${formatCents(s.price_cents)}/hr`
            : formatCents(s.price_cents);
      const deposit =
        s.deposit_type === "fixed"
          ? `${formatCents(s.deposit_amount_cents)} deposit`
          : s.deposit_type === "percent"
            ? `${Number(s.deposit_percent) || 0}% deposit`
            : "no deposit";
      return `  - ${s.name} — ${price}, ${deposit}${
        s.duration_minutes ? `, ${s.duration_minutes} min` : ""
      }`;
    })
    .join("\n");
}

function availabilityBlock(ctx: ArtistContext): string {
  if (ctx.bookableDays.length === 0) return "  (no open days in the booking window)";
  return ctx.bookableDays
    .slice(0, 8)
    .map((d) => `  - ${d.date}: ${d.windows.map((w) => `${w.start}–${w.end}`).join(", ")}`)
    .join("\n");
}

function playbookBlock(ctx: ArtistContext): string {
  if (ctx.playbook.length === 0) return "  (no playbook entries yet)";
  return ctx.playbook
    .map((p) => `  - [${p.category}] ${p.title ? p.title + ": " : ""}${p.content}`)
    .join("\n");
}

function triggerBlock(ctx: ArtistContext): string {
  if (ctx.trigger.kind === "booking_request" && ctx.bookingRequest) {
    const b = ctx.bookingRequest;
    const budget =
      b.budget_min_cents != null || b.budget_max_cents != null
        ? `${formatCents(b.budget_min_cents)}–${formatCents(b.budget_max_cents)}`
        : "not given";
    return [
      `NEW BOOKING REQUEST:`,
      `  placement: ${b.placement ?? "—"}`,
      `  size: ${b.size_description ?? "—"}`,
      `  description: ${b.description ?? "—"}`,
      `  budget: ${budget}`,
      `  first tattoo: ${b.is_first_tattoo == null ? "unknown" : b.is_first_tattoo ? "yes" : "no"}`,
      `  medical flags: ${b.has_medical_flags ? "YES — escalate" : "none"}`,
    ].join("\n");
  }
  if (ctx.thread) {
    const lines = ctx.thread.messages
      .map((m) => `  ${m.sender_kind}: ${m.body ?? "(no text)"}`)
      .join("\n");
    return [`CONVERSATION (oldest to newest):`, lines].join("\n");
  }
  return `TRIGGER: ${ctx.trigger.kind} ${ctx.trigger.id} (no detail loaded)`;
}

/** Assemble the user-turn content from tool output. */
export function buildUserPrompt(ctx: ArtistContext): string {
  return [
    `=== PUBLISHED FACTS (your only source of truth) ===`,
    ``,
    `SERVICES & RATES:`,
    servicesBlock(ctx),
    ``,
    `OPEN AVAILABILITY (day: open hours):`,
    availabilityBlock(ctx),
    ``,
    `BOOKING POLICY:`,
    ctx.bookingPolicy
      ? `  window ${ctx.bookingPolicy.booking_window ?? "2_3mo"}, min notice ${ctx.bookingPolicy.min_notice_hours}h${
          ctx.bookingPolicy.require_medical_disclosure ? ", medical disclosure required" : ""
        }`
      : "  (default policy)",
    ``,
    `PLAYBOOK (FAQ / tone / policies):`,
    playbookBlock(ctx),
    ``,
    `=== WHAT YOU'RE RESPONDING TO ===`,
    triggerBlock(ctx),
    ``,
    `Respond now with the single JSON object.`,
  ].join("\n");
}

export interface PromptMessages {
  system: string;
  user: string;
}

export function buildMessages(ctx: ArtistContext): PromptMessages {
  return { system: buildSystemPrompt(ctx), user: buildUserPrompt(ctx) };
}
