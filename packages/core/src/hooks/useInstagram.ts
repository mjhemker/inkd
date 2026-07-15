/**
 * TanStack Query hooks for the Instagram import scaffold: config/connection
 * status, the OAuth authorize URL, disconnect, manual refresh, starting an
 * import run, and the artist's import-run history.
 *
 * New file — the existing hook barrel (`./index.ts`) just re-exports it,
 * append-only (mirrors `./useReviews.ts`). Query keys are kept local rather
 * than editing the shared `./queryKeys.ts` / `./queryKeysExtras.ts`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getInstagramStatus,
  getInstagramAuthorizeUrl,
  disconnectInstagram,
  refreshInstagramToken,
  startInstagramImport,
  listInstagramImportRuns,
  type InstagramStatus,
} from "../api/instagram";
import { useInkdClient } from "./context";

export const instagramQueryKeys = {
  status: (artistId: string) => ["instagram", "status", artistId] as const,
  importRuns: (artistId: string) => ["instagram", "importRuns", artistId] as const,
};

/** Config + connection status. Safe to call even when Instagram isn't
 * configured yet — resolves `{ configured: false, connected: false, ... }`. */
export function useInstagramStatus(artistId: string | undefined) {
  const client = useInkdClient();
  return useQuery<InstagramStatus>({
    queryKey: instagramQueryKeys.status(artistId ?? ""),
    queryFn: () => getInstagramStatus(client),
    enabled: Boolean(artistId),
    staleTime: 15_000,
  });
}

/** Recent import runs, newest first — the settings progress list. */
export function useInstagramImportRuns(artistId: string | undefined) {
  const client = useInkdClient();
  return useQuery({
    queryKey: instagramQueryKeys.importRuns(artistId ?? ""),
    queryFn: () => listInstagramImportRuns(client, artistId as string),
    enabled: Boolean(artistId),
  });
}

/** Kicks off OAuth: resolves the Meta authorize URL to redirect the browser to. */
export function useInstagramAuthorizeUrl() {
  const client = useInkdClient();
  return useMutation({
    mutationFn: () => getInstagramAuthorizeUrl(client),
  });
}

function useInvalidateInstagramStatus(artistId: string | undefined) {
  const qc = useQueryClient();
  return () => {
    if (artistId) qc.invalidateQueries({ queryKey: instagramQueryKeys.status(artistId) });
  };
}

export function useDisconnectInstagram(artistId: string | undefined) {
  const client = useInkdClient();
  const invalidate = useInvalidateInstagramStatus(artistId);
  return useMutation({
    mutationFn: () => disconnectInstagram(client),
    onSuccess: invalidate,
  });
}

export function useRefreshInstagramToken(artistId: string | undefined) {
  const client = useInkdClient();
  const invalidate = useInvalidateInstagramStatus(artistId);
  return useMutation({
    mutationFn: () => refreshInstagramToken(client),
    onSuccess: invalidate,
  });
}

/** Starts (or continues) an import run. Idempotent server-side — safe to
 * call again for the next batch. */
export function useStartInstagramImport(artistId: string | undefined) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => startInstagramImport(client),
    onSuccess: () => {
      if (!artistId) return;
      qc.invalidateQueries({ queryKey: instagramQueryKeys.status(artistId) });
      qc.invalidateQueries({ queryKey: instagramQueryKeys.importRuns(artistId) });
    },
  });
}
