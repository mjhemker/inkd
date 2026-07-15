/**
 * TanStack Query hooks for reviews: an artist's visible review list (used by
 * both the public profile's Reviews tab and the artist's own booking view),
 * the review already on a specific booking (leave-a-review gating), and the
 * client-author + artist-response mutations.
 *
 * New file — the existing hook barrel (`./index.ts`) just re-exports it,
 * append-only. Query keys are kept local (mirrors `./useBookingPipeline.ts`)
 * rather than editing the shared `./queryKeys.ts` / `./queryKeysExtras.ts`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  listArtistReviews,
  listClientReviews,
  listProfilesByIds,
  getReviewByBookingId,
  createReview,
  updateReview,
  setArtistReviewResponse,
} from "../api/reviews";
import { summarizeReviews, type ReviewAggregate } from "../reviews/derive";
import type { Profile, Review } from "../types/rows";
import { useInkdClient } from "./context";

export const reviewQueryKeys = {
  artistReviews: (artistId: string) => ["reviews", "artist", artistId] as const,
  clientReviews: (clientId: string) => ["reviews", "client", clientId] as const,
  bookingReview: (bookingId: string) => ["reviews", "booking", bookingId] as const,
  reviewerProfiles: (reviewIds: string) => ["reviews", "reviewers", reviewIds] as const,
};

// --- Queries ------------------------------------------------------------
export function useArtistReviews(artistId: string | undefined) {
  const client = useInkdClient();
  return useQuery({
    queryKey: reviewQueryKeys.artistReviews(artistId ?? ""),
    queryFn: () => listArtistReviews(client, artistId as string),
    enabled: Boolean(artistId),
  });
}

/** Avg + count derived from the given reviews (caller pre-filters for
 * visibility, e.g. `.filter(r => r.is_public)` on a public profile). */
export function summarizeReviewList(reviews: Review[] | undefined): ReviewAggregate {
  return summarizeReviews(reviews ?? []);
}

export function useClientReviews(clientId: string | undefined) {
  const client = useInkdClient();
  return useQuery({
    queryKey: reviewQueryKeys.clientReviews(clientId ?? ""),
    queryFn: () => listClientReviews(client, clientId as string),
    enabled: Boolean(clientId),
  });
}

export function useBookingReview(bookingId: string | undefined) {
  const client = useInkdClient();
  return useQuery({
    queryKey: reviewQueryKeys.bookingReview(bookingId ?? ""),
    queryFn: () => getReviewByBookingId(client, bookingId as string),
    enabled: Boolean(bookingId),
  });
}

/** Reviewer profiles (avatar + name) for a list of reviews, keyed by
 * `client_id` for easy lookup from review-card components. */
export function useReviewerProfiles(reviews: Review[] | undefined) {
  const client = useInkdClient();
  const ids = (reviews ?? []).map((r) => r.client_id);
  const key = [...new Set(ids)].sort().join(",");
  return useQuery({
    queryKey: reviewQueryKeys.reviewerProfiles(key),
    queryFn: async (): Promise<Record<string, Profile>> => {
      const profiles = await listProfilesByIds(client, ids);
      return Object.fromEntries(profiles.map((p) => [p.id, p]));
    },
    enabled: ids.length > 0,
  });
}

// --- Mutations ------------------------------------------------------------
function useInvalidateReviews(
  artistId: string | undefined,
  clientId: string | undefined,
  bookingId: string | undefined,
) {
  const qc = useQueryClient();
  return () => {
    if (artistId) qc.invalidateQueries({ queryKey: reviewQueryKeys.artistReviews(artistId) });
    if (clientId) qc.invalidateQueries({ queryKey: reviewQueryKeys.clientReviews(clientId) });
    if (bookingId) qc.invalidateQueries({ queryKey: reviewQueryKeys.bookingReview(bookingId) });
  };
}

/** Client leaves a review on a completed booking. */
export function useCreateReview(args: {
  artistId: string | undefined;
  clientId: string | undefined;
  bookingId: string | undefined;
}) {
  const client = useInkdClient();
  const invalidate = useInvalidateReviews(args.artistId, args.clientId, args.bookingId);
  return useMutation({
    mutationFn: (input: Parameters<typeof createReview>[2]) =>
      createReview(client, args.clientId as string, input),
    onSuccess: invalidate,
  });
}

/** Client edits their own review (UI gates this to the 48h window). */
export function useUpdateReview(args: {
  artistId: string | undefined;
  clientId: string | undefined;
  bookingId: string | undefined;
}) {
  const client = useInkdClient();
  const invalidate = useInvalidateReviews(args.artistId, args.clientId, args.bookingId);
  return useMutation({
    mutationFn: (params: { id: string; patch: Parameters<typeof updateReview>[2] }) =>
      updateReview(client, params.id, params.patch),
    onSuccess: invalidate,
  });
}

/** Artist writes or edits their single response to a review on their booking. */
export function useSetArtistReviewResponse(args: {
  artistId: string | undefined;
  bookingId: string | undefined;
}) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; response: string | null }) =>
      setArtistReviewResponse(client, params.id, params.response),
    onSuccess: () => {
      if (args.artistId) {
        qc.invalidateQueries({ queryKey: reviewQueryKeys.artistReviews(args.artistId) });
      }
      if (args.bookingId) {
        qc.invalidateQueries({ queryKey: reviewQueryKeys.bookingReview(args.bookingId) });
      }
    },
  });
}
