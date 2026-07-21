/**
 * Instagram import client — the REAL deployed edge-function surface.
 *
 * Endpoints (Supabase functions, JWT-authenticated via `supabase.functions
 * .invoke`, which attaches `Authorization: Bearer <access_token>` + `apikey`):
 *   - `instagram-status`      → sanitized connection status (never the token)
 *   - `instagram-oauth-start` → fresh Meta authorize URL (mint per tap)
 *   - `instagram-media-list`  → paged, annotated media for the picker
 *   - `instagram-import`      → synchronous import of the SELECTED media ids
 *   - `instagram-disconnect`  → delete the caller's connection row
 *
 * Hard rules baked in (see INKD_Instagram_UI_Implementation_Guide §7):
 *   - No Instagram token ever reaches the browser. `instagram_connections` has
 *     no client-readable RLS policy by design — this module only ever gets the
 *     sanitized status the edge function hands back.
 *   - `preview_url` values are EPHEMERAL Instagram CDN URLs: render immediately,
 *     never persist/cache. This layer just passes them through.
 *   - The authorize URL is minted fresh every call (15-min HMAC state) — never
 *     cache it.
 *   - Import is explicit: callers pass the exact media ids the artist picked;
 *     ≤50 per call is enforced here (`assertImportBatch`).
 */
import type { InkdSupabaseClient } from "../supabase/client";
import type { InstagramImportRun } from "../types/rows";
import { clampLimit, unwrapList } from "./helpers";

// ===========================================================================
// Types — the deployed contract (INKD_Instagram_UI_Implementation_Guide §2)
// ===========================================================================

export type InstagramMediaType = "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | null;

/** Sanitized status from `instagram-status`. Never contains a token. */
export interface InstagramStatus {
  connected: boolean;
  ig_username: string | null;
  connected_at: string | null;
  last_synced_at: string | null;
  token_expired: boolean;
  /**
   * @deprecated Legacy field kept for backward-compat with the mobile scaffold
   * (which reads `status.configured`). The real `instagram-status` endpoint
   * omits it; "coming soon" now surfaces as a 503 → `InstagramError`
   * (`kind: "comingSoon"`). Remove once mobile migrates to `deriveInstagramState`.
   */
  configured?: boolean;
  /** @deprecated Legacy field; the sanitized status no longer exposes expiry. */
  token_expires_at?: string | null;
}

export interface InstagramAuthorizeUrlResult {
  url: string;
}

/** One row in the selection picker (`instagram-media-list`). */
export interface InstagramMediaItem {
  /** IG media id — pass to `importMedia`. */
  id: string;
  caption: string | null;
  media_type: InstagramMediaType;
  permalink: string | null;
  timestamp: string | null;
  /** EPHEMERAL Instagram CDN URL — render immediately, NEVER persist/cache. */
  preview_url: string | null;
  /** >0 for carousels. */
  child_count: number;
  /** false = copyright-flagged / no downloadable image. */
  importable: boolean;
  /** true = this artist already imported it. */
  already_imported: boolean;
}

export interface InstagramMediaPage {
  items: InstagramMediaItem[];
  next_cursor: string | null;
}

/** The finished run returned by `instagram-import` (synchronous). */
export interface InstagramImportRunResult {
  id: string;
  artist_id: string;
  status: "completed" | "failed";
  media_seen: number;
  posts_created: number;
  pieces_created: number;
  media_skipped: number;
  already_imported: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface InstagramDisconnectResult {
  ok: boolean;
  disconnected: boolean;
}

// ===========================================================================
// Typed errors — 401/403/404/409/503 → discriminated kinds
// ===========================================================================

/**
 * Discriminated states the UI reacts to. Mirrors the guide's error map:
 *   404 → notConnected · 409 → tokenExpired · 503 → comingSoon ·
 *   403 → forbidden · everything else (401/400/500/network) → error.
 */
export type InstagramErrorKind =
  | "notConnected"
  | "tokenExpired"
  | "comingSoon"
  | "forbidden"
  | "error";

export class InstagramError extends Error {
  readonly kind: InstagramErrorKind;
  readonly status?: number;
  /** Server error code from the `{ error, message }` envelope, when present. */
  readonly code?: string;

