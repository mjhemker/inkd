import { forwardRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type PressableProps,
} from "react-native";
import { cx } from "../cx";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "outline"
  | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const container: Record<ButtonVariant, string> = {
  primary: "bg-brand active:bg-brand-active",
  secondary:
    "bg-surface-overlay border border-border active:bg-neutral-700",
  ghost: "bg-transparent active:bg-surface-raised",
  outline: "bg-transparent border border-border active:bg-surface-raised",
  danger: "bg-danger-500 active:bg-danger-700",
};

const label: Record<ButtonVariant, string> = {
  primary: "text-brand-on",
  secondary: "text-content-primary",
  ghost: "text-content-secondary",
  outline: "text-content-primary",
  danger: "text-neutral-50",
};

const sizePad: Record<ButtonSize, string> = {
  sm: "h-9 px-3",
  md: "h-11 px-4",
  lg: "h-12 px-6",
};

const sizeText: Record<ButtonSize, string> = {
  sm: "text-sm",
  md: "text-sm",
  lg: "text-base",
};

export interface ButtonProps extends Omit<PressableProps, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  leadingIcon?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export const Button = forwardRef<View, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    leadingIcon,
    className,
    children,
    ...props
  },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      className={cx(
        "flex-row items-center justify-center gap-2 rounded-lg",
        sizePad[size],
        container[variant],
        isDisabled && "opacity-50",
        className,
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#FAFAFA" />
      ) : (
        leadingIcon
      )}
      {typeof children === "string" ? (
        <Text
          className={cx(
            "font-sans-semibold tracking-tight",
            sizeText[size],
            label[variant],
          )}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
});
