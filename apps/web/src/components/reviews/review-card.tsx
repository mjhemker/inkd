"use client";

/** Presentational review row: rating marks, reviewer byline + avatar, mono
 * date, title/body, and a nested artist response (used on the public profile
 * Reviews tab and on booking detail). Purely display — mutations happen in
 * the container that renders this (booking-detail / review-form-modal). */
import { Avatar, StarRating } from "@inkd/ui/web";
import { formatReviewDate, type Review } from "@inkd/core";

export function ReviewCard({
  review,
  reviewerName,
  reviewerAvatarUrl,
  artistName,
}: {
  review: Review;
  reviewerName: string;
  reviewerAvatarUrl?: string | null;
  artistName?: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={reviewerName} src={reviewerAvatarUrl ?? undefined} size="sm" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-content-primary">{reviewerName}</span>
            <span className="font-mono text-[11px] text-content-muted">
              {formatReviewDate(review.created_at)}
            </span>
          </div>
        </div>
        <StarRating value={review.rating} readOnly size="sm" />
      </div>

      {review.title && (
        <p className="text-sm font-semibold text-content-primary">{review.title}</p>
      )}
      {review.body && (
        <p className="whitespace-pre-line text-sm text-content-secondary">{review.body}</p>
      )}

      {review.artist_response && (
        <div className="ml-1 flex flex-col gap-1 border-l-2 border-border-ember py-0.5 pl-3.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-content-ember">
            {artistName ? `${artistName} responded` : "Studio response"}
          </span>
          <p className="whitespace-pre-line text-sm text-content-secondary">
            {review.artist_response}
          </p>
        </div>
      )}
    </div>
  );
}
