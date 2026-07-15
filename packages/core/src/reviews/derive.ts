/**
 * Pure derivations over reviews: rating aggregates, the client-side 48h edit
 * window, reviewer display-name shaping, and date formatting. No I/O — safe
 * on both web and RN (mirrors the `../booking/derive.ts` pattern).
 */
import type { Profile, Review } from "../types/rows";

export interface ReviewAggregate {
  /** 0 when `count` is 0 — callers should check `count` before displaying. */
  avg: number;
  count: number;
}

/** Average rating + count over a set of reviews (caller pre-filters for
 * visibility — e.g. public-only on a profile, all-of-mine on a dashboard). */
export function summarizeReviews(reviews: Pick<Review, "rating">[]): ReviewAggregate {
  if (reviews.length === 0) return { avg: 0, count: 0 };
  const total = reviews.reduce((sum, r) => sum + r.rating, 0);
  return { avg: total / reviews.length, count: reviews.length };
}

/** One-decimal display string for an average rating, e.g. 4.5, 5, 3.7. */
export function formatRatingAvg(avg: number): string {
  return Number.isInteger(avg) ? String(avg) : avg.toFixed(1);
}

/** Client-side-only edit window: authors can revise their review within 48h
 * of posting (SPEC: "editable by author for 48h"). Not enforced by RLS —
 * the policy already scopes updates to the author; this is a UI affordance. */
export const REVIEW_EDIT_WINDOW_MS = 48 * 60 * 60 * 1000;

export function isReviewEditable(
  review: Pick<Review, "created_at">,
  now: Date = new Date(),
): boolean {
  return now.getTime() - new Date(review.created_at).getTime() < REVIEW_EDIT_WINDOW_MS;
}

/** First name for reviewer attribution — falls back to handle, then a
 * generic label so a review never renders with an empty byline. */
export function reviewerFirstName(
  profile: Pick<Profile, "display_name" | "handle"> | null | undefined,
): string {
  const source = profile?.display_name?.trim() || profile?.handle?.trim();
  if (!source) return "A client";
  return source.split(/\s+/)[0]!;
}

/** Mono-friendly review date, e.g. "Jul 12, 2026". */
export function formatReviewDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
