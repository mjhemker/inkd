/**
 * Instagram import — mobile client surface (SINGLE SWAP POINT).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * MERGE: replace this whole module with the real `@inkd/core` instagram
 * exports. A parallel agent owns packages/core's rewritten surface:
 *   getStatus / startOAuth({return_to?}) / listMedia / importMedia / disconnect
 *   + hooks useInstagramStatus / useInstagramMedia / useInstagramImport
 *     / useInstagramDisconnect
 *   + error kinds notConnected | tokenExpired | comingSoon | forbidden | error
 * Every mobile IG screen/component imports ONLY from this file, so the
 * integrator swaps these implementations for `@inkd/core` re-exports in one
 * place. Names/shapes here mirror the deployed edge-function contract
 * (INKD_Instagram_UI_Implementation_Guide §2) so this stub is also functional
 * against the LIVE functions for real-device QA.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Hard don'ts honored here (guide §7):
 *  - never persists/caches `previewUrl` (ephemeral IG CDN) — callers render it
 *    and drop it; nothing here writes it to storage.
 *  - never reads `instagram_connections` from the client — status/disconnect go
 *    through the JWT edge functions only.
 *  - the authorize URL is minted fresh per call (`startOAuth`) — never cached.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { InkdSupabaseClient } from "@inkd/core/supabase";
import { useInkdClient } from "@inkd/core/hooks";

// ===========================================================================
// Error model
// ===========================================================================

/** The five documented failure states, plus they double as connection states. */
export type InstagramErrorKind =
  | "notConnected"
  | "tokenExpired"
  | "comingSoon"
  | "forbidden"
  | "error";

/** Connection state used to drive the settings section + onboarding card. */
export type InstagramState = "connected" | InstagramErrorKind;

export class InstagramError extends Error {
  readonly kind: InstagramErrorKind;
  readonly status: number;
  readonly code: string;
  constructor(kind: InstagramErrorKind, message: string, status = 0, code = "") {
    super(message);
    this.name = "InstagramError";
    this.kind = kind;
    this.status = status;
    this.code = code;
  }
}

// ===========================================================================
// Wire types (camelCased from the deployed contract, guide §2)
// ===========================================================================

export interface InstagramStatus {
  /** Derived: connected | notConnected | tokenExpired | comingSoon | forbidden | error. */
  state: InstagramState;
  connected: boolean;
  /** False only in the "coming soon" (secrets unset / 503) case. */
  configured: boolean;
  igUsername: string | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  tokenExpired: boolean;
}

export type InstagramMediaType = "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | null;

export interface InstagramMediaItem {
  /** IG media id — pass to importMedia. */
  id: string;
  caption: string | null;
  mediaType: InstagramMediaType;
  permalink: string | null;
  timestamp: string | null;
  /** EPHEMERAL Instagram CDN url — render immediately, NEVER persist (guide §7). */
  previewUrl: string | null;
  /** >0 for carousels. */
  childCount: number;
  /** false = copyright-flagged / no downloadable image. */
  importable: boolean;
  alreadyImported: boolean;
}

export interface InstagramMediaPage {
  items: InstagramMediaItem[];
  nextCursor: string | null;
}

export interface InstagramImportRun {
  id: string;
  artistId: string;
  status: "completed" | "failed";
  mediaSeen: number;
  postsCreated: number;
  piecesCreated: number;
  mediaSkipped: number;
  alreadyImported: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
}

// ===========================================================================
// Constants
// ===========================================================================

/** Server hard cap per import run (guide §2.4) — enforce in the picker UI. */
export const INSTAGRAM_IMPORT_CAP = 50;
export const INSTAGRAM_MEDIA_PAGE_SIZE = 24;

/** Deployed edge-function names (guide §1 / §6). Central so the integrator can
 *  reconcile if core names differ. */
const FN = {
  status: "instagram-status", // §6.1 (JWT)
  oauthStart: "instagram-oauth-start", // §2.1 (JWT)
  mediaList: "instagram-media-list", // §2.3 (JWT)
  import: "instagram-import", // §2.4 (JWT)
  disconnect: "instagram-disconnect", // §6.3 (JWT)
} as const;

// ===========================================================================
// Invoke helper — maps the standard `{error: <code>, message}` envelope
// (and HTTP status) onto InstagramErrorKind.
// ===========================================================================

function kindFor(code: string, status: number): InstagramErrorKind {
  switch (code) {
    case "instagram_not_configured":
    case "not_configured":
      return "comingSoon";
    case "not_found":
      return "notConnected";
    case "conflict":
      return "tokenExpired";
    case "forbidden":
      return "forbidden";
  }
  switch (status) {
    case 503:
      return "comingSoon";
    case 404:
      return "notConnected";
    case 409:
      return "tokenExpired";
    case 403:
      return "forbidden";
  }
  return "error";
}

