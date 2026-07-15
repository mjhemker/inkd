import { Image, Text, View } from "react-native";
import { cx } from "../cx";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export type AvatarShape = "circle" | "square";

const dimension: Record<AvatarSize, string> = {
  xs: "h-6 w-6",
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
};

const textSize: Record<AvatarSize, string> = {
  xs: "text-[10px]",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
  xl: "text-lg",
};

const shapeClass: Record<AvatarShape, string> = {
  circle: "rounded-full",
  square: "rounded-lg",
};

export interface AvatarProps {
  src?: string;
  name?: string;
  size?: AvatarSize;
  shape?: AvatarShape;
  className?: string;
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function Avatar({
  src,
  name = "",
  size = "md",
  shape = "circle",
  className,
}: AvatarProps) {
  if (src) {
    return (
      <Image
        source={{ uri: src }}
        accessibilityLabel={name || "Avatar"}
        className={cx(dimension[size], shapeClass[shape], className)}
      />
    );
  }

  return (
    <View
      accessibilityLabel={name || "Avatar"}
      className={cx(
        "items-center justify-center bg-surface-overlay",
        dimension[size],
        shapeClass[shape],
        className,
      )}
    >
      <Text className={cx("font-sans-semibold text-content-secondary", textSize[size])}>
        {initialsFrom(name)}
      </Text>
    </View>
  );
}
