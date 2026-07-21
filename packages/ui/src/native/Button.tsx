import { forwardRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type PressableProps,
} from "react-native";
import { cx } from "../cx";
import { wrapTextChildren } from "./textChildren";

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
  /** The screen's single hero action — violet plate + hard offset shadow. */
  hero?: boolean;
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
    hero = false,
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

  const inner = (
    <>
      {loading ? (
        <ActivityIndicator size="small" color="#FAFAFA" />
      ) : (
        leadingIcon
      )}
      {wrapTextChildren(children, (child, key) => (
        <Text
          key={key}
          className={cx(
            hero ? "font-sans-bold tracking-tight" : "font-sans-semibold tracking-tight",
            hero ? "text-base" : sizeText[size],
            hero ? "text-brand-on" : label[variant],
          )}
        >
          {child}
        </Text>
      ))}
    </>
  );

  // Hero: the ONE offset shadow per screen. RN box-shadow / elevation cannot
  // render a hard, 0-blur, theme-colored offset reliably on Android (elevation
  // is a blurred grey system shadow), so we paint the offset as an absolutely-
  // positioned backing View shifted 5px down-right BEHIND the violet face —
  // pixel-identical on iOS and Android. On press the face translates 3px into
  // the backing (visible offset shrinks 5→2). See docs/zine-hierarchy.md.
  if (hero) {
    return (
      // Wrapper hugs the face (self-start) unless a width class is passed via
      // `className` (e.g. "w-full"); the w-full face then fills it. Never wrap
      // the offset in overflow-hidden — it would clip the backing.
      <View className={cx("relative self-start", className)}>
        <View
          pointerEvents="none"
          className="absolute inset-0 rounded-lg bg-hero-shadow"
          style={{ transform: [{ translateX: 5 }, { translateY: 5 }] }}
        />
        <Pressable
          ref={ref}
          accessibilityRole="button"
          accessibilityState={{ disabled: isDisabled, busy: loading }}
          disabled={isDisabled}
          className={cx(
            "h-12 w-full flex-row items-center justify-center gap-2 rounded-lg border border-hero-border bg-brand px-6",
            "active:translate-x-[3px] active:translate-y-[3px] active:bg-brand-active",
            isDisabled && "opacity-50",
          )}
          {...props}
        >
          {inner}
        </Pressable>
      </View>
    );
  }

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
      {inner}
    </Pressable>
  );
});