async function invokeIg<T>(
  client: InkdSupabaseClient,
  name: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.functions.invoke<T & { error?: unknown }>(
    name,
    { body: body ?? {} },
  );

  if (error) {
    const ctx = (error as { context?: Response }).context;
    let status = 0;
    let code = "";
    let message = error.message || "Something went wrong with Instagram.";
    if (ctx && typeof ctx.json === "function") {
      status = typeof ctx.status === "number" ? ctx.status : 0;
      try {
        const parsed = (await ctx.clone().json()) as {
          error?: string | { code?: string; message?: string };
          message?: string;
        };
        if (typeof parsed.error === "string") code = parsed.error;
        else if (parsed.error && typeof parsed.error === "object")
          code = parsed.error.code ?? "";
        if (typeof parsed.message === "string") message = parsed.message;
        else if (parsed.error && typeof parsed.error === "object" && parsed.error.message)
          message = parsed.error.message;
      } catch {
        /* non-JSON body — keep defaults */
      }
    }
    throw new InstagramError(kindFor(code, status), message, status, code);
  }

  if (!data) throw new InstagramError("error", `Empty response from ${name}.`);
  const envelope = data as { error?: string | { code?: string; message?: string } };
  if (envelope.error) {
    const code =
      typeof envelope.error === "string" ? envelope.error : envelope.error.code ?? "";
    const message =
      typeof envelope.error === "object" && envelope.error.message
        ? envelope.error.message
        : `Error from ${name}.`;
    throw new InstagramError(kindFor(code, 0), message, 0, code);
  }
  return data as T;
}

// ===========================================================================
// API functions
// ===========================================================================

/** Config + connection status. NEVER throws for the expected states — resolves
 *  to a status whose `state` drives the UI (comingSoon / notConnected /
 *  tokenExpired / forbidden / connected). Only genuine network failures land as
 *  `state: "error"`. */
export async function getStatus(client: InkdSupabaseClient): Promise<InstagramStatus> {
  try {
    const raw = await invokeIg<{
      connected?: boolean;
      configured?: boolean;
      ig_username?: string | null;
      connected_at?: string | null;
      last_synced_at?: string | null;
      token_expired?: boolean;
    }>(client, FN.status);

    const connected = Boolean(raw.connected);
    const tokenExpired = Boolean(raw.token_expired);
    const state: InstagramState = !connected
      ? "notConnected"
      : tokenExpired
        ? "tokenExpired"
        : "connected";
    return {
      state,
      connected,
      configured: raw.configured ?? true,
      igUsername: raw.ig_username ?? null,
      connectedAt: raw.connected_at ?? null,
      lastSyncedAt: raw.last_synced_at ?? null,
      tokenExpired,
    };
  } catch (err) {
    const kind = err instanceof InstagramError ? err.kind : "error";
    // comingSoon / forbidden / (network) error → surface as a resolved status
    // state so the settings section renders honestly instead of erroring out.
    return {
      state: kind,
      connected: false,
      configured: kind !== "comingSoon",
      igUsername: null,
      connectedAt: null,
      lastSyncedAt: null,
      tokenExpired: kind === "tokenExpired",
    };
  }
}

/** Mint a FRESH authorize URL (guide §7: never cache). `returnTo` is a relative
 *  in-app path the callback appends (guide §6.2, optional server support). */
export async function startOAuth(
  client: InkdSupabaseClient,
  opts: { returnTo?: string } = {},
): Promise<{ url: string }> {
  const body: Record<string, unknown> = {};
  if (opts.returnTo) body.return_to = opts.returnTo;
  const raw = await invokeIg<{ url?: string }>(client, FN.oauthStart, body);
  if (!raw.url) throw new InstagramError("error", "No authorize URL returned.");
  return { url: raw.url };
}

/** One page of the artist's IG media for the picker. Throws InstagramError
 *  (tokenExpired on 409, notConnected on 404, …). */
export async function listMedia(
  client: InkdSupabaseClient,
  opts: { after?: string | null; limit?: number } = {},
): Promise<InstagramMediaPage> {
  const body: Record<string, unknown> = {
    limit: opts.limit ?? INSTAGRAM_MEDIA_PAGE_SIZE,
  };
  if (opts.after) body.after = opts.after;
  const raw = await invokeIg<{
    items?: {
      id: string;
      caption?: string | null;
      media_type?: InstagramMediaType;
      permalink?: string | null;
      timestamp?: string | null;
      preview_url?: string | null;
      child_count?: number;
      importable?: boolean;
      already_imported?: boolean;
    }[];
    next_cursor?: string | null;
  }>(client, FN.mediaList, body);

  const items: InstagramMediaItem[] = (raw.items ?? []).map((it) => ({
    id: it.id,
    caption: it.caption ?? null,
    mediaType: it.media_type ?? null,
    permalink: it.permalink ?? null,
    timestamp: it.timestamp ?? null,
    previewUrl: it.preview_url ?? null,
    childCount: it.child_count ?? 0,
    importable: it.importable ?? true,
    alreadyImported: it.already_imported ?? false,
  }));
  return { items, nextCursor: raw.next_cursor ?? null };
}

