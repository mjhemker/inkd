/**
 * Presentation metadata for the mobile AI staff screen — the honest labels
 * that turn an agent_actions row into "staff that show their work" (SPEC §5).
 * Mirrors the web `components/ai-staff/meta.ts`.
 */
import type { IconName } from "@inkd/ui/native";
import type {
  AgentActionStatus,
  AgentActionType,
  AgentContextEntry,
  AgentRole,
} from "@inkd/core";

export const TIER_META: Record<number, { stamp: string; label: string }> = {
  1: { stamp: "TIER 1", label: "answers from your published info" },
  2: { stamp: "TIER 2", label: "converses, then asks you to confirm" },
  3: { stamp: "TIER 3", label: "prepared for you — never sent on its own" },
};

export const ACTION_TYPE_META: Record<
  AgentActionType,
  { label: string; icon: IconName; blurb: string }
> = {
  "reply.draft": {
    label: "Draft reply",
    icon: "message-circle",
    blurb: "A reply drafted for your approval",
  },
  "reply.autosend": {
    label: "Auto-sent reply",
    icon: "check",
    blurb: "Sent automatically from your published info",
  },
  "booking.propose_slots": {
    label: "Proposed times",
    icon: "calendar",
    blurb: "Session times pulled from your open availability",
  },
  "flag.handoff": {
    label: "Flagged for you",
    icon: "shield",
    blurb: "Handed off — this one needs a human",
  },
  "note.log": {
    label: "Logged note",
    icon: "clock",
    blurb: "An internal note, nothing sent to the client",
  },
};

export function actionTypeMeta(type: string) {
  return (
    ACTION_TYPE_META[type as AgentActionType] ?? {
      label: type,
      icon: "sparkles" as IconName,
      blurb: "",
    }
  );
}

export const STATUS_META: Record<
  AgentActionStatus,
  { label: string; variant: "neutral" | "warning" | "success" | "danger" | "info" }
> = {
  proposed: { label: "Awaiting you", variant: "warning" },
  approved: { label: "Approved", variant: "info" },
  executed: { label: "Sent", variant: "success" },
  rejected: { label: "Dismissed", variant: "neutral" },
  failed: { label: "Failed", variant: "danger" },
  superseded: { label: "Superseded", variant: "neutral" },
};

export const CONTEXT_SOURCE_LABEL: Record<AgentContextEntry["source"], string> = {
  services: "FROM YOUR RATES",
  availability: "FROM YOUR AVAILABILITY",
  booking_policy: "FROM YOUR BOOKING POLICY",
  playbook: "FROM YOUR PLAYBOOK",
  profile: "FROM YOUR PROFILE",
};

export const STAFF: { role: AgentRole; name: string; title: string; icon: IconName }[] = [
  {
    role: "front_desk",
    name: "Front Desk",
    title: "Triages messages, answers from your published info",
    icon: "message-circle",
  },
  {
    role: "booking_manager",
    name: "Booking Manager",
    title: "Proposes session times, holds, and deposit steps",
    icon: "calendar",
  },
];

export const AUTONOMY_LABEL: Record<string, string> = {
  no_ai: "No-AI",
  draft_only: "Draft-only",
  assisted: "Assisted",
  managed: "Managed",
};

export const PLAYBOOK_CATEGORY_LABEL: Record<string, string> = {
  faq: "FAQ",
  tone: "Tone",
  policy: "Policy",
  pricing: "Pricing",
  aftercare: "Aftercare",
  scheduling: "Scheduling",
  other: "Other",
};

export function staffMeta(role: AgentRole | null) {
  return (
    STAFF.find((s) => s.role === role) ?? {
      role: "front_desk" as AgentRole,
      name: "AI staff",
      title: "",
      icon: "sparkles" as IconName,
    }
  );
}

export function formatSlot(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const day = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const t = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${t(start)} – ${t(end)}`;
}

export function formatRelative(iso: string, now: Date = new Date()): string {
  const mins = Math.round((now.getTime() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
