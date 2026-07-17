/**
 * Pure derivations over the booking pipeline: request/booking/session status
 * metadata, the artist pipeline-board stage, and per-session deposit/balance
 * money state read off the payments ledger. No I/O — safe on web and RN.
 */
import type {
  Booking,
  BookingRequestStatus,
  BookingStatus,
  Payment,
  Session,
  SessionStatus,
} from "../types/rows";

/** Design-system tone tokens shared by web <Badge> and the native equivalent. */
export type StatusTone =
  | "neutral"
  | "brand"
  | "info"
  | "success"
  | "warning"
  | "danger";

export interface StatusMeta {
  label: string;
  tone: StatusTone;
}

// --- Request status ---------------------------------------------------------
export const REQUEST_STATUS_META: Record<BookingRequestStatus, StatusMeta> = {
  // "New" reads as a brand/violet stamp so it never collides with the ember
  // "warning" tone used by the Medical urgency badge on the same row.
  pending: { label: "New", tone: "brand" },
  reviewing: { label: "Reviewing", tone: "info" },
  accepted: { label: "Accepted", tone: "success" },
  declined: { label: "Declined", tone: "danger" },
  converted: { label: "Booked", tone: "brand" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
};

// --- Booking status ---------------------------------------------------------
export const BOOKING_STATUS_META: Record<BookingStatus, StatusMeta> = {
  pending: { label: "Deposit pending", tone: "warning" },
  confirmed: { label: "Scheduled", tone: "info" },
  in_progress: { label: "In progress", tone: "brand" },
  completed: { label: "Healed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  no_show: { label: "No-show", tone: "danger" },
};

// --- Session status ---------------------------------------------------------
export const SESSION_STATUS_META: Record<SessionStatus, StatusMeta> = {
  scheduled: { label: "Scheduled", tone: "info" },
  confirmed: { label: "Confirmed", tone: "brand" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  no_show: { label: "No-show", tone: "danger" },
  rescheduled: { label: "Rescheduled", tone: "warning" },
};

// --- Pipeline board ---------------------------------------------------------
/** Ordered artist pipeline stages (SPEC §P1: inquiry → … → healed). */
export type PipelineStage =
  | "inquiry"
  | "deposit_pending"
  | "scheduled"
  | "in_progress"
  | "complete";

export const PIPELINE_STAGES: { key: PipelineStage; label: string; tone: StatusTone }[] = [
  { key: "inquiry", label: "Inquiry", tone: "warning" },
  { key: "deposit_pending", label: "Deposit pending", tone: "info" },
  { key: "scheduled", label: "Scheduled", tone: "brand" },
  { key: "in_progress", label: "In progress", tone: "brand" },
  { key: "complete", label: "Healed / complete", tone: "success" },
];

/** Map a booking's status onto its pipeline-board column. */
export function bookingStage(booking: Pick<Booking, "status">): PipelineStage {
  switch (booking.status) {
    case "pending":
      return "deposit_pending";
    case "confirmed":
      return "scheduled";
    case "in_progress":
      return "in_progress";
    case "completed":
      return "complete";
    case "cancelled":
    case "no_show":
      return "complete";
    default:
      return "deposit_pending";
  }
}

// --- Deposit / balance money state ------------------------------------------
export type DepositState = "none" | "due" | "requested" | "paid" | "overdue";

export const DEPOSIT_STATE_META: Record<DepositState, StatusMeta> = {
  none: { label: "No deposit", tone: "neutral" },
  due: { label: "Deposit due", tone: "warning" },
  requested: { label: "Deposit requested", tone: "info" },
  paid: { label: "Deposit paid", tone: "success" },
  overdue: { label: "Deposit overdue", tone: "danger" },
};

function depositPaymentsForSession(
  sessionId: string,
  payments: Payment[],
): Payment[] {
  return payments.filter(
    (p) => p.session_id === sessionId && p.kind === "deposit",
  );
}

/**
 * Derive the deposit state for a single session from its own flags + the
 * payments ledger. Drives the deposit-requested / paid / overdue UI.
 */
export function sessionDepositState(
  session: Pick<Session, "id" | "deposit_cents" | "deposit_paid" | "scheduled_start">,
  payments: Payment[],
  now: Date = new Date(),
): DepositState {
  if (!session.deposit_cents || session.deposit_cents <= 0) return "none";

  const deposits = depositPaymentsForSession(session.id, payments);
  const settled =
    session.deposit_paid || deposits.some((p) => p.status === "succeeded");
  if (settled) return "paid";

  const startPast =
    session.scheduled_start != null &&
    new Date(session.scheduled_start).getTime() < now.getTime();

  const pending = deposits.some(
    (p) => p.status === "pending" || p.status === "processing",
  );
  if (pending) return startPast ? "overdue" : "requested";
  return startPast ? "overdue" : "due";
}

export interface BookingMoney {
  totalCents: number;
  depositCents: number;
  depositPaidCents: number;
  balanceCents: number;
  balancePaidCents: number;
  /** Net collected = succeeded deposits + balances − refunds. */
  collectedCents: number;
  outstandingCents: number;
}

/** Roll session money + succeeded ledger entries into a booking summary. */
export function summarizeBookingMoney(
  sessions: Session[],
  payments: Payment[],
): BookingMoney {
  let depositCents = 0;
  let depositPaidCents = 0;
  let balanceCents = 0;
  let balancePaidCents = 0;
  for (const s of sessions) {
    depositCents += s.deposit_cents ?? 0;
    balanceCents += s.balance_cents ?? 0;
    if (s.deposit_paid) depositPaidCents += s.deposit_cents ?? 0;
    if (s.balance_paid) balancePaidCents += s.balance_cents ?? 0;
  }

  let collectedCents = 0;
  for (const p of payments) {
    if (p.status !== "succeeded") continue;
    if (p.kind === "deposit" || p.kind === "balance") collectedCents += p.amount_cents;
    else if (p.kind === "refund") collectedCents -= p.amount_cents;
  }

  const totalCents = depositCents + balanceCents;
  return {
    totalCents,
    depositCents,
    depositPaidCents,
    balanceCents,
    balancePaidCents,
    collectedCents,
    outstandingCents: Math.max(0, totalCents - depositPaidCents - balancePaidCents),
  };
}

/** The next upcoming (non-terminal) session for a booking, if any. */
export function nextSession(sessions: Session[], now: Date = new Date()): Session | null {
  const upcoming = sessions
    .filter(
      (s) =>
        s.scheduled_start != null &&
        new Date(s.scheduled_start).getTime() >= now.getTime() &&
        s.status !== "cancelled" &&
        s.status !== "completed",
    )
    .sort(
      (a, b) =>
        new Date(a.scheduled_start!).getTime() -
        new Date(b.scheduled_start!).getTime(),
    );
  return upcoming[0] ?? null;
}

/** Active (still-open) requests, for the client "can I withdraw?" affordance. */
export function isRequestOpen(status: BookingRequestStatus): boolean {
  return status === "pending" || status === "reviewing";
}

/** Whether a booking can still be cancelled by either party. */
export function isBookingCancellable(status: BookingStatus): boolean {
  return status === "pending" || status === "confirmed" || status === "in_progress";
}

/** Format integer cents as USD, e.g. 12000 → "$120". */
export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  const dollars = cents / 100;
  return dollars % 1 === 0
    ? `$${dollars.toLocaleString("en-US")}`
    : `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Format a budget range from min/max cents. */
export function formatBudget(
  minCents: number | null | undefined,
  maxCents: number | null | undefined,
): string {
  if (minCents == null && maxCents == null) return "Open";
  if (minCents != null && maxCents != null) {
    return `${formatCents(minCents)}–${formatCents(maxCents)}`;
  }
  if (minCents != null) return `${formatCents(minCents)}+`;
  return `Up to ${formatCents(maxCents)}`;
}
