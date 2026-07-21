"use client";

/** Public-profile Reviews tab: aggregate placard + the review list. Takes
 * fully-resolved data as props (mirrors `ArtistProfileView`'s other tabs). */
import { Card, CardPlacard, Icon, StarRating } from "@inkd/ui/web";
import {
  formatRatingAvg,
  reviewerFirstName,
  summarizeReviews,
  type Profile,
  type Review,
} from "@inkd/core";
import { ReviewCard } from "./review-card";

export function ReviewsTab({
  reviews,
  reviewerProfiles,
  artistName,
}: {
  reviews: Review[];
  reviewerProfiles: Record<string, Profile>;
  artistName?: string | null;
}) {
  const summary = summarizeReviews(reviews);

  if (reviews.length === 0) {
    return (
      <div className="rounded-2xl border border-border-subtle bg-surface-raised/40 px-6 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-overlay text-content-muted">
          <Icon name="star" size={26} />
        </div>
        <h3 className="font-sans text-base font-semibold text-content-primary">No reviews yet</h3>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-content-muted">
          Completed sessions will show up here once clients leave a review.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <Card padding="none" variant="raised" className="overflow-hidden">
        <CardPlacard meta={`${summary.count} review${summary.count === 1 ? "" : "s"}`}>
          Reviews
        </CardPlacard>
        <div className="flex items-center gap-4 p-5">
          <span className="font-display text-4xl font-extrabold tracking-tight">
            {formatRatingAvg(summary.avg)}
          </span>
          <StarRating value={summary.avg} readOnly size="md" />
        </div>
      </Card>

      <div className="flex flex-col divide-y divide-border-subtle">
        {reviews.map((review) => {
          const reviewer = reviewerProfiles[review.client_id];
          return (
            <div key={review.id} className="py-5 first:pt-0 last:pb-0">
              <ReviewCard
                review={review}
                reviewerName={reviewerFirstName(reviewer)}
                reviewerAvatarUrl={reviewer?.avatar_url}
                artistName={artistName}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
