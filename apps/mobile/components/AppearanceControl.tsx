import { Pressable, Text, View } from "react-native";
import { Icon, type IconName } from "@inkd/ui/native";
import { useTheme, type ThemePreference } from "@/providers/theme";

/**
 * Dark / Light / System segmented control wired to the mobile ThemeProvider.
 * The choice persists to AsyncStorage; the app defaults to Dark.
 */
const OPTIONS: { value: ThemePreference; label: string; icon: IconName }[] = [
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "light", label: "Light", icon: "sun" },
  { value: "system", label: "System", icon: "monitor" },
];

export function AppearanceControl() {
  const { preference, setPreference, colors } = useTheme();

  return (
    <View className="flex-row gap-1 rounded-lg border border-border-subtle bg-surface-raised p-1">
      {OPTIONS.map((opt) => {
        const active = preference === opt.value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => setPreference(opt.value)}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-md py-2.5 ${
              active ? "bg-surface-plate" : ""
            }`}
          >
            <Icon
              name={opt.icon}
              size={16}
              color={active ? colors.brand.onPrimary : colors.text.secondary}
            />
            <Text
              className={`text-sm font-sans-medium ${
                active ? "text-brand-on" : "text-content-secondary"
              }`}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
