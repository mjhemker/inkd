// The typed TOOL layer (SPEC §5: "agents can only act through tools"). Each
// read_* tool loads one slice of the artist's structured, published data and
// records exactly what it surfaced into `context_used` — that record is both the
// audit trail and the grounding whitelist (the policy engine will only let the
// agent state a price/date that appears here).
//
// The IO surface is the `ContextRepo` interface: the deployed function backs it
// with the service-role Supabase client; tests pass a fake. This file itself is
// pure (no DB import) so it runs under node --test.

import type { ContextUsedEntry, TriggerRef } from "./agent-contract.ts";
import {
  computeBookableDates,
  type AvailabilityBlockLike,
  type AvailabilityRuleLike,
  type BookableDay,
  type BookingWindow,
} from "./agent-slots.ts";

// ---------------------------------------------------------------------------
// Fact shapes returned by the tools (a curated, published-only view).
// ---------------------------------------------------------------------------
export interface ProfileFacts {
  display_name: string | null;
  handle: string | null;
  tagline: string | null;
  bio: string | null;
  classification: string | null;
}

export interface ServiceFact {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number | null;
  price_type: string;
  price_cents: number | null;
  deposit_type: string;
  deposit_amount_cents: number | null;
  deposit_percent: number | string | null;
}

export interface AvailabilityFacts {
  rules: AvailabilityRuleLike[];
  blocks: AvailabilityBlockLike[];
  bookingWindow: BookingWindow | null;
  minNoticeHours: number | null;
}

export interface BookingPolicyFacts {
  booking_window: BookingWindow | null;
  allow_image_uploads: boolean;
  allow_document_uploads: boolean;
  require_medical_disclosure: boolean;
  min_notice_hours: number;
}

export interface PlaybookEntry {
  title: string | null;
  category: string;
  content: string;
}

export interface ThreadMessageFact {
  sender_kind: string;
  body: string | null;
  created_at: string;
}

export interface ThreadFacts {
  id: string;
  subject: string | null;
  messages: ThreadMessageFact[];
}

export interface BookingRequestFacts {
  id: string;
  service_id: string | null;
  placement: string | null;
  size_description: string | null;
  description: string | null;
  budget_min_cents: number | null;
  budget_max_cents: number | null;
  has_medical_flags: boolean;
  is_first_tattoo: boolean | null;
}

/** Artist-level agent config the runtime needs (autonomy + overrides + ranges). */
export interface AgentSettingsFacts {
  autonomy: "no_ai" | "draft_only" | "assisted" | "managed";
  action_class_overrides: Record<string, string> | null;
  escalation_keywords: string[];
  quote_min_cents: number | null;
  quote_max_cents: number | null;
  front_desk_enabled: boolean;
  booking_manager_enabled: boolean;
  client_disclosure_enabled: boolean;
}

/** The IO contract — the only place the runtime touches the database. */
export interface ContextRepo {
  readAgentSettings(artistId: string): Promise<AgentSettingsFacts | null>;
  readProfile(artistId: string): Promise<ProfileFacts | null>;
  readServices(artistId: string): Promise<ServiceFact[]>;
  readAvailability(artistId: string): Promise<AvailabilityFacts>;
  readBookingPolicy(artistId: string): Promise<BookingPolicyFacts | null>;
  readPlaybook(artistId: string): Promise<PlaybookEntry[]>;
  readThread(threadId: string, limit: number): Promise<ThreadFacts | null>;
  readBookingRequest(id: string): Promise<BookingRequestFacts | null>;
}

// ---------------------------------------------------------------------------
// Assembled context handed to the prompt builder + runner.
// ---------------------------------------------------------------------------
export interface ArtistContext {
  artistId: string;
  trigger: TriggerRef;
  settings: AgentSettingsFacts;
  profile: ProfileFacts | null;
  services: ServiceFact[];
  availability: AvailabilityFacts;
  bookableDays: BookableDay[];
  bookingPolicy: BookingPolicyFacts | null;
  playbook: PlaybookEntry[];
  thread: ThreadFacts | null;
  bookingRequest: BookingRequestFacts | null;
  /** The grounding whitelist + audit record, accumulated across tool calls. */
  contextUsed: ContextUsedEntry[];
}

// ---------------------------------------------------------------------------
// Formatting helpers — these produce the exact strings that both prompt the
// model AND form the grounding whitelist, so money/dates must be rendered here.
// ---------------------------------------------------------------------------
export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

function serviceDetail(s: ServiceFact): string {
  const price =
    s.price_type === "quote"
      ? "quote on request"
      : s.price_type === "hourly"
        ? `${formatCents(s.price_cents)}/hr`
        : s.price_type === "starting_at"
          ? `starting at ${formatCents(s.price_cents)}`
          : formatCents(s.price_cents);
  let deposit = "no deposit";
  if (s.deposit_type === "fixed") deposit = `${formatCents(s.deposit_amount_cents)} deposit`;
  else if (s.deposit_type === "percent") deposit = `${Number(s.deposit_percent) || 0}% deposit`;
  const dur = s.duration_minutes ? `${s.duration_minutes} min` : "flexible length";
  return `${s.name}: ${price}, ${deposit}, ${dur}${
    s.description ? ` — ${s.description}` : ""
  }`;
}

