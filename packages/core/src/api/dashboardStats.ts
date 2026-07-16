/**
 * Dashboard stats: the four artist-facing numbers on the dashboard hero row
 * (open inquiries, booked sessions, deposits held, rebook rate). Every value
 * here is a real per-artist read — no placeholders, no fake numbers. Brand
 * new accounts get honest zeros (or "—" for rebook rate, see below).
 *
 * Each function documents its exact definition inline so a future change to
 * "what counts" is a deliberate, reviewable edit here — not a UI guess.
 */
import type { InkdSupabaseClient } from "../supabase/client";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Sessions in these statuses are still "on the books" (not finished, not
 * fallen through). Used for both the booked-sessions count and the
 * deposits-held definition below. */
const ACTIVE_SESSION_STATUSES = ["scheduled", "confirmed", "rescheduled"] as const;

/**
 * Minimum distinct clients an artist needs before we'll surface a rebook
 * percentage. Below this, a percentage is more misleading than informative
 * (e.g. 1 of 2 clients rebooking reads as "50%" but is really n=2) — the UI
 * shows "—" / "not enough data yet" instead.
 */
export const MIN_CLIENTS_FOR_REBOOK_RATE = 5;

export interface RebookStat {
  /** Distinct clients who have ever had a booking with this artist. */
  totalClients: number;
  /** Of those, how many have more than one booking (i.e. rebooked). */
  repeatClients: number;
  /** repeatClients / totalClients, or null when there isn't enough data yet
   * (see MIN_CLIENTS_FOR_REBOOK_RATE). Render "—" when null. */
  rate: number | null;
}

export interface DashboardStats {
  /** Open inquiries: booking_requests still awaiting artist triage
   * (status = 'pending'). Reviewing/accepted/etc. don't count — those have
   * already been acted on. */
  openInquiries: number;
  /** Booked sessions: sessions in an active status (scheduled/confirmed/
   * rescheduled) whose scheduled_start falls in the next 30 days from now. */
  bookedSessionsNext30Days: number;
  /** Deposits held, in cents: sum of succeeded deposit payments whose session
   * is still active (i.e. the artist/INKD is holding client money against
   * work that hasn't happened, been completed, cancelled or no-showed yet).
   * A deposit paid before a session exists (session_id null, e.g. held
   * against a request) counts as held too. */
  depositsHeldCents: number;
  rebook: RebookStat;
}

/** Open inquiries: pending booking_requests for this artist. */
export async function countOpenInquiries(
  client: InkdSupabaseClient,
  artistId: string,
): Promise<number> {
  const { count, error } = await client
    .from("booking_requests")
    .select("*", { count: "exact", head: true })
    .eq("artist_id", artistId)
    .eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}

/** Booked sessions: active sessions scheduled to start within the next 30
 * days of `now` (defaults to the real clock; pass a fixed `now` in tests). */
export async function countBookedSessionsNext30Days(
  client: InkdSupabaseClient,
  artistId: string,
  now: Date = new Date(),
): Promise<number> {
  const from = now.toISOString();
  const to = new Date(now.getTime() + 30 * MS_PER_DAY).toISOString();
  const { count, error } = await client
    .from("sessions")
    .select("*", { count: "exact", head: true })
    .eq("artist_id", artistId)
    .in("status", ACTIVE_SESSION_STATUSES)
    .gte("scheduled_start", from)
    .lte("scheduled_start", to);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Deposits held: pulls the artist's succeeded deposit payments and their
 * sessions' current statuses, then sums the ones still "held" per the
 * definition on `DashboardStats.depositsHeldCents`. Two separate reads
 * (rather than a single joined query) so the definition stays a plain,
 * testable, pure function — see `sumHeldDeposits` below.
 */
export async function getDepositsHeldCents(
  client: InkdSupabaseClient,
  artistId: string,
): Promise<number> {
  const [paymentsRes, sessionsRes] = await Promise.all([
    client
      .from("payments")
      .select("amount_cents, session_id")
      .eq("artist_id", artistId)
      .eq("kind", "deposit")
      .eq("status", "succeeded"),
    client.from("sessions").select("id, status").eq("artist_id", artistId),
  ]);
  if (paymentsRes.error) throw paymentsRes.error;
  if (sessionsRes.error) throw sessionsRes.error;

  return sumHeldDeposits(paymentsRes.data ?? [], sessionsRes.data ?? []);
}

/** Pure aggregation used by `getDepositsHeldCents` — kept separate so it's
 * unit-testable without a Supabase client. */
export function sumHeldDeposits(
  deposits: Array<{ amount_cents: number; session_id: string | null }>,
  sessions: Array<{ id: string; status: string }>,
): number {
  const activeSessionIds = new Set(
    sessions
      .filter((s) => (ACTIVE_SESSION_STATUSES as readonly string[]).includes(s.status))
      .map((s) => s.id),
  );
  return deposits.reduce((sum, d) => {
    const held = d.session_id == null || activeSessionIds.has(d.session_id);
    return held ? sum + d.amount_cents : sum;
  }, 0);
}

/**
 * Rebook rate: reads the artist's bookings, groups by client, and reports
 * what fraction of distinct clients have more than one booking. Returns
 * `rate: null` below `MIN_CLIENTS_FOR_REBOOK_RATE` distinct clients.
 */
export async function getRebookStat(
  client: InkdSupabaseClient,
  artistId: string,
): Promise<RebookStat> {
  const { data, error } = await client
    .from("bookings")
    .select("client_id")
    .eq("artist_id", artistId);
  if (error) throw error;
  return summarizeRebook((data ?? []).map((r) => r.client_id));
}

/** Pure aggregation used by `getRebookStat` — kept separate so it's
 * unit-testable without a Supabase client. */
export function summarizeRebook(clientIdsByBooking: string[]): RebookStat {
  const counts = new Map<string, number>();
  for (const clientId of clientIdsByBooking) {
    counts.set(clientId, (counts.get(clientId) ?? 0) + 1);
  }
  const totalClients = counts.size;
  const repeatClients = [...counts.values()].filter((n) => n > 1).length;
  const rate =
    totalClients >= MIN_CLIENTS_FOR_REBOOK_RATE ? repeatClients / totalClients : null;
  return { totalClients, repeatClients, rate };
}

/** Fetch all four dashboard stats in parallel for one artist. */
export async function getDashboardStats(
  client: InkdSupabaseClient,
  artistId: string,
): Promise<DashboardStats> {
  const [openInquiries, bookedSessionsNext30Days, depositsHeldCents, rebook] =
    await Promise.all([
      countOpenInquiries(client, artistId),
      countBookedSessionsNext30Days(client, artistId),
      getDepositsHeldCents(client, artistId),
      getRebookStat(client, artistId),
    ]);
  return { openInquiries, bookedSessionsNext30Days, depositsHeldCents, rebook };
}