  constructor(
    kind: InstagramErrorKind,
    message: string,
    opts: { status?: number; code?: string } = {},
  ) {
    super(message);
    this.name = "InstagramError";
    this.kind = kind;
    this.status = opts.status;
    this.code = opts.code;
  }
}

/** Map an HTTP status to a discriminated error kind. */
export function instagramErrorKindForStatus(status: number | undefined): InstagramErrorKind {
  switch (status) {
    case 404:
      return "notConnected";
    case 409:
      return "tokenExpired";
    case 503:
      return "comingSoon";
    case 403:
      return "forbidden";
    default:
      return "error";
  }
}

const FRIENDLY_BY_KIND: Record<InstagramErrorKind, string> = {
  notConnected: "No Instagram account connected.",
  tokenExpired: "Your Instagram connection expired — reconnect to continue.",
  comingSoon: "Instagram import isn't available yet.",
  forbidden: "This account can't import from Instagram.",
  error: "Something went wrong with Instagram. Please try again.",
};

// ===========================================================================
// Edge-function invocation
// ===========================================================================

interface InvokeErrorEnvelope {
  error?: string | { code?: string; message?: string };
  message?: string;
}

/** Turn a Supabase FunctionsError into a typed `InstagramError`. */
async function toInstagramError(error: unknown, name: string): Promise<InstagramError> {
  let status: number | undefined;
  let code: string | undefined;
  let message = error instanceof Error ? error.message : `Error from ${name}`;

  const ctx = (error as { context?: Response }).context;
  if (ctx && typeof ctx.status === "number") {
    status = ctx.status;
    if (typeof ctx.json === "function") {
      try {
        const body = (await ctx.json()) as InvokeErrorEnvelope;
        if (typeof body?.error === "string") code = body.error;
        else if (body?.error?.code) code = body.error.code;
        const envMessage =
          (typeof body?.error === "object" ? body?.error?.message : undefined) ?? body?.message;
        if (envMessage) message = envMessage;
      } catch {
        // keep the transport-level message
      }
    }
  }

  const kind = instagramErrorKindForStatus(status);
  // Prefer the server message; fall back to a friendly per-kind default.
  if (!message || message === `Error from ${name}`) message = FRIENDLY_BY_KIND[kind];
  return new InstagramError(kind, message, { status, code });
}

/**
 * Invoke an Instagram edge function and normalize its result/error.
 *
 * NOTE on timeouts: we deliberately DO NOT attach an AbortSignal. `instagram
 * -import` is synchronous and can run a couple of minutes for a full batch;
 * the request must stay alive. Soft "still working" messaging lives in the
 * hook/UI layer and never cancels the request.
 */
async function invokeInstagram<T>(
  client: InkdSupabaseClient,
  name: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.functions.invoke<T>(name, { body: body ?? {} });
  if (error) throw await toInstagramError(error, name);
  if (data == null) throw new InstagramError("error", `Empty response from ${name}`);

  // Some functions still return a 200 with an `{ error }` envelope; surface it.
  const env = data as InvokeErrorEnvelope;
  if (env && typeof env === "object" && "error" in env && env.error) {
    const code = typeof env.error === "string" ? env.error : env.error?.code;
    const msg =
      (typeof env.error === "object" ? env.error?.message : undefined) ??
      env.message ??
      `Error from ${name}`;
    throw new InstagramError("error", msg, { code });
  }
  return data as T;
}

// ===========================================================================
// The five actions
// ===========================================================================

/** Sanitized connection status. Throws `InstagramError` on 503 (coming soon). */
export async function getStatus(client: InkdSupabaseClient): Promise<InstagramStatus> {
  return invokeInstagram<InstagramStatus>(client, "instagram-status");
}

/**
 * Start OAuth: returns the Meta authorize URL to redirect to. ALWAYS minted
 * fresh (never cache). `return_to` is a relative in-app path the callback
 * appends so onboarding/mobile land back where they started.
 */
export async function startOAuth(
  client: InkdSupabaseClient,
  opts: { return_to?: string } = {},
): Promise<InstagramAuthorizeUrlResult> {
  const body = opts.return_to ? { return_to: opts.return_to } : undefined;
  return invokeInstagram<InstagramAuthorizeUrlResult>(client, "instagram-oauth-start", body);
}

/** One page of the artist's IG media for the picker. `limit` clamped 1–50. */
export async function listMedia(
  client: InkdSupabaseClient,
  opts: { after?: string | null; limit?: number } = {},
): Promise<InstagramMediaPage> {
  const body: Record<string, unknown> = { limit: clampMediaLimit(opts.limit) };
  if (opts.after) body.after = opts.after;
  return invokeInstagram<InstagramMediaPage>(client, "instagram-media-list", body);
}

/**
 * Import the SELECTED media (≤50). Synchronous — resolves with the finished
 * run. Throws `RangeError` if the batch is empty or >50 (see `assertImportBatch`).
 */
export async function importMedia(
  client: InkdSupabaseClient,
  mediaIds: string[],
): Promise<InstagramImportRunResult> {
  const ids = assertImportBatch(mediaIds);
  const res = await invokeInstagram<{ run: InstagramImportRunResult }>(
    client,
    "instagram-import",
    { media_ids: ids },
  );
  return res.run;
}

/** Delete the caller's Instagram connection. Imported posts stay. */
export async function disconnect(client: InkdSupabaseClient): Promise<InstagramDisconnectResult> {
  return invokeInstagram<InstagramDisconnectResult>(client, "instagram-disconnect");
}

// ===========================================================================
// Pure helpers (unit-tested — see instagram.test.ts)
// ===========================================================================

/** Max media ids per import call (server truncates excess; we enforce hard). */
export const IG_IMPORT_MAX = 50;

/** Media-list page size clamp (server accepts 1–50, default 25). */
export function clampMediaLimit(limit: number | undefined): number {
  return clampLimit(limit == null ? 25 : Math.min(limit, IG_IMPORT_MAX), 25);
}

/** A media item the artist is allowed to select. */
export function isImportSelectable(item: InstagramMediaItem): boolean {
  return item.importable && !item.already_imported;
}

/** Can the artist add one more to a selection of `count`? */
export function canSelectMore(count: number): boolean {
  return count < IG_IMPORT_MAX;
}

/** How many more the artist may still select. */
export function remainingSelectable(count: number): number {
  return Math.max(0, IG_IMPORT_MAX - count);
}

/** Trim a set of ids to the per-call cap (keeps the first `IG_IMPORT_MAX`). */
export function capSelectionIds(ids: readonly string[]): string[] {
  return ids.slice(0, IG_IMPORT_MAX);
}

/**
 * Toggle a media id in a selection, honoring the cap and item eligibility.
 * Returns a NEW array (never mutates). A no-op when the item is ineligible or
 * adding would exceed the cap.
 */
export function toggleSelection(
  selected: readonly string[],
  item: InstagramMediaItem,
): string[] {
  if (selected.includes(item.id)) return selected.filter((id) => id !== item.id);
  if (!isImportSelectable(item)) return [...selected];
  if (!canSelectMore(selected.length)) return [...selected];
  return [...selected, item.id];
}

/**
 * Select every eligible item on the current page, without exceeding the cap.
 * Preserves the existing selection order, appends new eligible ids.
 */
export function selectAllOnPage(
  selected: readonly string[],
  pageItems: readonly InstagramMediaItem[],
): string[] {
  const next = [...selected];
  for (const item of pageItems) {
    if (next.length >= IG_IMPORT_MAX) break;
    if (isImportSelectable(item) && !next.includes(item.id)) next.push(item.id);
  }
  return next;
}

/** Validate an import batch: non-empty, ≤50. Returns a de-duped id array. */
export function assertImportBatch(mediaIds: readonly string[]): string[] {
  const ids = [...new Set(mediaIds)];
  if (ids.length === 0) throw new RangeError("Select at least one post to import.");
  if (ids.length > IG_IMPORT_MAX) {
    throw new RangeError(`Import up to ${IG_IMPORT_MAX} posts at a time.`);
  }
  return ids;
}

/** The batch-counter / cap messaging shown under the picker grid. */
export function selectionCapMessage(count: number): string {
  if (count >= IG_IMPORT_MAX) {
    return `${IG_IMPORT_MAX} selected — the max per import. Run it again for more.`;
  }
  const noun = count === 1 ? "post" : "posts";
  return `${count} ${noun} selected · up to ${IG_IMPORT_MAX} at a time`;
}

/**
 * Completion-sheet copy from a finished run:
 * "N posts imported, M skipped, K were already in your portfolio".
 */
export function buildCompletionMessage(run: {
  posts_created: number;
  media_skipped: number;
  already_imported: number;
}): string {
  const imported = `${run.posts_created} ${run.posts_created === 1 ? "post" : "posts"} imported`;
  const skipped = `${run.media_skipped} skipped`;
  const already = `${run.already_imported} ${run.already_imported === 1 ? "was" : "were"} already in your portfolio`;
  return `${imported}, ${skipped}, ${already}`;
}

/** Onboarding confirmation copy: "N pieces added to your portfolio". */
export function buildPiecesAddedMessage(run: { pieces_created: number }): string {
  const n = run.pieces_created;
  return `${n} ${n === 1 ? "piece" : "pieces"} added to your portfolio`;
}

// ---------------------------------------------------------------------------
// Server-derived connection state machine (§3.B)
// ---------------------------------------------------------------------------

export type InstagramConnectionState =
  | { kind: "loading" }
  | { kind: "comingSoon" }
  | { kind: "notConnected" }
  | {
      kind: "connected";
      username: string | null;
      connectedAt: string | null;
      lastSyncedAt: string | null;
    }
  | { kind: "tokenExpired" }
  | { kind: "forbidden" }
  | { kind: "error"; message: string };

/**
 * Derive the settings/onboarding UI state from the `instagram-status` query.
 * State is ALWAYS re-derived from the server — the `?instagram=` URL param only
 * drives a one-time toast, never the rendered state.
 */
export function deriveInstagramState(input: {
  data: InstagramStatus | undefined;
  error: unknown;
  isLoading: boolean;
}): InstagramConnectionState {
  const { data, error } = input;

  if (error instanceof InstagramError) {
    switch (error.kind) {
      case "comingSoon":
        return { kind: "comingSoon" };
      case "forbidden":
        return { kind: "forbidden" };
      case "tokenExpired":
        return { kind: "tokenExpired" };
      case "notConnected":
        return { kind: "notConnected" };
      default:
        return { kind: "error", message: error.message };
    }
  }
  if (error) {
    return {
      kind: "error",
      message: error instanceof Error ? error.message : "Something went wrong.",
    };
  }

  if (!data) return { kind: "loading" };

  // Legacy/mobile belt-and-suspenders: explicit `configured:false` → coming soon.
  if (data.configured === false) return { kind: "comingSoon" };

  if (!data.connected) return { kind: "notConnected" };
  if (data.token_expired) return { kind: "tokenExpired" };
  return {
    kind: "connected",
    username: data.ig_username,
    connectedAt: data.connected_at,
    lastSyncedAt: data.last_synced_at,
  };
}

// ===========================================================================
// Legacy-compat surface (mobile scaffold) — DEPRECATED
// ---------------------------------------------------------------------------
// The mobile connected-accounts / identity-editor still import the old hooks
// (see hooks/useInstagram.ts). These thin adapters keep them typechecking
// against the new endpoints until the mobile lane migrates. Web does NOT use
// them.
// ===========================================================================

/** @deprecated Use the finished `InstagramImportRunResult` instead. */
export interface InstagramImportSummary {
  run_id: string;
  status: "completed" | "failed";
  mediaSeen: number;
  postsCreated: number;
  piecesCreated: number;
  mediaSkipped: number;
  alreadyImported: number;
}

/** @deprecated Map a run to the legacy summary shape. */
export function runToSummary(run: InstagramImportRunResult): InstagramImportSummary {
  return {
    run_id: run.id,
    status: run.status,
    mediaSeen: run.media_seen,
    postsCreated: run.posts_created,
    piecesCreated: run.pieces_created,
    mediaSkipped: run.media_skipped,
    alreadyImported: run.already_imported,
  };
}

/** @deprecated Use {@link getStatus}. */
export const getInstagramStatus = getStatus;

/** @deprecated Use {@link startOAuth}. */
export async function getInstagramAuthorizeUrl(
  client: InkdSupabaseClient,
): Promise<InstagramAuthorizeUrlResult> {
  return startOAuth(client);
}

/** @deprecated Use {@link disconnect}. */
export async function disconnectInstagram(
  client: InkdSupabaseClient,
): Promise<InstagramDisconnectResult> {
  return disconnect(client);
}

/** @deprecated Use {@link importMedia} with an explicit selection. */
export async function startInstagramImport(
  client: InkdSupabaseClient,
  mediaIds: string[] = [],
): Promise<InstagramImportSummary> {
  return runToSummary(await importMedia(client, mediaIds));
}

// ===========================================================================
// RLS-scoped reads (no service role) — kept for the settings import history.
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
