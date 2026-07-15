/**
 * Hooks for own-profile management + public artist profile reads: the
 * artist_profiles record, the styles taxonomy, studio locations, and the
 * posts / portfolio_pieces / flash_sheets / flash_items content tabs.
 *
 * New file (companion to `./useProfile.ts`, `./useServices.ts`, etc.) so the
 * existing hook modules stay untouched.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getCurrentArtistProfile } from "../auth/role";
import {
  getArtistProfileById,
  updateArtistProfile,
  listStyles,
  listArtistStyles,
  addArtistStyle,
  removeArtistStyle,
} from "../api/artistProfiles";
import { listStudioLocations } from "../api/studioLocations";
import {
  listArtistPosts,
  createPost,
  deletePost,
  listPortfolioPieces,
  createPortfolioPiece,
  deletePortfolioPiece,
  listFlashSheets,
  listFlashItems,
  createFlashSheet,
  createFlashItem,
} from "../api/content";
import {
  updatePost,
  updatePortfolioPiece,
  reorderPortfolioPieces,
  setPortfolioCover,
  updateFlashSheet,
  deleteFlashSheet,
  updateFlashItem,
  deleteFlashItem,
  setFlashItemAvailability,
  listPostStyleIds,
  setPostStyles,
} from "../api/contentExtras";
import { uploadMedia, type MediaFolder, type UploadableFile } from "../api/media";
import { useInkdClient } from "./context";
import { contentQueryKeys } from "./queryKeysExtras";

// --- artist profile ----------------------------------------------------
export function useCurrentArtistProfile() {
  const client = useInkdClient();
  return useQuery({
    queryKey: contentQueryKeys.currentArtistProfile(),
    queryFn: () => getCurrentArtistProfile(client),
  });
}

export function useArtistProfile(artistId: string | undefined) {
  const client = useInkdClient();
  return useQuery({
    queryKey: contentQueryKeys.artistProfile(artistId ?? ""),
    queryFn: () => getArtistProfileById(client, artistId as string),
    enabled: Boolean(artistId),
  });
}

export function useUpdateArtistProfile(artistId: string | undefined) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Parameters<typeof updateArtistProfile>[2]) =>
      updateArtistProfile(client, artistId as string, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contentQueryKeys.currentArtistProfile() });
      if (artistId) {
        qc.invalidateQueries({ queryKey: contentQueryKeys.artistProfile(artistId) });
      }
    },
  });
}

// --- styles taxonomy + tagging ------------------------------------------
export function useStyles() {
  const client = useInkdClient();
  return useQuery({
    queryKey: contentQueryKeys.styles(),
    queryFn: () => listStyles(client),
    staleTime: 5 * 60_000,
  });
}

export function useArtistStyles(artistId: string | undefined) {
  const client = useInkdClient();
  return useQuery({
    queryKey: contentQueryKeys.artistStyles(artistId ?? ""),
    queryFn: () => listArtistStyles(client, artistId as string),
    enabled: Boolean(artistId),
  });
}

export function useArtistStyleMutations(artistId: string | undefined) {
  const client = useInkdClient();
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: contentQueryKeys.artistStyles(artistId ?? "") });
  return {
    add: useMutation({
      mutationFn: (styleId: string) =>
        addArtistStyle(client, artistId as string, styleId),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (styleId: string) =>
        removeArtistStyle(client, artistId as string, styleId),
      onSuccess: invalidate,
    }),
  };
}

// --- studio locations (read-only here; onboarding/settings own writes) --
export function useStudioLocations(artistId: string | undefined) {
  const client = useInkdClient();
  return useQuery({
    queryKey: contentQueryKeys.studioLocations(artistId ?? ""),
    queryFn: () => listStudioLocations(client, artistId as string),
    enabled: Boolean(artistId),
  });
}

// --- posts ---------------------------------------------------------------
export function useArtistPosts(artistId: string | undefined) {
  const client = useInkdClient();
  return useQuery({
    queryKey: contentQueryKeys.posts(artistId ?? ""),
    queryFn: () => listArtistPosts(client, artistId as string, { limit: 60 }),
    enabled: Boolean(artistId),
  });
}

export function usePostMutations(artistId: string | undefined) {
  const client = useInkdClient();
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: contentQueryKeys.posts(artistId ?? "") });
  return {
    create: useMutation({
      mutationFn: (input: Parameters<typeof createPost>[2]) =>
        createPost(client, artistId as string, input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (args: { id: string; patch: Parameters<typeof updatePost>[2] }) =>
        updatePost(client, args.id, args.patch),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deletePost(client, id),
      onSuccess: invalidate,
    }),
    setStyles: useMutation({
      mutationFn: (args: { postId: string; styleIds: string[] }) =>
        setPostStyles(client, args.postId, artistId as string, args.styleIds),
      onSuccess: invalidate,
    }),
  };
}

export function usePostStyleIds(postId: string | undefined) {
  const client = useInkdClient();
  return useQuery({
    queryKey: ["postStyles", postId ?? ""] as const,
    queryFn: () => listPostStyleIds(client, postId as string),
    enabled: Boolean(postId),
  });
}

// --- portfolio pieces ------------------------------------------------------
export function usePortfolioPieces(artistId: string | undefined) {
  const client = useInkdClient();
  return useQuery({
    queryKey: contentQueryKeys.portfolioPieces(artistId ?? ""),
    queryFn: () => listPortfolioPieces(client, artistId as string),
    enabled: Boolean(artistId),
  });
}

export function usePortfolioMutations(artistId: string | undefined) {
  const client = useInkdClient();
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: contentQueryKeys.portfolioPieces(artistId ?? "") });
  return {
    create: useMutation({
      mutationFn: (input: Parameters<typeof createPortfolioPiece>[2]) =>
        createPortfolioPiece(client, artistId as string, input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (args: {
        id: string;
        patch: Parameters<typeof updatePortfolioPiece>[2];
      }) => updatePortfolioPiece(client, args.id, args.patch),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deletePortfolioPiece(client, id),
      onSuccess: invalidate,
    }),
    reorder: useMutation({
      mutationFn: (orderedIds: string[]) =>
        reorderPortfolioPieces(client, artistId as string, orderedIds),
      onSuccess: invalidate,
    }),
    setCover: useMutation({
      mutationFn: (args: { pieceId: string; currentOrderedIds: string[] }) =>
        setPortfolioCover(client, artistId as string, args.pieceId, args.currentOrderedIds),
      onSuccess: invalidate,
    }),
  };
}

// --- flash sheets + items --------------------------------------------------
export function useFlashSheets(artistId: string | undefined) {
  const client = useInkdClient();
  return useQuery({
    queryKey: contentQueryKeys.flashSheets(artistId ?? ""),
    queryFn: () => listFlashSheets(client, artistId as string),
    enabled: Boolean(artistId),
  });
}

export function useFlashItems(flashSheetId: string | undefined) {
  const client = useInkdClient();
  return useQuery({
    queryKey: contentQueryKeys.flashItems(flashSheetId ?? ""),
    queryFn: () => listFlashItems(client, flashSheetId as string),
    enabled: Boolean(flashSheetId),
  });
}

export function useFlashSheetMutations(artistId: string | undefined) {
  const client = useInkdClient();
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: contentQueryKeys.flashSheets(artistId ?? "") });
  return {
    create: useMutation({
      mutationFn: (input: Parameters<typeof createFlashSheet>[2]) =>
        createFlashSheet(client, artistId as string, input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (args: { id: string; patch: Parameters<typeof updateFlashSheet>[2] }) =>
        updateFlashSheet(client, args.id, args.patch),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteFlashSheet(client, id),
      onSuccess: invalidate,
    }),
  };
}

export function useFlashItemMutations(artistId: string | undefined, flashSheetId: string | undefined) {
  const client = useInkdClient();
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: contentQueryKeys.flashItems(flashSheetId ?? "") });
  return {
    create: useMutation({
      mutationFn: (input: Parameters<typeof createFlashItem>[2]) =>
        createFlashItem(client, artistId as string, input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (args: { id: string; patch: Parameters<typeof updateFlashItem>[2] }) =>
        updateFlashItem(client, args.id, args.patch),
      onSuccess: invalidate,
    }),
    setAvailability: useMutation({
      mutationFn: (args: { id: string; isAvailable: boolean }) =>
        setFlashItemAvailability(client, args.id, args.isAvailable),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteFlashItem(client, id),
      onSuccess: invalidate,
    }),
  };
}

// --- media upload ------------------------------------------------------
export function useUploadMedia(userId: string | undefined) {
  const client = useInkdClient();
  return useMutation({
    mutationFn: (args: { folder: MediaFolder; file: UploadableFile }) =>
      uploadMedia(client, userId as string, args.folder, args.file),
  });
}
