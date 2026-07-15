/**
 * INKD's rating control (native): five stamped ink marks instead of generic
 * stars — small hard-edged squares, each at a slightly different
 * hand-stamped angle, filling ember when active. Mirrors
 * apps/web/src/components/reviews/rating-stamps.tsx; RN has no hover, so the
 * interactive state is just current value vs. tap.
 */
import { Pressable, Text, View } from "react-native";
import { cx } from "@inkd/ui/native";

const MARK_ROTATIONS = ["-6deg", "4deg", "-3deg", "5deg", "-2deg"];
const RATING_LABELS: Record<number, string> = {
  1: "Rough",
  2: "Fair",
  3: "Good",
  4: "Great",
  5: "Exceptional",
};

const SIZES: Record<"sm" | "md" | "lg", number> = { sm: 14, md: 24, lg: 36 };

export interface RatingStampsProps {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function RatingStamps({
  value,
  onChange,
  readOnly = false,
  size = "md",
  showLabel = false,
  className,
}: RatingStampsProps) {
  const interactive = !readOnly && Boolean(onChange);
  const dim = SIZES[size];

  return (
    <View className={cx("gap-1.5", className)}>
      <View
        className="flex-row items-center gap-1"
        accessibilityRole={interactive ? "adjustable" : undefined}
        accessibilityLabel={interactive ? "Rating out of 5" : `Rated ${value} of 5`}
      >
        {[1, 2, 3, 4, 5].map((mark) => {
          const filled = mark <= value;
          return (
            <Pressable
              key={mark}
              disabled={!interactive}
              accessibilityRole={interactive ? "button" : undefined}
              accessibilityLabel={`Rate ${mark} of 5`}
              accessibilityState={{ selected: filled }}
              hitSlop={6}
              onPress={() => interactive && onChange?.(mark)}
              style={{
                width: dim,
                height: dim,
                transform: [{ rotate: MARK_ROTATIONS[mark - 1]! }],
              }}
              className={cx(
                "rounded-[3px] border-2",
                filled ? "border-border-ember bg-surface-ember" : "border-border-subtle bg-transparent",
              )}
            />
          );
        })}
      </View>
      {showLabel && (
        <Text className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
          {value > 0 ? RATING_LABELS[value] : "Tap to rate"}
        </Text>
      )}
    </View>
  );
}
