/**
 * Instagram import — mobile client surface (THIN ADAPTER over `@inkd/core`).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * This module is the single import point for every mobile IG screen. It no
 * longer duplicates the edge-function transport / error-mapping: that lives in
 * `@inkd/core` (`packages/core/src/api/instagram.ts`). Here we only:
 *   - re-export the shared `InstagramError` / `InstagramErrorKind`, and
 *   - adapt core's snake_case wire shapes into the camelCase shapes the mobile
 *     screens already consume (and derive the `status.state` the settings /
 *     onboarding cards read).
 * Core is the source of truth; when a name/shape differs, this file bridges it
 * so the mobile screens stay untouched.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Hard don'ts honored here (guide §7):
 *  - never persists/caches `previewUrl` (ephemeral IG CDN) — callers render it
 *    and drop it; nothing here writes it to storage.
 *  - never reads `instagram_connections` from the client — status/disconnect go
 *    through the JWT edge functions (via core) only.
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
import {
  InstagramError,
  IG_IMPORT_MAX,
  getStatus as coreGetStatus,
  startOAuth as coreStartOAuth,
  listMedia as coreListMedia,
  importMedia as coreImportMedia,
  disconnect as coreDisconnect,
  type InstagramErrorKind,
  type InstagramMediaType as CoreInstagramMediaType,
  type InstagramStatus as CoreInstagramStatus,
  type InstagramMediaItem as CoreInstagramMediaItem,
  type InstagramImportRunResult as CoreInstagramImportRun,
} from "@inkd/core/api";

// ===========================================================================
// Error model — shared with core so `instanceof InstagramError` matches
// across the app (core throws it, this adapter re-exports it).
// ===========================================================================

export { InstagramError };
export type { InstagramErrorKind };

/** Connection state used to drive the settings section + onboarding card. */
export type InstagramState = "connected" | InstagramErrorKind;

// ===========================================================================
// Wire types (camelCased from core's deployed contract, guide §2)
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

export type InstagramMediaType = CoreInstagramMediaType;

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
export const INSTAGRAM_IMPORT_CAP = IG_IMPORT_MAX;
export const INSTAGRAM_MEDIA_PAGE_SIZE = 24;

// ===========================================================================
// snake_case (core) → camelCase (mobile) mappers
// ===========================================================================

function toStatus(raw: CoreInstagramStatus): InstagramStatus {
  const connected = Boolean(raw.connected);
  const tokenExpired = Boolean(raw.token_expired);
  const state: InstagramState =
    raw.configured === false
      ? "comingSoon"
      : !connected
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
}

function toItem(it: CoreInstagramMediaItem): InstagramMediaItem {
  return {
    id: it.id,
    caption: it.caption ?? null,
    mediaType: it.media_type ?? null,
    permalink: it.permalink ?? null,
    timestamp: it.timestamp ?? null,
    previewUrl: it.preview_url ?? null,
    childCount: it.child_count ?? 0,
    importable: it.importable ?? true,
    alreadyImported: it.already_imported ?? false,
  };
}

function toRun(run: CoreInstagramImportRun): InstagramImportRun {
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

// ===========================================================================
// API functions — delegate to core, adapt the shape.
// ===========================================================================

/** Config + connection status. NEVER throws for the expected states — resolves
 *  to a status whose `state` drives the UI (comingSoon / notConnected /
 *  tokenExpired / forbidden / connected). Only genuine network failures land as
 *  `state: "error"`. Core's `getStatus` throws typed `InstagramError`s (e.g. 503
 *  → comingSoon); we catch and reflect them as a resolved status here. */
export async function getStatus(client: InkdSupabaseClient): Promise<InstagramStatus> {
  try {
    return toStatus(await coreGetStatus(client));
  } catch (err) {
    const kind = err instanceof InstagramError ? err.kind : "error";
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
 *  in-app path the callback appends (guide §6.2). Bridges mobile's `returnTo`
 *  onto core's `return_to`. */
export async function startOAuth(
  client: InkdSupabaseClient,
  opts: { returnTo?: string } = {},
): Promise<{ url: string }> {
  const { url } = await coreStartOAuth(client, opts.returnTo ? { return_to: opts.returnTo } : {});
  if (!url) throw new InstagramError("error", "No authorize URL returned.");
  return { url };
}

/** One page of the artist's IG media for the picker. Throws InstagramError
 *  (tokenExpired on 409, notConnected on 404, …). */
export async function listMedia(
  client: InkdSupabaseClient,
  opts: { after?: string | null; limit?: number } = {},
): Promise<InstagramMediaPage> {
  const page = await coreListMedia(client, {
    after: opts.after ?? null,
    limit: opts.limit ?? INSTAGRAM_MEDIA_PAGE_SIZE,
  });
  return { items: page.items.map(toItem), nextCursor: page.next_cursor ?? null };
}

/** Import the selected media (≤50 enforced by core). Synchronous — resolves
 *  with the finished run. */
export async function importMedia(
  client: InkdSupabaseClient,
  opts: { mediaIds: string[] },
): Promise<InstagramImportRun> {
  return toRun(await coreImportMedia(client, opts.mediaIds));
}

/** Delete the caller's connection row (imported posts stay). */
export async function disconnect(client: InkdSupabaseClient): Promise<{ ok: true }> {
  await coreDisconnect(client);
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
