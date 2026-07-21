import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { cx } from "../cx";
import { wrapTextChildren } from "./textChildren";

export type BadgeVariant =
  | "neutral"
  | "brand"
  | "ember"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "outline"
  // Zine additions:
  | "stamp" // red mono rubber-stamp — AWAITING YOU / MEDICAL
  | "date"; // soft-gray date chip
export type BadgeSize = "sm" | "md";

const container: Record<BadgeVariant, string> = {
  neutral: "bg-surface-overlay",
  brand: "bg-brand",
  // Ember stamp — flash drops / price marks. Warm plate, dark ink.
  ember: "bg-surface-ember",
  success: "bg-success-600",
  warning: "bg-warning-600",
  danger: "bg-danger-600",
  info: "bg-info-600",
  outline: "bg-transparent border border-border",
  // Red mono rubber-stamp (AWAITING YOU / MEDICAL) — transparent, red hairline.
  stamp: "bg-transparent border border-danger-600",
  // Soft-gray date chip — recedes.
  date: "bg-surface-overlay",
};

const label: Record<BadgeVariant, string> = {
  neutral: "text-content-secondary",
  brand: "text-brand-on",
  ember: "text-brand-on-ember",
  success: "text-neutral-50",
  warning: "text-neutral-50",
  danger: "text-neutral-50",
  info: "text-neutral-50",
  outline: "text-content-secondary",
  stamp: "text-danger-600 font-mono uppercase tracking-widest",
  date: "text-content-muted",
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
      {wrapTextChildren(children, (child, key) => (
        <Text
          key={key}
          className={cx("font-sans-semibold", sizeText[size], label[variant])}
        >
          {child}
        </Text>
      ))}
    </View>
  );
}
