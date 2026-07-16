// POST /functions/v1/notify-dispatch
//
// Drains the notification_deliveries queue: leases a batch (FOR UPDATE SKIP
// LOCKED via notification_deliveries_lease), then for each row loads the source
// notification + the recipient's push tokens / email and delivers it over Expo
// push or Resend email, marking the row sent/skipped/failed and pruning dead
// tokens. Invoked every minute by pg_cron (notify-dispatch-drain) once the Vault
// secrets are set, or on demand by an operator with the runner bearer.
//
// AUTH: verify_jwt = false at the gateway (config.toml); this function enforces
// the shared AI-runtime bearer token itself (AGENT_RUNNER_TOKEN, falls back to
// the service-role key — same as agent-run). See _shared/agent-auth.ts.
//
// NO-KEY SAFE: needs no external keys to run. With no tokens it skips push; with
// no RESEND_API_KEY it skips email (logged, not errored). The heavy logic lives
// in _shared/notification-dispatch.ts and is unit-tested offline.
import { isAuthorizedRunner } from "../_shared/agent-auth.ts";
import { getAdminClient, type SupabaseClient } from "../_shared/supabaseAdmin.ts";
import { errorResponse, jsonResponse } from "../_shared/errors.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { resolveAppUrl } from "../_shared/env.ts";
import {
  processDeliveries,
  type DispatchRepo,
} from "../_shared/notification-dispatch.ts";
import {
  buildExpoPushMessages,
  sendExpoPush,
  type DeviceToken,
} from "../_shared/expo-push.ts";
import {
  resolveEmailFrom,
  sendResendEmail,
} from "../_shared/notification-email.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  if (!isAuthorizedRunner(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const admin = getAdminClient();
    const repo = createRepo(admin);
    const appUrl = resolveAppUrl();
    const limit = await readLimit(req);

    const summary = await processDeliveries(
      {
        repo,
        appUrl,
        sendPush: async (tokens, content) => {
          const messages = buildExpoPushMessages(tokens, content);
          if (messages.length === 0) {
            return { tickets: [], invalidTokens: [], anyOk: false };
          }
          return await sendExpoPush(messages);
        },
        sendEmail: async ({ to, subject, html, text }) => {
          const apiKey = Deno.env.get("RESEND_API_KEY") as string; // gated upstream
          return await sendResendEmail({
            apiKey,
            from: resolveEmailFrom(),
            to,
            subject,
            html,
            text,
          });
        },
      },
      limit,
    );

    return jsonResponse({ ok: true, ...summary });
  } catch (err) {
    console.error("notify-dispatch:", err);
    return errorResponse(err);
  }
});

async function readLimit(req: Request): Promise<number> {
  try {
    const text = await req.text();
    if (!text) return 20;
    const body = JSON.parse(text) as { limit?: unknown };
    const n = typeof body.limit === "number" ? body.limit : 20;
    return Math.min(100, Math.max(1, Math.floor(n)));
  } catch {
    return 20;
  }
}

function createRepo(db: SupabaseClient): DispatchRepo {
  return {
    async leaseDeliveries(limit) {
      const { data, error } = await db.rpc("notification_deliveries_lease", {
        p_limit: limit,
      });
      if (error) throw new Error(`lease failed: ${error.message}`);
      return (data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        notification_id: r.notification_id as string,
        user_id: r.user_id as string,
        channel: r.channel as "push" | "email",
        attempts: r.attempts as number,
        max_attempts: r.max_attempts as number,
      }));
    },
    async loadNotification(id) {
      const { data } = await db
        .from("notifications")
        .select("id, type, title, body, action_url, data")
        .eq("id", id)
        .maybeSingle();
      if (!data) return null;
      return {
        id: data.id as string,
        type: data.type as string,
        title: (data.title as string | null) ?? null,
        body: (data.body as string | null) ?? null,
        action_url: (data.action_url as string | null) ?? null,
        data: (data.data as Record<string, unknown> | null) ?? null,
      };
    },
    async loadPushTokens(userId): Promise<DeviceToken[]> {
      const { data } = await db
        .from("device_push_tokens")
        .select("expo_push_token, platform")
        .eq("user_id", userId);
      return (data ?? []).map((r: Record<string, unknown>) => ({
        token: r.expo_push_token as string,
        platform: r.platform as DeviceToken["platform"],
      }));
    },
    async loadRecipient(userId) {
      const { data } = await db
        .from("profiles")
        .select("email, display_name")
        .eq("id", userId)
        .maybeSingle();
      return data
        ? { email: data.email ?? null, display_name: data.display_name ?? null }
        : null;
    },
    async unreadCount(userId) {
      const { count } = await db
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", userId)
        .eq("is_read", false);
      return count ?? 0;
    },
    async markSent(id, providerRef) {
      await db
        .from("notification_deliveries")
        .update({ status: "sent", sent_at: new Date().toISOString(), provider_ref: providerRef })
        .eq("id", id);
    },
    async markSkipped(id, reason) {
      await db
        .from("notification_deliveries")
        .update({ status: "skipped", last_error: reason })
        .eq("id", id);
    },
    async markFailed(id, error) {
      // attempts was incremented at lease; re-queue until the cap, then park.
      const { data } = await db
        .from("notification_deliveries")
        .select("attempts, max_attempts")
        .eq("id", id)
        .maybeSingle();
      const capped = data ? data.attempts >= data.max_attempts : true;
      await db
        .from("notification_deliveries")
        .update({ status: capped ? "failed" : "pending", last_error: error.slice(0, 2000) })
        .eq("id", id);
    },
    async deleteTokens(tokens) {
      if (tokens.length === 0) return;
      await db.from("device_push_tokens").delete().in("expo_push_token", tokens);
    },
  };
}
