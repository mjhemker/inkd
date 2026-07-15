// POST /functions/v1/approve-agent-action
//
// The trust UI's approve/reject control (SPEC §5 "approval-queue inbox"). The
// authenticated caller must be the OWNING artist; a `proposed` action then either
// executes (posting the agent message when client-facing, linking
// executed_message_id) or is rejected. An edited draft is honoured on approve and
// recorded into payload.edited.
//
// CONTRACT:
//   POST { action_id, decision: 'approve' | 'reject', edited_draft? }
//     -> { status: 'executed' | 'rejected', message_id }
//
// AUTH: verify_jwt = true (config.toml) + we re-verify + resolve the caller's
// artist_profiles.id server-side. Writes use the service role (RLS bypass) but
// only AFTER the ownership check in applyApproval.
import { handlePreflight } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { getAdminClient, type SupabaseClient } from "../_shared/supabaseAdmin.ts";
import { AppError, errors, errorResponse, jsonResponse } from "../_shared/errors.ts";
import {
  applyApproval,
  type ApprovalActionRow,
  type ApprovalRepo,
} from "../_shared/agent-approval.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    if (req.method !== "POST") throw errors.badRequest("Use POST");

    const user = await requireUser(req);
    const body = await safeJson(req);
    const actionId = str(body?.action_id);
    const decision = str(body?.decision);
    const editedDraft = typeof body?.edited_draft === "string" ? body.edited_draft : undefined;
    if (!actionId) throw errors.badRequest("action_id is required");
    if (decision !== "approve" && decision !== "reject") {
      throw errors.badRequest("decision must be 'approve' or 'reject'");
    }

    const admin = getAdminClient();

    // Resolve the caller's artist_profiles.id (they must own the action).
    const { data: artist, error: aErr } = await admin
      .from("artist_profiles")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (aErr) throw errors.server(aErr.message);
    if (!artist) throw errors.forbidden("Only an artist can approve assistant actions");

    const repo = createRepo(admin);
    const result = await applyApproval(repo, {
      actionId,
      decision,
      approverArtistId: artist.id,
      approverProfileId: user.id,
      editedDraft,
    });

    return jsonResponse({ status: result.status, message_id: result.messageId });
  } catch (err) {
    if (!(err instanceof AppError)) console.error("approve-agent-action:", err);
    return errorResponse(err);
  }
});

async function safeJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await req.text();
    if (!text) return null;
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function str(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

// ---------------------------------------------------------------------------
// Service-role repository implementing the ApprovalRepo IO contract.
// ---------------------------------------------------------------------------
function createRepo(db: SupabaseClient): ApprovalRepo {
  return {
    async getAction(actionId): Promise<ApprovalActionRow | null> {
      const { data, error } = await db
        .from("agent_actions")
        .select("id, artist_id, action_type, status, thread_id, payload")
        .eq("id", actionId)
        .maybeSingle();
      if (error) throw errors.server(error.message);
      if (!data) return null;
      return {
        id: data.id,
        artist_id: data.artist_id,
        action_type: data.action_type,
        status: data.status,
        thread_id: data.thread_id ?? null,
        payload: data.payload ?? { context_used: [], trigger: { kind: "message", id: "" } },
      };
    },

    async insertAgentMessage({ thread_id, body, agent_action_id }): Promise<string> {
      const { data, error } = await db
        .from("messages")
        .insert({
          thread_id,
          sender_kind: "agent",
          sender_profile_id: null,
          agent_action_id,
          body,
          drafted_by_agent: true,
        })
        .select("id")
        .single();
      if (error) throw errors.server(`insert message failed: ${error.message}`);
      return data.id as string;
    },

    async markExecuted({ actionId, approverProfileId, executedMessageId, editedDraft }): Promise<void> {
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = {
        status: "executed",
        approved_by: approverProfileId,
        approved_at: now,
        executed_at: now,
        executed_message_id: executedMessageId,
      };
      if (editedDraft != null) {
        // Merge payload.edited without clobbering the rest of the payload.
        const { data: existing } = await db
          .from("agent_actions")
          .select("payload")
          .eq("id", actionId)
          .maybeSingle();
        const payload = (existing?.payload ?? {}) as Record<string, unknown>;
        payload.edited = {
          draft_text: editedDraft,
          edited_by: approverProfileId,
          edited_at: now,
        };
        payload.draft_text = editedDraft;
        patch.payload = payload;
      }
      const { error } = await db.from("agent_actions").update(patch).eq("id", actionId);
      if (error) throw errors.server(`mark executed failed: ${error.message}`);
    },

    async markRejected({ actionId, approverProfileId }): Promise<void> {
      const now = new Date().toISOString();
      const { error } = await db
        .from("agent_actions")
        .update({ status: "rejected", approved_by: approverProfileId, rejected_at: now })
        .eq("id", actionId);
      if (error) throw errors.server(`mark rejected failed: ${error.message}`);
    },
  };
}
