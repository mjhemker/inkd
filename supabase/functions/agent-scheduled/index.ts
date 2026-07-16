// POST /functions/v1/agent-scheduled
//
// Drains the `scheduled_scan` slice of the agent_jobs queue: Studio Manager's
// three deterministic jobs (SPEC §5) — deposit_chase, rebook_nudge,
// weekly_digest. Unlike `agent-run`, this function makes NO Anthropic API
// call and has NO ANTHROPIC_API_KEY dependency — every draft is a template
// filled from real DB facts, so it runs identically before and after Michael
// wires the LLM key. See docs/agents-runtime.md "Scheduled jobs (Studio
// Manager)" for why this is a sibling function rather than an agent-run
// dispatch branch.
//
// AUTH: verify_jwt = false at the gateway (config.toml, mirrors agent-run);
// this function requires the AI-runtime bearer token (pg_cron sends it via
// agent_scheduled_tick(), 20260716090000 — see _shared/agent-auth.ts). Prefers
// AGENT_RUNNER_TOKEN, falls back to the service-role key. Selection + template
// logic lives in _shared/agent-scheduled.ts and is unit-tested offline.
import { isAuthorizedRunner } from "../_shared/agent-auth.ts";
import { getAdminClient, type SupabaseClient } from "../_shared/supabaseAdmin.ts";
import { errorResponse, jsonResponse } from "../_shared/errors.ts";
import {
  buildDepositChaseDraft,
  buildRebookNudgeDraft,
  buildWeeklyDigestSummary,
  depositChaseContextUsed,
  depositChaseDedupeKey,
  rebookNudgeContextUsed,
  rebookNudgeDedupeKey,
  selectDepositChaseCandidates,
  selectRebookNudgeCandidates,
  weeklyDigestContextUsed,
  weeklyDigestDedupeKey,
  type DepositChaseSessionRow,
  type CompletedSessionRow,
  type ScheduledJobKind,
} from "../_shared/agent-scheduled.ts";
import {
  selectDueAftercareCheckins,
  buildTouchUpNudge,
  firstName,
  type AftercareKind,
  type DueAftercareRowLike,
} from "../_shared/aftercare-scheduled.ts";

interface LeasedJob {
  id: string;
  artist_id: string;
  trigger_kind: string;
  job_kind: ScheduledJobKind | null;
  attempts: number;
  max_attempts: number;
}

interface JobSummary {
  processed: number;
  created: number; // agent_actions rows written (proposed or executed)
  skipped: number; // job ran but found nothing to do, or was already deduped
  failed: number;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // AI-runtime bearer required. Prefers AGENT_RUNNER_TOKEN (the short dedicated
  // shared token the cron sends), falls back to the service-role key.
  if (!isAuthorizedRunner(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const admin = getAdminClient();
    const batchSize = await readBatchSize(req);
    const summary = await processScheduledBatch(admin, batchSize);
    const aftercare = await processDueAftercareCheckins(admin, new Date(), batchSize);
    return jsonResponse({ ok: true, ...summary, aftercare });
  } catch (err) {
    console.error("agent-scheduled:", err);
    return errorResponse(err);
  }
});

async function readBatchSize(req: Request): Promise<number> {
  try {
    const text = await req.text();
    if (!text) return 20;
    const body = JSON.parse(text) as { batch_size?: unknown };
    const n = typeof body.batch_size === "number" ? body.batch_size : 20;
    return Math.min(100, Math.max(1, Math.floor(n)));
  } catch {
    return 20;
  }
}

// ---------------------------------------------------------------------------
// Batch drain — reuses the SAME agent_jobs_lease RPC as agent-run (generic
// over trigger_kind); job_kind discriminates dispatch here instead of role.
// ---------------------------------------------------------------------------
async function processScheduledBatch(db: SupabaseClient, batchSize: number): Promise<JobSummary> {
  const { data, error } = await db.rpc("agent_jobs_lease", { p_limit: batchSize });
  if (error) throw new Error(`lease failed: ${error.message}`);
  const jobs = ((data ?? []) as Record<string, unknown>[])
    .map((r): LeasedJob => ({
      id: r.id as string,
      artist_id: r.artist_id as string,
      trigger_kind: r.trigger_kind as string,
      job_kind: (r.job_kind as ScheduledJobKind | null) ?? null,
      attempts: r.attempts as number,
      max_attempts: r.max_attempts as number,
    }))
    .filter((j) => j.trigger_kind === "scheduled_scan");

  const summary: JobSummary = { processed: 0, created: 0, skipped: 0, failed: 0 };
  const now = new Date();

  for (const job of jobs) {
    summary.processed++;
    try {
      const result = await runOne(db, job, now);
      summary.created += result.created;
      summary.skipped += result.skipped;
      await db.from("agent_jobs").update({ status: "done" }).eq("id", job.id);
    } catch (err) {
      summary.failed++;
      await markJobFailed(db, job, (err as Error).message ?? String(err));
    }
  }
  return summary;
}

