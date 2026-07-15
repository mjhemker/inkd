import { Pressable, Text, View } from "react-native";
import { cx } from "../cx";
import { Icon } from "./Icon";

export interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  invalid = false,
  className,
}: CheckboxProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => onCheckedChange(!checked)}
      className={cx(
        "min-h-11 flex-row items-start gap-3 py-1",
        disabled && "opacity-50",
        className,
      )}
    >
      <View
        className={cx(
          "mt-0.5 h-5 w-5 items-center justify-center rounded-md border",
          checked ? "border-brand bg-brand" : "border-border bg-surface-raised",
          invalid && !checked && "border-danger-500",
        )}
      >
        {checked ? <Icon name="check" size={14} color="#FAFAFA" /> : null}
      </View>
      {label || description ? (
        <View className="flex-1 gap-0.5">
          {label ? (
            <Text className="font-sans-medium text-sm text-content-primary">
              {label}
            </Text>
          ) : null}
          {description ? (
            <Text className="text-sm text-content-muted">{description}</Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}
