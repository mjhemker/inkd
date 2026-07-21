/**
 * TanStack Query hooks for the Instagram import flow.
 *
 * NEW web surface (the wired flow):
 *   - useInstagramStatus       — server-derived connection status, refetch-on-focus
 *   - useInstagramConnectionState — status query mapped to the UI state machine
 *   - useInstagramStartOAuth   — mint a fresh authorize URL (+ optional return_to)
 *   - useInstagramMedia        — infinite picker paging via next_cursor
 *   - useInstagramImport       — selective import mutation + soft "still working"
 *   - useInstagramDisconnect   — delete the connection
 *
 * LEGACY-compat hooks (mobile scaffold — DEPRECATED, kept so the untouched
 * mobile screens keep typechecking until the mobile lane migrates):
 *   - useInstagramAuthorizeUrl · useStartInstagramImport · useInstagramImportRuns
 *
 * Query keys are kept local rather than editing the shared `./queryKeys.ts`.
 */
import { useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  getStatus,
  startOAuth,
  listMedia,
  importMedia,
  disconnect,
  deriveInstagramState,
  listInstagramImportRuns,
  getInstagramAuthorizeUrl,
  startInstagramImport,
  type InstagramStatus,
  type InstagramMediaPage,
  type InstagramImportRunResult,
  type InstagramConnectionState,
} from "../api/instagram";
import { useInkdClient } from "./context";

export const instagramQueryKeys = {
  status: (artistId: string) => ["instagram", "status", artistId] as const,
  media: (artistId: string) => ["instagram", "media", artistId] as const,
  importRuns: (artistId: string) => ["instagram", "importRuns", artistId] as const,
};

/** Media-list page size (server clamps 1–50). */
const MEDIA_PAGE_SIZE = 24;

/**
 * After this long with the import still in flight we flip a soft "still
 * working" flag — purely for messaging. The request is NEVER aborted.
 */
const IMPORT_SOFT_TIMEOUT_MS = 45_000;

// ===========================================================================
// Status
// ===========================================================================

/**
 * Server-derived connection status. Refetches on window focus so returning
 * from the OAuth full-page redirect immediately reflects reality. A 503
 * (coming soon) / 403 (no artist) resolves as a typed `InstagramError` on
 * `query.error` — don't retry those.
 */
export function useInstagramStatus(artistId: string | undefined) {
  const client = useInkdClient();
  return useQuery<InstagramStatus>({
    queryKey: instagramQueryKeys.status(artistId ?? ""),
    queryFn: () => getStatus(client),
    enabled: Boolean(artistId),
    refetchOnWindowFocus: true,
    staleTime: 10_000,
    retry: 1,
  });
}

/** The status query mapped through the pure `deriveInstagramState` machine. */
export function useInstagramConnectionState(
  artistId: string | undefined,
): { state: InstagramConnectionState; refetch: () => void; isFetching: boolean } {
  const query = useInstagramStatus(artistId);
  return {
    state: deriveInstagramState({
      data: query.data,
      error: query.error,
      isLoading: query.isLoading,
    }),
    refetch: () => void query.refetch(),
    isFetching: query.isFetching,
  };
}

function useInvalidateInstagramStatus(artistId: string | undefined) {
  const qc = useQueryClient();
  return () => {
    if (!artistId) return;
    qc.invalidateQueries({ queryKey: instagramQueryKeys.status(artistId) });
  };
}

// ===========================================================================
// OAuth
// ===========================================================================

/**
 * Mint a fresh authorize URL. Always call this per tap (never cache the URL —
 * 15-min HMAC state). `return_to` lets onboarding/mobile land back in place.
 */
export function useInstagramStartOAuth() {
  const client = useInkdClient();
  return useMutation({
    mutationFn: (opts: { return_to?: string } = {}) => startOAuth(client, opts),
  });
}

// ===========================================================================
// Media (picker) — infinite paging
// ===========================================================================

