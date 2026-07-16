import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Icon } from "@inkd/ui/native";
import { useCurrentProfile, useUnreadNotificationCount } from "@inkd/core";
import { useTheme } from "@/providers/theme";

/**
 * Bell + unread badge for the Profile tab header (mobile has no persistent
 * top bar to dock a header bell like the web shell, so it lives on the
 * screen with the most headroom — see `ScreenHeader`'s `action` slot).
 * Pressing it pushes the `/notifications` stack screen.
 */
export function NotificationBellButton() {
  const { colors } = useTheme();
  const { data: profile } = useCurrentProfile();
  const unreadQ = useUnreadNotificationCount(profile?.id);
  const unreadCount = unreadQ.data ?? 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Notifications"
      onPress={() => router.push("/notifications")}
      className="relative h-10 w-10 items-center justify-center rounded-full active:bg-surface-raised"
    >
      <Icon name="bell" size={22} color={colors.text.primary} />
      {unreadCount > 0 && (
        <View className="absolute right-0.5 top-0.5 h-4 min-w-4 items-center justify-center rounded-full bg-surface-ember px-1">
          <Text className="font-mono text-[10px] font-bold leading-none text-brand-on-ember">
            {unreadCount > 9 ? "9+" : unreadCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
