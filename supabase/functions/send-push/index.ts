// POST /functions/v1/send-push
//
// Standalone Expo push sender. Deliver an ad-hoc push to a user's registered
// devices (or to explicit tokens). notify-dispatch handles the queue path; this
// function exists for direct/manual sends and for testing the push pipeline end
// to end. Prunes DeviceNotRegistered tokens like the dispatcher does.
//
// AUTH: verify_jwt = false at the gateway (config.toml); enforces the shared
// AI-runtime bearer itself (server-to-server, same as notify-dispatch).
//
// Body: { user_id?: string, tokens?: {token,platform}[], title, body,
//         data?: object, badge?: number }. One of user_id / tokens is required.
//
// NO-KEY SAFE: Expo push needs no secret. With no tokens it returns ok:true with
// sent:0 rather than erroring.
import { isAuthorizedRunner } from "../_shared/agent-auth.ts";
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { errorResponse, jsonResponse, errors } from "../_shared/errors.ts";
import { handlePreflight } from "../_shared/cors.ts";
import {
  buildExpoPushMessages,
  sendExpoPush,
  type DeviceToken,
} from "../_shared/expo-push.ts";

interface SendPushBody {
  user_id?: string;
  tokens?: DeviceToken[];
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  badge?: number;
}

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
    const body = (await req.json()) as SendPushBody;
    if (!body.title || !body.body) {
      throw errors.badRequest("title and body are required");
    }

    let tokens: DeviceToken[] = body.tokens ?? [];
    if (tokens.length === 0) {
      if (!body.user_id) {
        throw errors.badRequest("provide user_id or tokens");
      }
      const admin = getAdminClient();
      const { data } = await admin
        .from("device_push_tokens")
        .select("expo_push_token, platform")
        .eq("user_id", body.user_id);
      tokens = (data ?? []).map((r: Record<string, unknown>) => ({
        token: r.expo_push_token as string,
        platform: r.platform as DeviceToken["platform"],
      }));
    }

    if (tokens.length === 0) {
      return jsonResponse({ ok: true, sent: 0, reason: "no_tokens" });
    }

    const messages = buildExpoPushMessages(tokens, {
      title: body.title,
      body: body.body,
      data: body.data ?? {},
      badge: body.badge,
    });
    if (messages.length === 0) {
      return jsonResponse({ ok: true, sent: 0, reason: "no_valid_tokens" });
    }

    const result = await sendExpoPush(messages);

    if (result.invalidTokens.length > 0) {
      const admin = getAdminClient();
      await admin
        .from("device_push_tokens")
        .delete()
        .in("expo_push_token", result.invalidTokens);
    }

    const sent = result.tickets.filter((t) => t.status === "ok").length;
    return jsonResponse({
      ok: true,
      sent,
      pruned: result.invalidTokens.length,
      tickets: result.tickets,
    });
  } catch (err) {
    console.error("send-push:", err);
    return errorResponse(err);
  }
});