async function markJobFailed(db: SupabaseClient, job: LeasedJob, message: string): Promise<void> {
  const capped = job.attempts >= job.max_attempts;
  await db
    .from("agent_jobs")
    .update({ status: capped ? "failed" : "pending", last_error: message.slice(0, 2000) })
    .eq("id", job.id);
}

async function runOne(
  db: SupabaseClient,
  job: LeasedJob,
  now: Date,
): Promise<{ created: number; skipped: number }> {
  switch (job.job_kind) {
    case "deposit_chase":
      return runDepositChase(db, job.artist_id, now);
    case "rebook_nudge":
      return runRebookNudge(db, job.artist_id, now);
    case "weekly_digest":
      return runWeeklyDigest(db, job.artist_id, now);
    default:
      // Data integrity issue (scheduled_scan job with no/unknown job_kind) —
      // treat as a no-op skip rather than a failure loop.
      return { created: 0, skipped: 1 };
  }
}

// ---------------------------------------------------------------------------
// Shared: find-or-create the artist<->client thread a draft should land in.
// ---------------------------------------------------------------------------
async function findOrCreateThread(
  db: SupabaseClient,
  artistId: string,
  clientId: string,
  bookingId: string | null,
): Promise<string> {
  const { data: existing } = await db
    .from("threads")
    .select("id")
    .eq("artist_id", artistId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data: created, error } = await db
    .from("threads")
    .insert({
      artist_id: artistId,
      client_id: clientId,
      booking_id: bookingId,
      subject: "Booking updates",
    })
    .select("id")
    .single();
  if (error) throw new Error(`create thread failed: ${error.message}`);
  return created.id as string;
}

/** True when an agent_actions row already exists for this dedupe key. */
async function alreadyHandled(db: SupabaseClient, dedupeKey: string): Promise<boolean> {
  const { data } = await db
    .from("agent_actions")
    .select("id")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  return data != null;
}

// ---------------------------------------------------------------------------
// (a) deposit_chase
// ---------------------------------------------------------------------------
async function runDepositChase(
  db: SupabaseClient,
  artistId: string,
  now: Date,
): Promise<{ created: number; skipped: number }> {
  const { data, error } = await db
    .from("sessions")
    .select(
      "id, booking_id, client_id, status, created_at, scheduled_start, deposit_cents, deposit_paid, bookings(services(name))",
    )
    .eq("artist_id", artistId)
    .in("status", ["scheduled", "confirmed"]);
  if (error) throw new Error(`read sessions (deposit_chase) failed: ${error.message}`);

  const rows: DepositChaseSessionRow[] = (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    booking_id: r.booking_id as string,
    client_id: r.client_id as string,
    status: r.status as string,
    created_at: r.created_at as string,
    scheduled_start: (r.scheduled_start as string | null) ?? null,
    deposit_cents: r.deposit_cents as number,
    deposit_paid: r.deposit_paid as boolean,
    service_name: serviceNameFromEmbed(r.bookings),
  }));

  const candidates = selectDepositChaseCandidates(rows, now);
  let created = 0;
  let skipped = 0;

  for (const c of candidates) {
    const dedupeKey = depositChaseDedupeKey(c.sessionId, now);
    if (await alreadyHandled(db, dedupeKey)) {
      skipped++;
      continue;
    }
    const threadId = await findOrCreateThread(db, artistId, c.clientId, c.bookingId);
    const draftText = buildDepositChaseDraft(c);
    const contextUsed = depositChaseContextUsed(c);

    const { error: insErr } = await db.from("agent_actions").insert({
      artist_id: artistId,
      agent_role: "studio_manager",
      thread_id: threadId,
      booking_id: c.bookingId,
      client_id: c.clientId,
      action_type: "reply.draft",
      tier: 2,
      status: "proposed",
      reasoning_summary:
        "This session's deposit has been outstanding since booking — I drafted a friendly reminder, nothing sent yet.",
      payload: {
        thread_id: threadId,
        draft_text: draftText,
        context_used: contextUsed,
        trigger: { kind: "scheduled_scan", id: c.sessionId },
      },
      data_consulted: contextUsed,
      dedupe_key: dedupeKey,
    });
    if (insErr) throw new Error(`insert deposit_chase action failed: ${insErr.message}`);
    created++;
  }
  return { created, skipped };
}

