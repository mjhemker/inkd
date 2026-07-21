import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { cx } from "../cx";
import { wrapTextChildren } from "./textChildren";

export interface StatusDotProps {
  /** On = green dot, Off = soft gray dot. */
  on?: boolean;
  /** Optional trailing label (e.g. "On" / "Off"). */
  label?: ReactNode;
  className?: string;
}

/**
 * Staff-status pattern: a small green ON dot / gray OFF dot. Green is a status
 * signal (not the red reserved for counts & medical). Label optional.
 */
export function StatusDot({ on = false, label, className }: StatusDotProps) {
  return (
    <View className={cx("flex-row items-center gap-1.5", className)}>
      <View
        className={cx(
          "h-2 w-2 rounded-full",
          on ? "bg-success-500" : "bg-neutral-500",
        )}
      />
      {label != null
        ? wrapTextChildren(label, (child, key) => (
            <Text key={key} className="text-sm text-content-secondary">
              {child}
            </Text>
          ))
        : null}
    </View>
  );
}
