import { forwardRef, type ReactNode } from "react";
import { Pressable, Text, View, type PressableProps } from "react-native";
import { cx } from "../cx";
import { Icon } from "./Icon";

export interface ChipProps extends Omit<PressableProps, "children"> {
  selected?: boolean;
  disabled?: boolean;
  leadingIcon?: ReactNode;
  onRemove?: () => void;
  className?: string;
  children: ReactNode;
}

/** Interactive tag/filter pill. Selected state is brand-tinted. */
export const Chip = forwardRef<View, ChipProps>(function Chip(
  {
    selected = false,
    disabled = false,
    leadingIcon,
    onRemove,
    className,
    children,
    ...props
  },
  ref,
) {
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      className={cx(
        "flex-row items-center gap-1.5 self-start rounded-full border px-3 py-1.5",
        selected
          ? "border-border-accent bg-brand/20"
          : "border-border bg-surface-overlay active:bg-surface-raised",
        disabled && "opacity-50",
        className,
      )}
      {...props}
    >
      {leadingIcon}
      {typeof children === "string" ? (
        <Text
          className={cx(
            "font-sans-medium text-sm",
            selected ? "text-content-accent" : "text-content-secondary",
          )}
        >
          {children}
        </Text>
      ) : (
        children
      )}
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          disabled={disabled}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Remove"
        >
          <Icon name="x" size={14} color="#A1A1AA" />
        </Pressable>
      ) : null}
    </Pressable>
  );
});
