/**
 * Shared vocabulary + copy for the artist onboarding + settings surfaces.
 * Lives in core so web and mobile render the exact same labels and options.
 */
import type {
  ArtistClassificationEnum,
  AgentAutonomyEnum,
  BookingWindow,
} from "../types/rows";

export const CLASSIFICATIONS: {
  value: ArtistClassificationEnum;
  label: string;
  description: string;
}[] = [
  { value: "shop_owner", label: "Shop owner", description: "You own or run the studio and its chairs." },
  { value: "shop_resident", label: "Shop resident", description: "You work out of someone else's shop." },
  { value: "private_suite", label: "Private suite", description: "A private, appointment-only room." },
  { value: "independent", label: "Independent", description: "You move between spaces or work solo." },
];

export const AUTONOMY_LEVELS: {
  value: AgentAutonomyEnum;
  index: number;
  label: string;
  short: string;
  description: string;
  /** Shown as a small note under the description, settings variant only.
   * Assisted/Managed are the INKD Pro autonomy levels (see api/plan.ts) —
   * pilot artists get them free, and this says so honestly rather than
   * silently upselling. */
  pilotNote?: string;
}[] = [
  { value: "no_ai", index: 0, label: "No AI", short: "Off", description: "Your assistant only organizes behind the scenes — it never touches a client conversation." },
  { value: "draft_only", index: 1, label: "Draft-only", short: "Drafts", description: "Your assistant writes replies and you approve and send every one. The safe place to start." },
  { value: "assisted", index: 2, label: "Assisted", short: "Assisted", description: "Simple answers (hours, policies, reminders) go out on their own. Anything about scheduling or money is drafted for you.", pilotNote: "Included free for pilot artists — this is normally an INKD Pro level." },
  { value: "managed", index: 3, label: "Managed", short: "Managed", description: "Your assistant handles routine replies and proposes bookings for one-tap confirmation. Payments and sensitive calls always stay with you.", pilotNote: "Included free for pilot artists — this is normally an INKD Pro level." },
];

export const AUTONOMY_BY_INDEX: Record<number, AgentAutonomyEnum> = {
  0: "no_ai",
  1: "draft_only",
  2: "assisted",
  3: "managed",
};

export const BOOKING_WINDOWS: {
  value: BookingWindow;
  label: string;
  description: string;
}[] = [
  { value: "1mo", label: "1 month out", description: "Books open ~4 weeks ahead." },
  { value: "2_3mo", label: "2–3 months out", description: "A steady mid-range runway." },
  { value: "4_6mo", label: "4–6 months out", description: "For a longer waitlist." },
  { value: "1yr", label: "Up to a year", description: "Plan far ahead." },
  { value: "closed", label: "Books closed", description: "Not taking new requests right now." },
];

export const WEEKDAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 0, label: "Sunday", short: "Sun" },
];

/** State options — DB enum is MD/PA; "OTHER" persists as a null state. */
export const STATE_OPTIONS = [
  { label: "Maryland", value: "MD" },
  { label: "Pennsylvania", value: "PA" },
  { label: "Other (outside MD/PA)", value: "OTHER" },
];

export interface ServicePreset {
  key: string;
  name: string;
  description: string;
  duration_minutes: number;
  price_type: "fixed" | "hourly" | "starting_at" | "quote";
  /** Starting placeholder in cents — every artist is expected to tune this to
   * their own rate before publishing; it is never charged as-is. */
  price_cents: number | null;
  deposit_type: "none" | "fixed" | "percent";
  deposit_amount_cents: number | null;
  /** Built-in break after the session, in minutes. Omitted/0 = no break. */
  break_time_minutes?: number;
  /** Minimum hours of advance notice required to book this service. */
  lead_time_hours?: number;
  /** Whether this service can be offered over video call (e.g. consults). */
  video_conferencing?: boolean;
}

/**
 * Onboarding "quick add" presets (SPEC §3 step 4). These are TS constants,
 * not DB-seeded — each app's `components/artist/services-editor.tsx` calls
 * `addPreset()` to materialize its own `services` row from one of these, so
 * there is nothing to migrate; changing a value here only affects services
 * added after the change. All prices are starting placeholders the artist
 * is expected to edit to their own rates before publishing.
 */
export const SERVICE_PRESETS: ServicePreset[] = [
  {
    key: "consultation",
    name: "Consultation",
    description: "Talk through placement, size and references before booking.",
    duration_minutes: 30,
    price_type: "fixed",
    price_cents: 0,
    deposit_type: "none",
    deposit_amount_cents: null,
    video_conferencing: true,
  },
  {
    key: "hour_session",
    name: "1-hour session",
    description: "A single hour of tattoo time.",
    duration_minutes: 60,
    price_type: "hourly",
    price_cents: 20000,
    deposit_type: "fixed",
    deposit_amount_cents: 5000,
  },
  {
    key: "half_day",
    name: "Half day",
    description: "About four hours in the chair, with a built-in break.",
    duration_minutes: 240,
    price_type: "fixed",
    price_cents: 60000,
    deposit_type: "fixed",
    deposit_amount_cents: 15000,
    break_time_minutes: 30,
  },
  {
    key: "full_day",
    name: "Full day",
    description: "A full day of work, roughly seven hours with breaks — book ahead.",
    duration_minutes: 420,
    price_type: "fixed",
    price_cents: 105000,
    deposit_type: "fixed",
    deposit_amount_cents: 30000,
    break_time_minutes: 45,
    lead_time_hours: 72,
  },
];

/** Action classes for the per-action-class AI override list (SPEC §5 tiers). */
export const ACTION_CLASSES: {
  key: string;
  label: string;
  tier: 1 | 2 | 3;
  description: string;
}[] = [
  { key: "answer_faq", label: "Answer questions from your published info", tier: 1, description: "Hours, rates, location, policies." },
  { key: "send_reminders", label: "Send appointment reminders", tier: 1, description: "Upcoming sessions and deposit due-dates." },
  { key: "collect_intake", label: "Collect booking details", tier: 1, description: "Placement, size, references, budget." },
  { key: "propose_slots", label: "Propose appointment times", tier: 2, description: "Offer openings and hold a slot." },
  { key: "quote_in_range", label: "Quote within your set range", tier: 2, description: "Only inside the min/max you allow." },
  { key: "reschedule", label: "Reschedule or cancel", tier: 2, description: "Move or drop an existing appointment." },
  { key: "payments", label: "Payments, refunds and discounts", tier: 3, description: "Always you — the assistant only prepares." },
];

export const STEP_META: { key: string; label: string; description: string }[] = [
  { key: "identity", label: "Identity", description: "Name, handle, portfolio" },
  { key: "location", label: "Location", description: "Studio & travel" },
  { key: "booking", label: "Booking", description: "Hours & window" },
  { key: "services", label: "Services", description: "Rates & deposits" },
  { key: "verify", label: "Verify", description: "ID & payouts" },
];