export function useInstagramMedia(
  artistId: string | undefined,
  opts: { enabled?: boolean } = {},
) {
  const client = useInkdClient();
  return useInfiniteQuery({
    queryKey: instagramQueryKeys.media(artistId ?? ""),
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      listMedia(client, { after: pageParam ?? undefined, limit: MEDIA_PAGE_SIZE }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: InstagramMediaPage) => lastPage.next_cursor ?? undefined,
    enabled: Boolean(artistId) && (opts.enabled ?? true),
    // Ephemeral CDN URLs go stale fast — don't keep serving old preview_urls.
    staleTime: 30_000,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

// ===========================================================================
// Import — selective, synchronous, soft-timeout messaging
// ===========================================================================

export interface UseInstagramImportResult {
  /** Run the import for the given selected media ids (≤50). */
  importSelected: (mediaIds: string[]) => Promise<InstagramImportRunResult>;
  isImporting: boolean;
  /** True once the request has been in flight past the soft timeout. */
  softTimedOut: boolean;
  run: InstagramImportRunResult | undefined;
  error: Error | null;
  reset: () => void;
}

/**
 * Selective import. Keeps the request alive (no abort); after a soft timeout it
 * flips `softTimedOut` so the UI can say "Still working — check your portfolio
 * in a minute" instead of blindly resubmitting.
 */
export function useInstagramImport(artistId: string | undefined): UseInstagramImportResult {
  const client = useInkdClient();
  const qc = useQueryClient();
  const [softTimedOut, setSoftTimedOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const mutation = useMutation<InstagramImportRunResult, Error, string[]>({
    mutationFn: (mediaIds: string[]) => importMedia(client, mediaIds),
    onMutate: () => {
      setSoftTimedOut(false);
      clearTimer();
      timerRef.current = setTimeout(() => setSoftTimedOut(true), IMPORT_SOFT_TIMEOUT_MS);
    },
    onSettled: () => {
      clearTimer();
      if (!artistId) return;
      qc.invalidateQueries({ queryKey: instagramQueryKeys.status(artistId) });
      qc.invalidateQueries({ queryKey: instagramQueryKeys.media(artistId) });
      qc.invalidateQueries({ queryKey: instagramQueryKeys.importRuns(artistId) });
    },
  });

  return {
    importSelected: (mediaIds: string[]) => mutation.mutateAsync(mediaIds),
    isImporting: mutation.isPending,
    softTimedOut,
    run: mutation.data,
    error: mutation.error,
    reset: () => {
      clearTimer();
      setSoftTimedOut(false);
      mutation.reset();
    },
  };
}

// ===========================================================================
// Disconnect
// ===========================================================================

export function useInstagramDisconnect(artistId: string | undefined) {
  const client = useInkdClient();
  const invalidate = useInvalidateInstagramStatus(artistId);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => disconnect(client),
    onSuccess: () => {
      invalidate();
      if (artistId) qc.invalidateQueries({ queryKey: instagramQueryKeys.media(artistId) });
    },
  });
}

// ===========================================================================
// LEGACY-compat hooks (mobile scaffold) — DEPRECATED
// ===========================================================================

/** @deprecated Legacy alias for {@link useInstagramDisconnect}. */
export const useDisconnectInstagram = useInstagramDisconnect;

/** @deprecated Use {@link useInstagramStartOAuth}. */
export function useInstagramAuthorizeUrl() {
  const client = useInkdClient();
  return useMutation({ mutationFn: () => getInstagramAuthorizeUrl(client) });
}

/** @deprecated Recent import runs, newest first (RLS read). */
export function useInstagramImportRuns(artistId: string | undefined) {
  const client = useInkdClient();
  return useQuery({
    queryKey: instagramQueryKeys.importRuns(artistId ?? ""),
    queryFn: () => listInstagramImportRuns(client, artistId as string),
    enabled: Boolean(artistId),
  });
}

/**
 * @deprecated Use {@link useInstagramImport} with an explicit selection. This
 * legacy shim (mobile scaffold) has no selection to pass — the new endpoint
 * requires explicit media ids, so it rejects until the mobile lane wires the
 * picker. Kept only so the untouched mobile screens keep typechecking.
 */
export function useStartInstagramImport(artistId: string | undefined) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => startInstagramImport(client, []),
    onSuccess: () => {
      if (!artistId) return;
      qc.invalidateQueries({ queryKey: instagramQueryKeys.status(artistId) });
      qc.invalidateQueries({ queryKey: instagramQueryKeys.importRuns(artistId) });
    },
  });
}
