import { forwardRef, type ReactNode } from "react";
import { Pressable, Text, View, type PressableProps } from "react-native";
import { cx } from "../cx";
import { Icon } from "./Icon";
import { wrapTextChildren } from "./textChildren";

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
          ? "border-brand bg-brand"
          : "border-border bg-surface-overlay active:bg-surface-raised",
        disabled && "opacity-50",
        className,
      )}
      {...props}
    >
      {leadingIcon}
      {wrapTextChildren(children, (child, key) => (
        <Text
          key={key}
          numberOfLines={1}
          className={cx(
            "font-sans-medium text-sm",
            selected ? "text-brand-on" : "text-content-secondary",
          )}
        >
          {child}
        </Text>
      ))}
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
