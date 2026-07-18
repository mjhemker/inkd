import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Icon } from "@inkd/ui/native";
import { useAttentionCounts } from "@inkd/core/hooks";
import { useTheme } from "@/providers/theme";

/**
 * Messages icon + unread badge for the Studio dashboard header (top-right).
 *
 * Artists have no Messages bottom tab — this is their inbox entry point (per
 * the founder's nav spec). Same unread-badge treatment as the client Messages
 * tab and the profile bell. Pressing it pushes the `/messages` stack (the
 * route stays registered in (tabs) so the bottom bar stays visible).
 */
export function MessagesHeaderButton() {
  const { colors } = useTheme();
  const { messages: unread } = useAttentionCounts();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Messages, ${unread} unread` : "Messages"}
      onPress={() => router.push("/messages")}
      className="relative h-10 w-10 items-center justify-center rounded-full active:bg-surface-raised"
    >
      <Icon name="message-circle" size={22} color={colors.text.primary} />
      {unread > 0 && (
        <View className="absolute right-0.5 top-0.5 h-4 min-w-4 items-center justify-center rounded-full bg-danger-600 px-1">
          <Text className="font-mono text-[10px] font-bold leading-none text-neutral-50">
            {unread > 9 ? "9+" : unread}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