/** Render a bookable day into a grounding-safe detail string. */
function dayDetail(day: BookableDay): string {
  const windows = day.windows.map((w) => `${w.start}–${w.end}`).join(", ");
  return `${day.date} (${windows})`;
}

const SERVICE_DURATION_FALLBACK = 60;

/** Best-guess service duration for slot proposals (booking request's service,
 * else the first service, else 60m). */
export function resolveServiceDuration(ctx: ArtistContext): number {
  const requested = ctx.bookingRequest?.service_id;
  if (requested) {
    const svc = ctx.services.find((s) => s.id === requested);
    if (svc?.duration_minutes) return svc.duration_minutes;
  }
  const first = ctx.services.find((s) => s.duration_minutes);
  return first?.duration_minutes ?? SERVICE_DURATION_FALLBACK;
}

// ---------------------------------------------------------------------------
// collectContext — run the tools for one job, recording context_used as we go.
// ---------------------------------------------------------------------------
export interface CollectOptions {
  /** Last N messages to pull for a thread trigger (default 12). */
  threadMessageLimit?: number;
  /** Anchor "now" for availability projection. Injectable for tests. */
  now?: Date;
}

export async function collectContext(
  repo: ContextRepo,
  args: { artistId: string; trigger: TriggerRef; threadId?: string; bookingRequestId?: string },
  opts: CollectOptions = {},
): Promise<ArtistContext> {
  const contextUsed: ContextUsedEntry[] = [];
  const threadLimit = opts.threadMessageLimit ?? 12;

  const settings =
    (await repo.readAgentSettings(args.artistId)) ??
    ({
      autonomy: "draft_only",
      action_class_overrides: null,
      escalation_keywords: [],
      quote_min_cents: null,
      quote_max_cents: null,
      front_desk_enabled: true,
      booking_manager_enabled: true,
      client_disclosure_enabled: false,
    } satisfies AgentSettingsFacts);

  // read_profile
  const profile = await repo.readProfile(args.artistId);
  if (profile) {
    const bits = [profile.display_name, profile.classification, profile.tagline]
      .filter(Boolean)
      .join(" · ");
    contextUsed.push({ source: "profile", detail: bits || "artist profile" });
  }

  // read_services
  const services = await repo.readServices(args.artistId);
  for (const s of services) {
    contextUsed.push({ source: "services", detail: serviceDetail(s) });
  }
  if (settings.quote_min_cents != null || settings.quote_max_cents != null) {
    contextUsed.push({
      source: "services",
      detail: `Quote range you may offer: ${formatCents(settings.quote_min_cents)} to ${formatCents(
        settings.quote_max_cents,
      )}`,
    });
  }

  // read_booking_policy
  const bookingPolicy = await repo.readBookingPolicy(args.artistId);
  if (bookingPolicy) {
    contextUsed.push({
      source: "booking_policy",
      detail: `Booking window ${bookingPolicy.booking_window ?? "2_3mo"}, minimum notice ${
        bookingPolicy.min_notice_hours
      }h${bookingPolicy.require_medical_disclosure ? ", medical disclosure required" : ""}`,
    });
  }

  // read_availability (+ project bookable days for the Booking Manager)
  const availability = await repo.readAvailability(args.artistId);
  const bookableDays = computeBookableDates({
    rules: availability.rules,
    blocks: availability.blocks,
    bookingWindow: availability.bookingWindow ?? bookingPolicy?.booking_window ?? null,
    minNoticeHours: availability.minNoticeHours ?? bookingPolicy?.min_notice_hours ?? 0,
    now: opts.now,
  });
  for (const day of bookableDays.slice(0, 8)) {
    contextUsed.push({ source: "availability", detail: dayDetail(day) });
  }
  if (bookableDays.length === 0) {
    contextUsed.push({ source: "availability", detail: "No open days in the booking window" });
  }

  // read_playbook
  const playbook = await repo.readPlaybook(args.artistId);
  for (const p of playbook) {
    contextUsed.push({
      source: "playbook",
      detail: `${p.title ?? p.category}: ${p.content}`,
    });
  }

  // read_thread / read_booking_request (the trigger)
  let thread: ThreadFacts | null = null;
  if (args.threadId) {
    thread = await repo.readThread(args.threadId, threadLimit);
  }
  let bookingRequest: BookingRequestFacts | null = null;
  if (args.bookingRequestId) {
    bookingRequest = await repo.readBookingRequest(args.bookingRequestId);
  }

  return {
    artistId: args.artistId,
    trigger: args.trigger,
    settings,
    profile,
    services,
    availability,
    bookableDays,
    bookingPolicy,
    playbook,
    thread,
    bookingRequest,
    contextUsed,
  };
}
