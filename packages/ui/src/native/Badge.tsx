import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { cx } from "../cx";

export type BadgeVariant =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "outline";
export type BadgeSize = "sm" | "md";

const container: Record<BadgeVariant, string> = {
  neutral: "bg-surface-overlay",
  brand: "bg-brand",
  success: "bg-success-600",
  warning: "bg-warning-600",
  danger: "bg-danger-600",
  info: "bg-info-600",
  outline: "bg-transparent border border-border",
};

const label: Record<BadgeVariant, string> = {
  neutral: "text-content-secondary",
  brand: "text-brand-on",
  success: "text-neutral-50",
  warning: "text-neutral-50",
  danger: "text-neutral-50",
  info: "text-neutral-50",
  outline: "text-content-secondary",
};

const sizePad: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5",
  md: "px-2.5 py-1",
};

const sizeText: Record<BadgeSize, string> = {
  sm: "text-xs",
  md: "text-sm",
};

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
  className?: string;
}

export function Badge({
  variant = "neutral",
  size = "md",
  children,
  className,
}: BadgeProps) {
  return (
    <View
      className={cx(
        "flex-row items-center self-start rounded-md",
        sizePad[size],
        container[variant],
        className,
      )}
    >
      {typeof children === "string" ? (
        <Text
          className={cx("font-sans-semibold", sizeText[size], label[variant])}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}
