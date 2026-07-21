/** Presentational review row (native): rating marks, reviewer byline +
 * avatar, mono date, title/body, and a nested artist response. Mirrors
 * apps/web/src/components/reviews/review-card.tsx. */
import { Text, View } from "react-native";
import { Avatar, StarRating } from "@inkd/ui/native";
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
    <View className="gap-3">
      <View className="flex-row flex-wrap items-start justify-between gap-3">
        <View className="flex-row items-center gap-2.5">
          <Avatar name={reviewerName} src={reviewerAvatarUrl ?? undefined} size="sm" />
          <View>
            <Text className="font-sans-semibold text-sm text-content-primary">{reviewerName}</Text>
            <Text className="font-mono text-[11px] text-content-muted">
              {formatReviewDate(review.created_at)}
            </Text>
          </View>
        </View>
        <StarRating value={review.rating} readOnly size="sm" />
      </View>

      {review.title ? (
        <Text className="font-sans-semibold text-sm text-content-primary">{review.title}</Text>
      ) : null}
      {review.body ? (
        <Text className="text-sm text-content-secondary">{review.body}</Text>
      ) : null}

      {review.artist_response ? (
        <View className="ml-1 gap-1 border-l-2 border-border-ember py-0.5 pl-3.5">
          <Text className="font-mono text-[10px] uppercase tracking-widest text-content-ember">
            {artistName ? `${artistName} responded` : "Studio response"}
          </Text>
          <Text className="text-sm text-content-secondary">{review.artist_response}</Text>
        </View>
      ) : null}
    </View>
  );
}