// ---------------------------------------------------------------------------
// (b) rebook_nudge
// ---------------------------------------------------------------------------
async function runRebookNudge(
  db: SupabaseClient,
  artistId: string,
  now: Date,
): Promise<{ created: number; skipped: number }> {
  const [completedRes, futureRes] = await Promise.all([
    db
      .from("sessions")
      .select("id, booking_id, client_id, status, scheduled_end, updated_at, bookings(services(name))")
      .eq("artist_id", artistId)
      .eq("status", "completed"),
    db
      .from("sessions")
      .select("client_id")
      .eq("artist_id", artistId)
      .in("status", ["scheduled", "confirmed"])
      .gt("scheduled_start", now.toISOString()),
  ]);
  if (completedRes.error) {
    throw new Error(`read sessions (rebook_nudge, completed) failed: ${completedRes.error.message}`);
  }
  if (futureRes.error) {
    throw new Error(`read sessions (rebook_nudge, future) failed: ${futureRes.error.message}`);
  }

  const completed: CompletedSessionRow[] = (completedRes.data ?? []).map(
    (r: Record<string, unknown>) => ({
      id: r.id as string,
      booking_id: r.booking_id as string,
      client_id: r.client_id as string,
      status: r.status as string,
      scheduled_end: (r.scheduled_end as string | null) ?? null,
      updated_at: r.updated_at as string,
      service_name: serviceNameFromEmbed(r.bookings),
    }),
  );
  const futureClientIds = new Set(
    (futureRes.data ?? []).map((r: Record<string, unknown>) => r.client_id as string),
  );

  const candidates = selectRebookNudgeCandidates(completed, futureClientIds, now);
  let created = 0;
  let skipped = 0;

  for (const c of candidates) {
    const dedupeKey = rebookNudgeDedupeKey(c.sessionId);
    if (await alreadyHandled(db, dedupeKey)) {
      skipped++;
      continue;
    }
    const threadId = await findOrCreateThread(db, artistId, c.clientId, c.bookingId);
    const draftText = buildRebookNudgeDraft(c);
    const contextUsed = rebookNudgeContextUsed(c);

    const { error: insErr } = await db.from("agent_actions").insert({
      artist_id: artistId,
      agent_role: "studio_manager",
      thread_id: threadId,
      booking_id: c.bookingId,
      client_id: c.clientId,
      action_type: "reply.draft",
      tier: 2,
      status: "proposed",
      reasoning_summary:
        "It's been 30+ days since their last completed session and they have nothing else booked — I drafted a rebooking nudge.",
      payload: {
        thread_id: threadId,
        draft_text: draftText,
        context_used: contextUsed,
        trigger: { kind: "scheduled_scan", id: c.sessionId },
      },
      data_consulted: contextUsed,
      dedupe_key: dedupeKey,
    });
    if (insErr) throw new Error(`insert rebook_nudge action failed: ${insErr.message}`);
    created++;
  }
  return { created, skipped };
}

