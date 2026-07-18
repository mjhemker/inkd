import { Text, View } from "react-native";
import { cx } from "../cx";

export type ProgressBarSize = "sm" | "md";

const trackHeight: Record<ProgressBarSize, string> = {
  sm: "h-1.5",
  md: "h-2.5",
};

export interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  size?: ProgressBarSize;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = false,
  size = "md",
  className,
}: ProgressBarProps) {
  const clamped = Math.min(Math.max(value, 0), max);
  const percent = max > 0 ? (clamped / max) * 100 : 0;

  return (
    <View className={cx("gap-1.5", className)}>
      {label || showValue ? (
        <View className="flex-row items-center justify-between">
          {label ? (
            <Text className="text-sm text-content-secondary">{label}</Text>
          ) : null}
          {showValue ? (
            <Text className="font-mono text-xs text-content-muted">
              {Math.round(percent)}%
            </Text>
          ) : null}
        </View>
      ) : null}
      <View
        accessibilityRole="progressbar"
        // Whole-number percent — Fabric types accessibilityValue as int, so a
        // fractional `max`/`now` (e.g. a 0..1 progress value) crashes
        // createNode. Report 0–100 instead.
        accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}
        className={cx("w-full overflow-hidden rounded-sm bg-surface-overlay", trackHeight[size])}
      >
        <View
          className={cx("h-full rounded-sm bg-brand")}
          style={{ width: `${percent}%` }}
        />
      </View>
    </View>
  );
}
