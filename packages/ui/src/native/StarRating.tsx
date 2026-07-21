/**
 * StarRating (native) — the react-native-svg twin of `../web/StarRating`. Same
 * shared math (`../starRating/starMath`), so a rating shown on web and mobile
 * fills identically. Classic 5 stars with HALF fills via an SVG linear-gradient
 * hard stop (no emoji).
 *
 * DISPLAY (`readOnly` / no `onChange`): `value` rounds to the nearest half.
 * INPUT (`onChange`): whole-star taps (RN has no hover/pointer precision, so
 * half-star authoring is web-only) while still DISPLAYING halves. The DB numeric
 * rating is unchanged by this component.
 */
import { useId } from "react";
import { Pressable, Text, View } from "react-native";
import { useColorScheme } from "nativewind";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { cx } from "../cx";
import {
  STAR_COUNT,
  roundToHalf,
  starFillFractions,
  ratingFromStar,
} from "../starRating/starMath";

const SIZE_PX: Record<"sm" | "md" | "lg", number> = { sm: 16, md: 24, lg: 36 };
const RATING_LABELS: Record<number, string> = {
  1: "Rough",
  2: "Fair",
  3: "Good",
  4: "Great",
  5: "Exceptional",
};
const STAR_PATH =
  "M12 17.27 18.18 21 16.54 13.97 22 9.24 14.81 8.62 12 2 9.19 8.62 2 9.24 7.45 13.97 5.82 21Z";

const EMBER = "#E8A15C"; // surface.ember — same stamp gold in both themes
const OUTLINE = { dark: "#3F3F46", light: "#B8AC92" } as const;

export interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

function Star({
  fraction,
  px,
  gid,
  outline,
}: {
  fraction: number;
  px: number;
  gid: string;
  outline: string;
}) {
  const clamped = fraction <= 0 ? 0 : fraction >= 1 ? 1 : fraction;
  const off = `${clamped * 100}%`;
  return (
    <Svg width={px} height={px} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
          <Stop offset={off} stopColor={EMBER} stopOpacity={1} />
          <Stop offset={off} stopColor={EMBER} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path
        d={STAR_PATH}
        fill={`url(#${gid})`}
        stroke={outline}
        strokeWidth={1.25}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function StarRating({
  value,
  onChange,
  readOnly = false,
  size = "md",
  showLabel = false,
  className,
}: StarRatingProps) {
  const { colorScheme } = useColorScheme();
  const outline = colorScheme === "light" ? OUTLINE.light : OUTLINE.dark;
  const px = SIZE_PX[size];
  const uid = useId();
  const interactive = !readOnly && Boolean(onChange);

  const fractions = starFillFractions(value);
  const rounded = roundToHalf(value);
  const labelText =
    rounded > 0
      ? RATING_LABELS[Math.round(rounded)] ?? `${rounded} of 5`
      : interactive
        ? "Tap to rate"
        : "No rating";

  const row = (
    <View className="flex-row items-center" style={{ gap: 2 }}>
      {fractions.map((frac, i) =>
        interactive ? (
          <Pressable
            key={i}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${ratingFromStar(i + 1)} of 5`}
            accessibilityState={{ selected: i + 1 <= rounded }}
            onPress={() => onChange?.(ratingFromStar(i + 1))}
          >
            <Star fraction={frac} px={px} gid={`${uid}-s${i}`} outline={outline} />
          </Pressable>
        ) : (
          <Star key={i} fraction={frac} px={px} gid={`${uid}-s${i}`} outline={outline} />
        ),
      )}
    </View>
  );

  return (
    <View
      className={cx("gap-1.5", className)}
      accessible={!interactive}
      accessibilityRole={interactive ? "adjustable" : "image"}
      accessibilityLabel={interactive ? "Rating out of 5" : `Rated ${rounded} of 5`}
      accessibilityValue={interactive ? { min: 0, max: STAR_COUNT, now: rounded } : undefined}
    >
      {row}
      {showLabel && (
        <Text className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
          {labelText}
        </Text>
      )}
    </View>
  );
}
