import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { cx } from "../cx";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <View className={cx("items-center justify-center gap-3 px-6 py-12", className)}>
      {icon}
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
