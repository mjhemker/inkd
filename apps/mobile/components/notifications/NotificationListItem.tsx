import { Pressable, Text, View } from "react-native";
import { Icon } from "@inkd/ui/native";
import { formatThreadTimestamp, type Notification } from "@inkd/core";
import { notificationKindMeta } from "@/lib/notifications";

/** One notification row for the `/notifications` screen. Mirrors
 * `apps/web/src/components/notifications/notification-row.tsx`. */
export function NotificationListItem({
  notification,
  onSelect,
}: {
  notification: Notification;
  onSelect: (notification: Notification) => void;
}) {
  const meta = notificationKindMeta(notification.type);
  const unread = !notification.is_read;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onSelect(notification)}
      className={`flex-row items-start gap-3 rounded-lg px-3 py-3 active:bg-surface-raised ${
        unread ? "bg-surface-overlay/60" : ""
      }`}
    >
      <View
        className={`h-8 w-8 items-center justify-center rounded-full ${
          unread ? "bg-surface-plate-ink" : "bg-surface-overlay"
        }`}
      >
        <Icon name={meta.icon} size={16} color={unread ? "#C4B5FD" : "#71717A"} />
      </View>

      <View className="flex-1 gap-0.5">
        <View className="flex-row items-start justify-between gap-2">
          <Text
            className={`flex-1 text-sm font-sans-semibold ${
              unread ? "text-content-primary" : "text-content-secondary"
            }`}
            numberOfLines={1}
          >
            {notification.title ?? "Notification"}
          </Text>
          <Text className="font-mono text-[11px] text-content-muted">
            {formatThreadTimestamp(notification.created_at)}
          </Text>
        </View>
        {notification.body ? (
          <Text className="text-xs text-content-muted" numberOfLines={2}>
            {notification.body}
          </Text>
        ) : null}
      </View>

      {unread ? <View className="mt-1.5 h-2 w-2 rounded-full bg-brand" /> : null}
    </Pressable>
  );
}
