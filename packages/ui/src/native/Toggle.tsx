import { Pressable, Text, View } from "react-native";
import { cx } from "../cx";

export interface ToggleProps {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

/**
 * Custom Pressable track + thumb (rather than RN <Switch>) so the on-state
 * matches the brand violet exactly across platforms.
 */
export function Toggle({
  checked,
  onCheckedChange,
  disabled = false,
  label,
  className,
}: ToggleProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => onCheckedChange(!checked)}
      className={cx(
        "min-h-11 flex-row items-center gap-3",
        disabled && "opacity-50",
        className,
      )}
    >
      {label ? (
        <Text className="flex-1 text-sm text-content-primary">{label}</Text>
      ) : null}
      <View
        className={cx(
          "h-7 w-12 justify-center rounded-full p-0.5",
          checked ? "bg-brand" : "bg-surface-overlay",
        )}
      >
        <View
          className={cx(
            "h-6 w-6 rounded-full bg-neutral-50",
            checked ? "ml-5" : "ml-0",
          )}
        />
      </View>
    </Pressable>
  );
}
