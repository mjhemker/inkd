// POST /functions/v1/agent-run
//
// Drains the agent_jobs queue: leases a batch (FOR UPDATE SKIP LOCKED via the
// agent_jobs_lease RPC), then for each job loads artist context through the tool
// layer, prompts the model, runs the deterministic policy engine, and persists an
// agent_actions row (auto-sending the message when policy says execute). Invoked
// every minute by pg_cron (agent-run-drain) once the runner secrets are set, or
// on demand by an operator with the service key.
//
// AUTH: verify_jwt = false at the gateway (config.toml); this function requires
// the AI-runtime bearer token (pg_cron sends it — see _shared/agent-auth.ts).
// Prefers AGENT_RUNNER_TOKEN, falls back to the service-role key. The heavy
// logic lives in _shared/agent-runner.ts and is unit-tested offline with a fake
// repo + model.
//
// NOTE (no key yet): needs ANTHROPIC_API_KEY. Absent → 503 and nothing is leased.
import { isAuthorizedRunner } from "../_shared/agent-auth.ts";
import { getAdminClient, type SupabaseClient } from "../_shared/supabaseAdmin.ts";
import { errorResponse, jsonResponse } from "../_shared/errors.ts";
import { AnthropicModelClient, resolveModelConfig } from "../_shared/agent-model.ts";
import {
  processBatch,
  type AgentActionDraft,
  type AgentJob,
  type JobRepo,
  type MessageDraft,
} from "../_shared/agent-runner.ts";
import type {
  AgentSettingsFacts,
  AvailabilityFacts,
  BookingPolicyFacts,
  ContextRepo,
  PlaybookEntry,
  ProfileFacts,
  ServiceFact,
  ThreadFacts,
  BookingRequestFacts,
} from "../_shared/agent-tools.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // AI-runtime bearer required. Prefers AGENT_RUNNER_TOKEN (the short dedicated
  // shared token the cron sends), falls back to the service-role key.
  if (!isAuthorizedRunner(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey || apiKey.trim() === "") {
    return jsonResponse(
      { error: { code: "not_configured", message: "ANTHROPIC_API_KEY is not set" } },
      503,
    );
  }

  try {
    const admin = getAdminClient();
    const { model, maxTokens } = resolveModelConfig((k) => Deno.env.get(k));
    const modelClient = new AnthropicModelClient({ apiKey, model, maxTokens });
    const repo = createRepo(admin);

    const batchSize = await readBatchSize(req);
    const summary = await processBatch({ repo, model: modelClient }, batchSize);
    return jsonResponse({ ok: true, ...summary });
  } catch (err) {
    console.error("agent-run:", err);
    return errorResponse(err);
  }
});

async function readBatchSize(req: Request): Promise<number> {
  try {
    const text = await req.text();
    if (!text) return 10;
    const body = JSON.parse(text) as { batch_size?: unknown };
    const n = typeof body.batch_size === "number" ? body.batch_size : 10;
    return Math.min(50, Math.max(1, Math.floor(n)));
  } catch {
    return 10;
  }
}

