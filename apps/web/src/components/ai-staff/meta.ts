/**
 * Presentation metadata for the AI staff trust surfaces — the honest labels
 * that turn a raw agent_actions row into "staff that show their work": tier
 * stamps, action-type language, provenance source names, status marks, and the
 * staff nameplates. Kept declarative so web + copy stay in one place.
 */
import type { IconName } from "@inkd/ui/web";
import type {
  AgentActionStatus,
  AgentActionType,
  AgentContextEntry,
  AgentRole,
} from "@inkd/core";

export interface TierMeta {
  stamp: string;
  label: string;
}

/** Tier is the deterministic policy tier — stamped in mono on every card. */
export const TIER_META: Record<number, TierMeta> = {
  1: { stamp: "TIER 1", label: "answers from your published info" },
  2: { stamp: "TIER 2", label: "converses, then asks you to confirm" },
  3: { stamp: "TIER 3", label: "prepared for you — never sent on its own" },
};

export interface ActionTypeMeta {
  label: string;
  icon: IconName;
  /** One-line plain-language gloss of what this kind of action is. */
  blurb: string;
}

export const ACTION_TYPE_META: Record<AgentActionType, ActionTypeMeta> = {
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

export function actionTypeMeta(type: string): ActionTypeMeta {
  return (
    ACTION_TYPE_META[type as AgentActionType] ?? {
      label: type,
      icon: "sparkles",
      blurb: "",
    }
  );
}

export interface StatusMeta {
  label: string;
  variant: "neutral" | "brand" | "ember" | "success" | "warning" | "danger" | "info";
}

export const STATUS_META: Record<AgentActionStatus, StatusMeta> = {
  proposed: { label: "Awaiting you", variant: "warning" },
  approved: { label: "Approved", variant: "info" },
  executed: { label: "Sent", variant: "success" },
  rejected: { label: "Dismissed", variant: "neutral" },
  failed: { label: "Failed", variant: "danger" },
  superseded: { label: "Superseded", variant: "neutral" },
};

/** Mono provenance source labels — the "FROM YOUR RATES" stamp. */
export const CONTEXT_SOURCE_LABEL: Record<AgentContextEntry["source"], string> = {
  services: "FROM YOUR RATES",
  availability: "FROM YOUR AVAILABILITY",
  booking_policy: "FROM YOUR BOOKING POLICY",
  playbook: "FROM YOUR PLAYBOOK",
  profile: "FROM YOUR PROFILE",
};

export interface StaffMeta {
  role: AgentRole;
  name: string;
  title: string;
  icon: IconName;
}

/** The two v1 staff, presented as people with mono nameplates. */
export const STAFF: StaffMeta[] = [
  {
    role: "front_desk",
    name: "Front Desk",
    title: "Triages inbound messages, answers from your published info",
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

/** Deep link for an action's linked thread / booking, or null. */
export function actionDeepLink(action: {
  thread_id: string | null;
  booking_request_id: string | null;
  booking_id: string | null;
}): { href: string; label: string } | null {
  if (action.thread_id)
    return { href: `/messages/${action.thread_id}`, label: "Open thread" };
  if (action.booking_id)
    return { href: `/bookings/${action.booking_id}`, label: "Open booking" };
  if (action.booking_request_id)
    return {
      href: `/bookings/requests/${action.booking_request_id}`,
      label: "Open request",
    };
  return null;
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
  const diffMs = now.getTime() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
