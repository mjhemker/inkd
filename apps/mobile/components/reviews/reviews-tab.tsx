/** Public-profile Reviews tab (native): aggregate placard + review list.
 * Mirrors apps/web/src/components/reviews/reviews-tab.tsx. */
import { Text, View } from "react-native";
import { Card, CardPlacard, Icon } from "@inkd/ui/native";
import {
  formatRatingAvg,
  reviewerFirstName,
  summarizeReviews,
  type Profile,
  type Review,
} from "@inkd/core";
import { RatingStamps } from "./rating-stamps";
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
      <View className="items-center gap-3 rounded-2xl border border-border-subtle bg-surface-raised/40 px-6 py-16">
        <Icon name="star" size={26} color="#71717A" />
        <Text className="font-sans-semibold text-base text-content-primary">No reviews yet</Text>
        <Text className="text-center text-sm text-content-muted">
          Completed sessions will show up here once clients leave a review.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-8">
      <Card padding="none">
        <CardPlacard meta={`${summary.count} review${summary.count === 1 ? "" : "s"}`}>
          Reviews
        </CardPlacard>
        <View className="flex-row items-center gap-4 p-5">
          <Text className="font-display text-4xl text-content-primary">
            {formatRatingAvg(summary.avg)}
          </Text>
          <RatingStamps value={Math.round(summary.avg)} readOnly size="md" />
        </View>
      </Card>

      <View className="gap-5">
        {reviews.map((review) => {
          const reviewer = reviewerProfiles[review.client_id];
          return (
            <View key={review.id} className="gap-5 border-b border-border-subtle pb-5 last:border-0 last:pb-0">
              <ReviewCard
                review={review}
                reviewerName={reviewerFirstName(reviewer)}
                reviewerAvatarUrl={reviewer?.avatar_url}
                artistName={artistName}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}