// ---------------------------------------------------------------------------
// (c) weekly_digest
// ---------------------------------------------------------------------------
async function runWeeklyDigest(
  db: SupabaseClient,
  artistId: string,
  now: Date,
): Promise<{ created: number; skipped: number }> {
  const dedupeKey = weeklyDigestDedupeKey(artistId, now);
  if (await alreadyHandled(db, dedupeKey)) {
    return { created: 0, skipped: 1 };
  }

  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [artistRes, requestsRes, sessionsRes, depositsRes, approvalsRes] = await Promise.all([
    db.from("artist_profiles").select("profile_id").eq("id", artistId).maybeSingle(),
    db
      .from("booking_requests")
      .select("id", { count: "exact", head: true })
      .eq("artist_id", artistId)
      .gt("created_at", weekAgo),
    db
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("artist_id", artistId)
      .eq("status", "completed")
      .gt("updated_at", weekAgo),
    db
      .from("payments")
      .select("amount_cents")
      .eq("artist_id", artistId)
      .eq("kind", "deposit")
      .eq("status", "succeeded")
      .gt("created_at", weekAgo),
    db
      .from("agent_actions")
      .select("id", { count: "exact", head: true })
      .eq("artist_id", artistId)
      .eq("status", "proposed"),
  ]);
  if (artistRes.error) throw new Error(`read artist_profiles failed: ${artistRes.error.message}`);
  if (!artistRes.data?.profile_id) return { created: 0, skipped: 1 };

  const depositsHeldCents = ((depositsRes.data ?? []) as { amount_cents: number }[]).reduce(
    (sum, p) => sum + p.amount_cents,
    0,
  );
  const counts = {
    newRequests: requestsRes.count ?? 0,
    sessionsDone: sessionsRes.count ?? 0,
    depositsHeldCents,
    pendingApprovals: approvalsRes.count ?? 0,
  };
  const summary = buildWeeklyDigestSummary(counts, now);
  const contextUsed = weeklyDigestContextUsed(counts, now);

  const { error: notifErr } = await db.from("notifications").insert({
    profile_id: artistRes.data.profile_id,
    type: "weekly_digest",
    title: summary.title,
    body: summary.body,
    data: summary.data,
    action_url: "/studio/ai",
  });
  if (notifErr) throw new Error(`insert weekly_digest notification failed: ${notifErr.message}`);

  const { error: actErr } = await db.from("agent_actions").insert({
    artist_id: artistId,
    agent_role: "studio_manager",
    action_type: "note.log",
    tier: 1,
    status: "executed",
    reasoning_summary: summary.reasoningSummary,
    payload: {
      context_used: contextUsed,
      trigger: { kind: "scheduled_scan", id: artistId },
    },
    data_consulted: contextUsed,
    dedupe_key: dedupeKey,
    executed_at: now.toISOString(),
  });
  if (actErr) throw new Error(`insert weekly_digest action failed: ${actErr.message}`);

  return { created: 1, skipped: 0 };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Pull services.name out of a `bookings(services(name))` embedded select. */
function serviceNameFromEmbed(bookings: unknown): string | null {
  const b = Array.isArray(bookings) ? bookings[0] : bookings;
  const svc = b && typeof b === "object" ? (b as Record<string, unknown>).services : null;
  const s = Array.isArray(svc) ? svc[0] : svc;
  const name = s && typeof s === "object" ? (s as Record<string, unknown>).name : null;
  return typeof name === "string" ? name : null;
}

/** Normalize a PostgREST embedded relation (single object or 1-element array). */
function firstOf(v: unknown): Record<string, unknown> | null {
  const x = Array.isArray(v) ? v[0] : v;
  return x && typeof x === "object" ? (x as Record<string, unknown>) : null;
}

// ---------------------------------------------------------------------------
// Aftercare check-in delivery — runs every tick (independent of the agent_jobs
// queue). Finds due `aftercare_checkins` (status=pending, scheduled_for<=now),
// and for each: sends the client a warm 'aftercare_check_in' notification (which
// fans out to push/in-app via the Wave 1 'aftercare' category) + marks the row
// sent; at week_3 also nudges the artist toward a touch-up/rebook. Rows for an
// artist who has since turned aftercare OFF are marked skipped (never sent).
// Selection/copy logic lives in _shared/aftercare-scheduled.ts and is unit-tested.
// ---------------------------------------------------------------------------
interface AftercareSummary {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  review_nudges: number;
  touchup_nudges: number;
}

async function processDueAftercareCheckins(
  db: SupabaseClient,
  now: Date,
  limit: number,
): Promise<AftercareSummary> {
  const summary: AftercareSummary = {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    review_nudges: 0,
    touchup_nudges: 0,
  };

  const { data, error } = await db
    .from("aftercare_checkins")
    .select(
      "id, kind, status, scheduled_for, session_id, booking_id, client_id, artist_id, " +
        "artist_profiles(profile_id, aftercare_enabled, profiles(display_name)), " +
        "bookings(title, services(name))",
    )
    .eq("status", "pending")
    .lte("scheduled_for", now.toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`read due aftercare_checkins failed: ${error.message}`);

  const raw = (data ?? []) as Record<string, unknown>[];
  if (raw.length === 0) return summary;

  // has_review per booking (week_3 review-nudge gate) — one batched query.
  const bookingIds = [
    ...new Set(raw.map((r) => r.booking_id).filter((b): b is string => typeof b === "string")),
  ];
  const reviewedBookings = new Set<string>();
  if (bookingIds.length > 0) {
    const { data: reviews } = await db
      .from("reviews")
      .select("booking_id")
      .in("booking_id", bookingIds);
    for (const rv of (reviews ?? []) as { booking_id: string | null }[]) {
      if (rv.booking_id) reviewedBookings.add(rv.booking_id);
    }
  }

  // Client display names (for the artist touch-up nudge copy).
  const clientIds = [
    ...new Set(raw.map((r) => r.client_id).filter((c): c is string => typeof c === "string")),
  ];
  const clientNames = new Map<string, string | null>();
  if (clientIds.length > 0) {
    const { data: profs } = await db.from("profiles").select("id, display_name").in("id", clientIds);
    for (const p of (profs ?? []) as { id: string; display_name: string | null }[]) {
      clientNames.set(p.id, p.display_name);
    }
  }

  const rows: DueAftercareRowLike[] = raw.map((r) => {
    const ap = firstOf(r.artist_profiles);
    const artistProfile = ap ? firstOf(ap.profiles) : null;
    const bookingId = (r.booking_id as string | null) ?? null;
    return {
      id: r.id as string,
      kind: r.kind as AftercareKind,
      status: r.status as string,
      scheduled_for: r.scheduled_for as string,
      session_id: r.session_id as string,
      booking_id: bookingId,
      client_id: r.client_id as string,
      artist_id: r.artist_id as string,
      aftercare_enabled: ap ? ap.aftercare_enabled === true : false,
      artist_display_name:
        artistProfile && typeof artistProfile.display_name === "string"
          ? (artistProfile.display_name as string)
          : null,
      booking_title: firstOf(r.bookings)?.title as string | null ?? null,
      service_name: serviceNameFromEmbed(r.bookings),
      has_review: bookingId ? reviewedBookings.has(bookingId) : false,
    };
  });

  // Keep the artist's profile_id for the touch-up notification recipient.
  const artistProfileIdByCheckin = new Map<string, string | null>();
  for (const r of raw) {
    const ap = firstOf(r.artist_profiles);
    artistProfileIdByCheckin.set(
      r.id as string,
      ap && typeof ap.profile_id === "string" ? (ap.profile_id as string) : null,
    );
  }

  const plans = selectDueAftercareCheckins(rows, now);
  for (const plan of plans) {
    summary.processed++;
    try {
      // Artist disabled aftercare after this was scheduled -> skip, send nothing.
      if (plan.disabled) {
        await db
          .from("aftercare_checkins")
          .update({ status: "skipped" })
          .eq("id", plan.checkinId);
        summary.skipped++;
        continue;
      }

      // Client-facing check-in notification (fans out via the 'aftercare' category).
      const { error: notifErr } = await db.from("notifications").insert({
        profile_id: plan.clientId,
        type: "aftercare_check_in",
        title: plan.message.title,
        body: plan.message.body,
        action_url: plan.actionUrl,
        data: {
          aftercare_checkin_id: plan.checkinId,
          kind: plan.kind,
          session_id: plan.sessionId,
          booking_id: plan.bookingId,
          artist_id: plan.artistId,
          nudge_review: plan.nudgeReview,
        },
      });
      if (notifErr) throw new Error(`insert aftercare notification failed: ${notifErr.message}`);

      await db
        .from("aftercare_checkins")
        .update({ status: "sent", sent_at: now.toISOString() })
        .eq("id", plan.checkinId);
      summary.sent++;
      if (plan.nudgeReview) summary.review_nudges++;

      // week_3: nudge the artist toward a touch-up / rebook (in-app only).
      if (plan.kind === "week_3") {
        const artistProfileId = artistProfileIdByCheckin.get(plan.checkinId) ?? null;
        if (artistProfileId) {
          const nudge = buildTouchUpNudge(plan.tattooLabel, firstName(clientNames.get(plan.clientId) ?? null));
          const { error: tuErr } = await db.from("notifications").insert({
            profile_id: artistProfileId,
            type: "aftercare_touchup_nudge",
            title: nudge.title,
            body: nudge.body,
            action_url: plan.bookingId ? `/bookings/${plan.bookingId}` : null,
            data: {
              aftercare_checkin_id: plan.checkinId,
              booking_id: plan.bookingId,
              client_id: plan.clientId,
            },
          });
          if (!tuErr) summary.touchup_nudges++;
        }
      }
    } catch (_err) {
      summary.failed++;
    }
  }

  return summary;
}
