import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { cx } from "../cx";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Optional hand-marked note (Caveat). Warm aside above the title; sparingly. */
  note?: string;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  note,
  className,
}: EmptyStateProps) {
  return (
    <View className={cx("items-center justify-center gap-3 px-6 py-12", className)}>
      {icon}
      {note ? (
        <Text className="text-center font-hand text-2xl text-content-ember">
          {note}
        </Text>
      ) : null}
      <Text className="text-center font-display text-lg text-content-primary">
        {title}
      </Text>
      {description ? (
        <Text className="text-center text-sm text-content-muted">
          {description}
        </Text>
      ) : null}
      {action ? <View className="mt-2">{action}</View> : null}
    </View>
  );
}
