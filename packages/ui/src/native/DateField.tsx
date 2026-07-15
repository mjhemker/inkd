import { forwardRef } from "react";
import { Pressable, Text, View, type PressableProps } from "react-native";
import { cx } from "../cx";
import { Icon } from "./Icon";

export interface DateFieldProps extends Omit<PressableProps, "children"> {
  value?: string;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Native divergence: no native date-picker primitive is wired up yet, so this
 * is a trigger-only Pressable styled like <Input> with a calendar icon.
 * Consumers open a real picker (e.g. @react-native-community/datetimepicker)
 * from the passed-in `onPress` and format the result into `value`.
 */
export const DateField = forwardRef<View, DateFieldProps>(function DateField(
  { value, placeholder = "Select date", invalid = false, disabled = false, className, ...props },
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
      <Icon name="calendar" size={18} color="#A1A1AA" />
    </Pressable>
  );
});
