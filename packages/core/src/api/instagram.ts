/**
 * Instagram import client: thin wrappers over the `instagram-oauth` /
 * `instagram-import` edge functions (see docs/instagram-integration.md), plus
 * an RLS-scoped read of the artist's own import-run history.
 *
 * KEY-GATED: every action works whether or not Michael has set the Meta app
 * secrets — `getInstagramStatus()` always resolves `{ configured, connected }`
 * so the UI can show an honest "coming soon" state instead of a broken button.
 * No Instagram token ever reaches the browser; `instagram_connections` has no
 * client-readable RLS policy by design (see the migration) — this module only
 * ever gets the sanitized status the edge function hands back.
 */
import type { InkdSupabaseClient } from "../supabase/client";
import type { InstagramImportRun } from "../types/rows";
import { clampLimit, unwrapList } from "./helpers";

// ===========================================================================
// Edge-function invocations
// ===========================================================================

export interface InstagramStatus {
  /** False until Michael sets IG_APP_ID/IG_APP_SECRET/IG_REDIRECT_URL. */
  configured: boolean;
  connected: boolean;
  ig_username: string | null;
  connected_at: string | null;
  token_expires_at: string | null;
  last_synced_at: string | null;
}

export interface InstagramAuthorizeUrlResult {
  url: string;
}

export interface InstagramImportSummary {
  run_id: string;
  status: "completed";
  mediaSeen: number;
  postsCreated: number;
  piecesCreated: number;
  mediaSkipped: number;
  alreadyImported: number;
}

interface InvokeErrorEnvelope {
  error?: { code?: string; message?: string };
}

/** Invoke an edge function and surface its `{ error: { code, message } }` body. */
async function invokeFunction<T>(
  client: InkdSupabaseClient,
  name: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.functions.invoke<T & InvokeErrorEnvelope>(
    name,
    { body: body ?? {} },
  );
  if (error) {
    let message = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const parsed = (await ctx.json()) as InvokeErrorEnvelope;
        if (parsed?.error?.message) message = parsed.error.message;
      } catch {
        // keep the original message
      }
    }
    throw new Error(message);
  }
  if (!data) throw new Error(`Empty response from ${name}`);
  const envelope = data as InvokeErrorEnvelope;
  if (envelope.error) {
    throw new Error(envelope.error.message ?? `Error from ${name}`);
  }
  return data as T;
}

/** Config + connection status for the current artist. Always safe to call —
 * never throws just because Instagram isn't configured yet. */
export async function getInstagramStatus(
  client: InkdSupabaseClient,
): Promise<InstagramStatus> {
  return invokeFunction<InstagramStatus>(client, "instagram-oauth", { action: "status" });
}

/** Start the OAuth flow: returns the Meta authorize URL to redirect to. */
export async function getInstagramAuthorizeUrl(
  client: InkdSupabaseClient,
): Promise<InstagramAuthorizeUrlResult> {
  return invokeFunction<InstagramAuthorizeUrlResult>(client, "instagram-oauth", {
    action: "authorize-url",
  });
}

/** Disconnect the current artist's Instagram account. */
export async function disconnectInstagram(client: InkdSupabaseClient): Promise<{ ok: true }> {
  return invokeFunction<{ ok: true }>(client, "instagram-oauth", { action: "disconnect" });
}

/** Manually refresh the long-lived token (60-day life; see docs for the
 * scheduled-refresh follow-up). */
export async function refreshInstagramToken(
  client: InkdSupabaseClient,
): Promise<{ ok: true; token_expires_at: string }> {
  return invokeFunction<{ ok: true; token_expires_at: string }>(client, "instagram-oauth", {
    action: "refresh",
  });
}

/** Start (or continue) importing the artist's IG media into posts +
 * portfolio_pieces. Idempotent — safe to call again for the next batch. */
export async function startInstagramImport(
  client: InkdSupabaseClient,
): Promise<InstagramImportSummary> {
  return invokeFunction<InstagramImportSummary>(client, "instagram-import");
}

// ===========================================================================
// RLS-scoped reads (no service role)
// ===========================================================================

/** Recent import runs for the artist's progress list, newest first. */
export async function listInstagramImportRuns(
  client: InkdSupabaseClient,
  artistId: string,
  opts: { limit?: number } = {},
): Promise<InstagramImportRun[]> {
  return unwrapList(
    await client
      .from("instagram_import_runs")
      .select("*")
      .eq("artist_id", artistId)
      .order("created_at", { ascending: false })
      .limit(clampLimit(opts.limit, 10)),
  );
}
