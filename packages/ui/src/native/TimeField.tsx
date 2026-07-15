import { forwardRef } from "react";
import { Pressable, Text, View, type PressableProps } from "react-native";
import { cx } from "../cx";
import { Icon } from "./Icon";

export interface TimeFieldProps extends Omit<PressableProps, "children"> {
  value?: string;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Native divergence: same pattern as <DateField> — a trigger-only Pressable
 * styled like <Input> with a clock icon. Consumers wire a real time picker
 * from the passed-in `onPress`.
 */
export const TimeField = forwardRef<View, TimeFieldProps>(function TimeField(
  { value, placeholder = "Select time", invalid = false, disabled = false, className, ...props },
  ref,
) {
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      className={cx(
        "h-11 flex-row items-center justify-between gap-2 rounded-lg border bg-surface-raised px-3",
        invalid ? "border-danger-500" : "border-border",
        disabled && "opacity-50",
        className,
      )}
      {...props}
    >
      <Text
        className={cx("text-sm font-sans", value ? "text-content-primary" : "text-content-muted")}
        numberOfLines={1}
      >
        {value ?? placeholder}
      </Text>
      <Icon name="clock" size={18} color="#A1A1AA" />
    </Pressable>
  );
});
