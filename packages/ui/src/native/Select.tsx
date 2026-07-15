import { forwardRef } from "react";
import { Pressable, Text, View, type PressableProps } from "react-native";
import { cx } from "../cx";
import { Icon } from "./Icon";

export type SelectSize = "sm" | "md" | "lg";

const sizeHeight: Record<SelectSize, string> = {
  sm: "h-9",
  md: "h-11",
  lg: "h-12",
};

const sizeText: Record<SelectSize, string> = {
  sm: "text-sm",
  md: "text-sm",
  lg: "text-base",
};

export interface SelectProps extends Omit<PressableProps, "children"> {
  value?: string;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  size?: SelectSize;
  className?: string;
}

/**
 * Native divergence: web's <Select> renders a full listbox popover. On native
 * there is no portal-based popover primitive, so this component is a
 * trigger-only Pressable styled like <Input> that shows the current value (or
 * placeholder) plus a chevron. Consumers open a <Sheet> with the option list
 * and call the passed-in `onPress` to launch it.
 */
export const Select = forwardRef<View, SelectProps>(function Select(
  {
    value,
    placeholder = "Select…",
    invalid = false,
    disabled = false,
    size = "md",
    className,
    ...props
  },
  ref,
) {
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      className={cx(
        "flex-row items-center justify-between gap-2 rounded-lg border bg-surface-raised px-3",
        invalid ? "border-danger-500" : "border-border",
        disabled && "opacity-50",
        sizeHeight[size],
        className,
      )}
      {...props}
    >
      <Text
        className={cx(
          "font-sans",
          sizeText[size],
          value ? "text-content-primary" : "text-content-muted",
        )}
        numberOfLines={1}
      >
        {value ?? placeholder}
      </Text>
      <Icon name="chevron-down" size={18} color="#A1A1AA" />
    </Pressable>
  );
});
