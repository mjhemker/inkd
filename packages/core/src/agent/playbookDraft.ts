/**
 * Deterministic playbook auto-draft (SPEC §5: "per-artist knowledge base …
 * auto-drafted from onboarding data"). Pure — turns an artist's profile,
 * services, booking policy, locations, and hours into starter playbook entries
 * the agent later cites in its reasoning. No I/O; the onboarding hook
 * (seedOnboardingPlaybook) does the loading + writing.
 *
 * Structural input types (not the DB row types) so this stays decoupled and
 * usable with partial onboarding data.
 */

// Local union (structurally identical to the DB `playbook_category` enum). Kept
// un-exported so it doesn't collide with the enum type re-exported from ../types.
type PlaybookCategory =
  | "faq"
  | "tone"
  | "policy"
  | "pricing"
  | "aftercare"
  | "scheduling"
  | "other";

export interface PlaybookServiceLike {
  name: string;
  price_type?: string | null;
  price_cents?: number | null;
  deposit_type?: string | null;
  deposit_amount_cents?: number | null;
  deposit_percent?: number | string | null;
  duration_minutes?: number | null;
  is_public?: boolean | null;
}

export interface PlaybookPolicyLike {
  booking_window?: string | null;
  min_notice_hours?: number | null;
  require_medical_disclosure?: boolean | null;
}

export interface PlaybookLocationLike {
  name?: string | null;
  city?: string | null;
  state?: string | null;
  is_public?: boolean | null;
}

export interface PlaybookRuleLike {
  weekday: number; // 0 = Sunday
  start_time: string; // "HH:MM[:SS]"
  end_time: string;
  is_open?: boolean | null;
}

export interface PlaybookDraftInput {
  artist?: { display_name?: string | null; tagline?: string | null } | null;
  services?: PlaybookServiceLike[] | null;
  bookingPolicy?: PlaybookPolicyLike | null;
  locations?: PlaybookLocationLike[] | null;
  availabilityRules?: PlaybookRuleLike[] | null;
}

export interface PlaybookDraftEntry {
  title: string;
  category: PlaybookCategory;
  content: string;
  source: "onboarding";
  priority: number;
}

const WEEKDAY_LABEL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const BOOKING_WINDOW_LABEL: Record<string, string> = {
  "1mo": "about a month out",
  "2_3mo": "two to three months out",
  "4_6mo": "four to six months out",
  "1yr": "up to a year out",
  closed: "currently closed",
};

function money(cents: number | null | undefined): string {
  if (cents == null) return "TBD";
  return `$${(cents / 100).toFixed(2)}`;
}

function hhmm(t: string): string {
  return t.slice(0, 5);
}

function priceLine(s: PlaybookServiceLike): string {
  switch (s.price_type) {
    case "quote":
      return "price by quote";
    case "hourly":
      return `${money(s.price_cents)}/hr`;
    case "starting_at":
      return `starting at ${money(s.price_cents)}`;
    default:
      return money(s.price_cents);
  }
}

function depositLine(s: PlaybookServiceLike): string {
  if (s.deposit_type === "fixed") return `${money(s.deposit_amount_cents)} deposit`;
  if (s.deposit_type === "percent") return `${Number(s.deposit_percent) || 0}% deposit`;
  return "no deposit";
}

/**
 * Generate the starter playbook. Only produces an entry when there's real data
 * behind it (empty services → no pricing entry, etc.), except aftercare which is
 * a safe universal default. Deterministic ordering + priority.
 */
export function draftPlaybookEntries(input: PlaybookDraftInput): PlaybookDraftEntry[] {
  const entries: PlaybookDraftEntry[] = [];
  const services = (input.services ?? []).filter((s) => s.is_public !== false);

  // 1. Pricing FAQ.
  if (services.length > 0) {
    const lines = services.map((s) => {
      const dur = s.duration_minutes ? `, ${s.duration_minutes} min` : "";
      return `- ${s.name}: ${priceLine(s)}${dur}`;
    });
    entries.push({
      title: "Pricing & services",
      category: "pricing",
      content: [
        "When a client asks about pricing, share these published rates (never invent a price):",
        ...lines,
        "If they want something outside these, offer to check with the artist.",
      ].join("\n"),
      source: "onboarding",
      priority: 100,
    });
  }

  // 2. Deposit policy.
  const withDeposit = services.filter(
    (s) => s.deposit_type === "fixed" || s.deposit_type === "percent",
  );
  if (withDeposit.length > 0) {
    const lines = withDeposit.map((s) => `- ${s.name}: ${depositLine(s)}`);
    entries.push({
      title: "Deposit policy",
      category: "policy",
      content: [
        "A deposit is required to hold an appointment and goes toward the final price:",
        ...lines,
        "Deposits are handled securely in-app. Do not discuss card details in chat — flag anything payment-related to the artist.",
      ].join("\n"),
      source: "onboarding",
      priority: 90,
    });
  }

  // 3. Location & hours.
  const locBits: string[] = [];
  const publicLocations = (input.locations ?? []).filter((l) => l.is_public !== false);
  if (publicLocations.length > 0) {
    for (const l of publicLocations) {
      const where = [l.name, [l.city, l.state].filter(Boolean).join(", ")]
        .filter(Boolean)
        .join(" — ");
      if (where) locBits.push(`- ${where}`);
    }
  }
  const openRules = (input.availabilityRules ?? [])
    .filter((r) => r.is_open !== false)
    .sort((a, b) => a.weekday - b.weekday);
  const hoursBits = openRules.map(
    (r) => `- ${WEEKDAY_LABEL[r.weekday] ?? "?"}: ${hhmm(r.start_time)}–${hhmm(r.end_time)}`,
  );
  const windowLabel = input.bookingPolicy?.booking_window
    ? BOOKING_WINDOW_LABEL[input.bookingPolicy.booking_window] ?? null
    : null;
  if (locBits.length > 0 || hoursBits.length > 0 || windowLabel) {
    const parts: string[] = [];
    if (locBits.length > 0) parts.push("Studio:", ...locBits);
    if (hoursBits.length > 0) parts.push("Hours:", ...hoursBits);
    if (windowLabel) parts.push(`Books open ${windowLabel}.`);
    if (input.bookingPolicy?.min_notice_hours) {
      parts.push(`Minimum ${input.bookingPolicy.min_notice_hours}h notice to book.`);
    }
    entries.push({
      title: "Location & hours",
      category: "scheduling",
      content: parts.join("\n"),
      source: "onboarding",
      priority: 80,
    });
  }

  // 4. Aftercare basics (universal safe default).
  entries.push({
    title: "Aftercare basics",
    category: "aftercare",
    content: [
      "General aftercare guidance (share as a starting point; defer medical questions to the artist):",
      "- Leave the initial wrap on as instructed, then wash gently with fragrance-free soap.",
      "- Pat dry and apply a thin layer of recommended aftercare ointment.",
      "- Keep it out of direct sun, pools, and soaking for ~2 weeks; don't pick or scratch.",
      "- If there are signs of infection or an allergic reaction, tell the client to seek medical care and flag it to the artist.",
    ].join("\n"),
    source: "onboarding",
    priority: 70,
  });

  return entries;
}
