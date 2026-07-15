/** Hooks: portfolio_pieces + posts CRUD and media uploads for the current artist. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  listPortfolioPieces,
  createPortfolioPiece,
  deletePortfolioPiece,
} from "../api/content";
import { uploadMedia } from "../api/storage";
import type { PortfolioPiece } from "../types/rows";
import { useInkdClient } from "./context";

const portfolioKey = (artistId: string) =>
  ["portfolioPieces", artistId] as const;

export function usePortfolioPieces(artistId: string) {
  const client = useInkdClient();
  return useQuery({
    queryKey: portfolioKey(artistId),
    queryFn: () => listPortfolioPieces(client, artistId),
    enabled: Boolean(artistId),
  });
}

export function usePortfolioMutations(artistId: string) {
  const client = useInkdClient();
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: portfolioKey(artistId) });

  return {
    createPiece: useMutation({
      mutationFn: (input: Parameters<typeof createPortfolioPiece>[2]) =>
        createPortfolioPiece(client, artistId, input),
      onSuccess: (_piece: PortfolioPiece) => invalidate(),
    }),
    deletePiece: useMutation({
      mutationFn: (id: string) => deletePortfolioPiece(client, id),
      onSuccess: invalidate,
    }),
  };
}

/** Upload an image to the media bucket; returns { path, url }. */
export function useUploadMedia() {
  const client = useInkdClient();
  return useMutation({
    mutationFn: (params: Parameters<typeof uploadMedia>[1]) =>
      uploadMedia(client, params),
  });
}
