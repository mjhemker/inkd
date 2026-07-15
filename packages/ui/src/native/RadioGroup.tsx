import { Pressable, Text, View } from "react-native";
import { cx } from "../cx";

export interface RadioOption {
  label: string;
  value: string;
  description?: string;
}

export interface RadioGroupProps {
  value: string;
  onValueChange: (value: string) => void;
  options: RadioOption[];
  disabled?: boolean;
  className?: string;
}

export function RadioGroup({
  value,
  onValueChange,
  options,
  disabled = false,
  className,
}: RadioGroupProps) {
  return (
    <View className={cx("gap-1", className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            accessibilityLabel={option.label}
            disabled={disabled}
            onPress={() => onValueChange(option.value)}
            className={cx(
              "min-h-11 flex-row items-start gap-3 py-1",
              disabled && "opacity-50",
            )}
          >
            <View
              className={cx(
                "mt-0.5 h-5 w-5 items-center justify-center rounded-full border",
                selected ? "border-brand" : "border-border",
              )}
            >
              {selected ? <View className="h-2.5 w-2.5 rounded-full bg-brand" /> : null}
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="font-sans-medium text-sm text-content-primary">
                {option.label}
              </Text>
              {option.description ? (
                <Text className="text-sm text-content-muted">
                  {option.description}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