/** Import the selected media (≤50 enforced here + server-side). Synchronous —
 *  resolves with the finished run. */
export async function importMedia(
  client: InkdSupabaseClient,
  opts: { mediaIds: string[] },
): Promise<InstagramImportRun> {
  const mediaIds = opts.mediaIds.slice(0, INSTAGRAM_IMPORT_CAP);
  const raw = await invokeIg<{
    run?: {
      id: string;
      artist_id: string;
      status: "completed" | "failed";
      media_seen?: number;
      posts_created?: number;
      pieces_created?: number;
      media_skipped?: number;
      already_imported?: number;
      error_message?: string | null;
      started_at?: string | null;
      completed_at?: string | null;
      created_at?: string | null;
    };
  }>(client, FN.import, { media_ids: mediaIds });

  const run = raw.run;
  if (!run) throw new InstagramError("error", "Import returned no run.");
  return {
    id: run.id,
    artistId: run.artist_id,
    status: run.status,
    mediaSeen: run.media_seen ?? 0,
    postsCreated: run.posts_created ?? 0,
    piecesCreated: run.pieces_created ?? 0,
    mediaSkipped: run.media_skipped ?? 0,
    alreadyImported: run.already_imported ?? 0,
    errorMessage: run.error_message ?? null,
    startedAt: run.started_at ?? null,
    completedAt: run.completed_at ?? null,
    createdAt: run.created_at ?? null,
  };
}

/** Delete the caller's connection row (imported posts stay). */
export async function disconnect(client: InkdSupabaseClient): Promise<{ ok: true }> {
  await invokeIg<{ ok?: boolean }>(client, FN.disconnect);
  return { ok: true };
}

// ===========================================================================
// Query keys + hooks
// ===========================================================================

export const instagramKeys = {
  status: (artistId: string) => ["instagram", "status", artistId] as const,
  media: (artistId: string) => ["instagram", "media", artistId] as const,
};

/** Connection status for the current artist. Poll-friendly (used as the source
 *  of truth after the OAuth round-trip). */
export function useInstagramStatus(artistId: string | undefined) {
  const client = useInkdClient();
  return useQuery<InstagramStatus>({
    queryKey: instagramKeys.status(artistId ?? ""),
    queryFn: () => getStatus(client),
    enabled: Boolean(artistId),
    staleTime: 10_000,
  });
}

/** Paged IG media for the picker (infinite scroll via next_cursor). */
export function useInstagramMedia(
  artistId: string | undefined,
  opts: { enabled?: boolean } = {},
) {
  const client = useInkdClient();
  return useInfiniteQuery<InstagramMediaPage, InstagramError>({
    queryKey: instagramKeys.media(artistId ?? ""),
    queryFn: ({ pageParam }) =>
      listMedia(client, { after: (pageParam as string | null) ?? null }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(artistId) && (opts.enabled ?? true),
    staleTime: 30_000,
    // Ephemeral CDN previews expire; don't hold stale pages in the background.
    gcTime: 60_000,
  });
}

/** Fresh authorize URL per tap (never cached). */
export function useInstagramStartOAuth() {
  const client = useInkdClient();
  return useMutation({
    mutationFn: (opts: { returnTo?: string } = {}) => startOAuth(client, opts),
  });
}

/** Synchronous import of the selected media ids. */
export function useInstagramImport(artistId: string | undefined) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation<InstagramImportRun, InstagramError, { mediaIds: string[] }>({
    mutationFn: (vars) => importMedia(client, vars),
    onSuccess: () => {
      if (!artistId) return;
      // Re-annotate already_imported + refresh last-synced.
      qc.invalidateQueries({ queryKey: instagramKeys.media(artistId) });
      qc.invalidateQueries({ queryKey: instagramKeys.status(artistId) });
    },
  });
}

/** Disconnect + refresh status. */
export function useInstagramDisconnect(artistId: string | undefined) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => disconnect(client),
    onSuccess: () => {
      if (!artistId) return;
      qc.invalidateQueries({ queryKey: instagramKeys.status(artistId) });
      qc.removeQueries({ queryKey: instagramKeys.media(artistId) });
    },
  });
}