// ---------------------------------------------------------------------------
// Service-role repository implementing the ContextRepo + JobRepo IO contracts.
// ---------------------------------------------------------------------------
function createRepo(db: SupabaseClient): ContextRepo & JobRepo {
  return {
    // --- ContextRepo -------------------------------------------------------
    async readAgentSettings(artistId): Promise<AgentSettingsFacts | null> {
      const { data } = await db
        .from("agent_settings")
        .select(
          "autonomy, action_class_overrides, escalation_keywords, quote_min_cents, quote_max_cents, front_desk_enabled, booking_manager_enabled, client_disclosure_enabled",
        )
        .eq("artist_id", artistId)
        .maybeSingle();
      if (!data) return null;
      return {
        autonomy: data.autonomy,
        action_class_overrides:
          (data.action_class_overrides as Record<string, string> | null) ?? null,
        escalation_keywords: data.escalation_keywords ?? [],
        quote_min_cents: data.quote_min_cents,
        quote_max_cents: data.quote_max_cents,
        front_desk_enabled: data.front_desk_enabled,
        booking_manager_enabled: data.booking_manager_enabled,
        client_disclosure_enabled: data.client_disclosure_enabled,
      };
    },

    async readProfile(artistId): Promise<ProfileFacts | null> {
      const { data } = await db
        .from("artist_profiles")
        .select("tagline, bio, classification, profiles(display_name, handle)")
        .eq("id", artistId)
        .maybeSingle();
      if (!data) return null;
      const prof = (data.profiles ?? null) as { display_name: string | null; handle: string | null } | null;
      return {
        display_name: prof?.display_name ?? null,
        handle: prof?.handle ?? null,
        tagline: data.tagline ?? null,
        bio: data.bio ?? null,
        classification: data.classification ?? null,
      };
    },

    async readServices(artistId): Promise<ServiceFact[]> {
      const { data } = await db
        .from("services")
        .select(
          "id, name, description, duration_minutes, price_type, price_cents, deposit_type, deposit_amount_cents, deposit_percent",
        )
        .eq("artist_id", artistId)
        .eq("is_public", true)
        .order("sort_order", { ascending: true });
      return (data ?? []) as ServiceFact[];
    },

    async readAvailability(artistId): Promise<AvailabilityFacts> {
      const [rulesRes, blocksRes, policyRes] = await Promise.all([
        db
          .from("availability_rules")
          .select("weekday, start_time, end_time, is_open")
          .eq("artist_id", artistId),
        db
          .from("availability_blocks")
          .select("starts_at, ends_at, is_available")
          .eq("artist_id", artistId),
        db
          .from("booking_policies")
          .select("booking_window, min_notice_hours")
          .eq("artist_id", artistId)
          .maybeSingle(),
      ]);
      return {
        rules: rulesRes.data ?? [],
        blocks: blocksRes.data ?? [],
        bookingWindow: policyRes.data?.booking_window ?? null,
        minNoticeHours: policyRes.data?.min_notice_hours ?? null,
      };
    },

    async readBookingPolicy(artistId): Promise<BookingPolicyFacts | null> {
      const { data } = await db
        .from("booking_policies")
        .select(
          "booking_window, allow_image_uploads, allow_document_uploads, require_medical_disclosure, min_notice_hours",
        )
        .eq("artist_id", artistId)
        .maybeSingle();
      return (data as BookingPolicyFacts | null) ?? null;
    },

    async readPlaybook(artistId): Promise<PlaybookEntry[]> {
      const { data } = await db
        .from("agent_playbooks")
        .select("title, category, content")
        .eq("artist_id", artistId)
        .eq("is_active", true)
        .order("priority", { ascending: false });
      return (data ?? []) as PlaybookEntry[];
    },

    async readThread(threadId, limit): Promise<ThreadFacts | null> {
      const { data: thread } = await db
        .from("threads")
        .select("id, subject")
        .eq("id", threadId)
        .maybeSingle();
      if (!thread) return null;
      const { data: messages } = await db
        .from("messages")
        .select("sender_kind, body, created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: false })
        .limit(limit);
      const ordered = (messages ?? []).slice().reverse();
      return { id: thread.id, subject: thread.subject ?? null, messages: ordered };
    },

    async readBookingRequest(id): Promise<BookingRequestFacts | null> {
      const { data } = await db
        .from("booking_requests")
        .select(
          "id, service_id, placement, size_description, description, budget_min_cents, budget_max_cents, has_medical_flags, is_first_tattoo",
        )
        .eq("id", id)
        .maybeSingle();
      return (data as BookingRequestFacts | null) ?? null;
    },

    // --- JobRepo -----------------------------------------------------------
    async clientIdForThread(threadId): Promise<string | null> {
      const { data } = await db
        .from("threads")
        .select("client_id")
        .eq("id", threadId)
        .maybeSingle();
      return data?.client_id ?? null;
    },

    async clientIdForBookingRequest(bookingRequestId): Promise<string | null> {
      const { data } = await db
        .from("booking_requests")
        .select("client_id")
        .eq("id", bookingRequestId)
        .maybeSingle();
      return data?.client_id ?? null;
    },

    async leasePendingJobs(limit): Promise<AgentJob[]> {
      const { data, error } = await db.rpc("agent_jobs_lease", { p_limit: limit });
      if (error) throw new Error(`lease failed: ${error.message}`);
      return (data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        artist_id: r.artist_id as string,
        trigger_kind: r.trigger_kind as "message" | "booking_request",
        trigger_id: r.trigger_id as string,
        thread_id: (r.thread_id as string | null) ?? null,
        booking_request_id: (r.booking_request_id as string | null) ?? null,
        attempts: r.attempts as number,
        max_attempts: r.max_attempts as number,
      }));
    },

    async persistResult(
      action: AgentActionDraft,
      message: MessageDraft | null,
    ): Promise<{ actionId: string; messageId: string | null }> {
      // Insert the audit action first so the message can reference it.
      const { data: inserted, error: aErr } = await db
        .from("agent_actions")
        .insert({
          artist_id: action.artist_id,
          agent_role: action.agent_role,
          thread_id: action.thread_id,
          booking_request_id: action.booking_request_id,
          client_id: action.client_id,
          action_type: action.action_type,
          tier: action.tier,
          status: action.status,
          reasoning_summary: action.reasoning_summary,
          payload: action.payload,
          data_consulted: action.data_consulted,
          executed_at: action.status === "executed" ? new Date().toISOString() : null,
        })
        .select("id")
        .single();
      if (aErr) throw new Error(`persist action failed: ${aErr.message}`);
      const actionId = inserted.id as string;

      let messageId: string | null = null;
      if (message) {
        const { data: msg, error: mErr } = await db
          .from("messages")
          .insert({
            thread_id: message.thread_id,
            sender_kind: "agent",
            sender_profile_id: null,
            agent_action_id: actionId,
            body: message.body,
            drafted_by_agent: true,
          })
          .select("id")
          .single();
        if (mErr) throw new Error(`persist message failed: ${mErr.message}`);
        messageId = msg.id as string;
        await db
          .from("agent_actions")
          .update({ executed_message_id: messageId })
          .eq("id", actionId);
      }
      return { actionId, messageId };
    },

    async markJobDone(jobId, status): Promise<void> {
      await db.from("agent_jobs").update({ status }).eq("id", jobId);
    },

    async markJobFailed(jobId, error): Promise<void> {
      // attempts was already incremented at lease; re-queue until the cap, then
      // park as failed.
      const { data } = await db
        .from("agent_jobs")
        .select("attempts, max_attempts")
        .eq("id", jobId)
        .maybeSingle();
      const capped = data ? data.attempts >= data.max_attempts : true;
      await db
        .from("agent_jobs")
        .update({
          status: capped ? "failed" : "pending",
          last_error: error.slice(0, 2000),
        })
        .eq("id", jobId);
    },
  };
}
