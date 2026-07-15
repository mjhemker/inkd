import { View, type ViewProps } from "react-native";
import { cx } from "../cx";

export interface SkeletonProps extends ViewProps {
  className?: string;
}

/** Static muted placeholder block. Keep simple — no animation dependency. */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cx("rounded-md bg-surface-overlay", className)}
      {...props}
    />
  );
}
