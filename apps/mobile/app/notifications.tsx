import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  useCurrentProfile,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  type Notification,
} from "@inkd/core";
import { Button, Chip, EmptyState, Icon, Skeleton, ToastProvider } from "@inkd/ui/native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { NotificationListItem } from "@/components/notifications/NotificationListItem";
import { NOTIFICATION_FILTER_TYPES, notificationKindMeta } from "@/lib/notifications";
import { normalizeDeepLink } from "@/lib/nav";
import { useTheme } from "@/providers/theme";

const PAGE_SIZE = 20;

type FilterValue = "all" | (typeof NOTIFICATION_FILTER_TYPES)[number];

export default function NotificationsScreen() {
  return (
    <ToastProvider>
      <NotificationsScreenContent />
    </ToastProvider>
  );
}

function NotificationsScreenContent() {
  const { colors } = useTheme();
  const { data: profile } = useCurrentProfile();
  const profileId = profile?.id;

  const [filter, setFilter] = useState<FilterValue>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const listQ = useNotifications(profileId, {
    type: filter === "all" ? undefined : filter,
    limit: visibleCount,
  });
  const markRead = useMarkNotificationRead(profileId);
  const markAllRead = useMarkAllNotificationsRead(profileId);

  const notifications = listQ.data ?? [];
  const hasMore = notifications.length >= visibleCount;
  const hasUnread = notifications.some((n) => !n.is_read);

  function handleSelect(notification: Notification) {
    if (!notification.is_read) markRead.mutate(notification.id);
    if (notification.action_url) router.push(normalizeDeepLink(notification.action_url) as never);
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
      <ScrollView className="flex-1" contentContainerClassName="gap-5 px-6 py-6">
        <BackLink />

        <ScreenHeader
          eyebrow="INBOX"
          title="Notifications"
          subtitle="Booking activity, payments, reviews, and messages."
          action={
            <View className="flex-row items-center gap-2">
              {hasUnread ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                >
                  Mark all read
                </Button>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Notification settings"
                hitSlop={8}
                onPress={() => router.push("/notification-settings")}
                className="h-9 w-9 items-center justify-center rounded-sm border border-border-subtle"
              >
                <Icon name="settings" size={16} color={colors.text.secondary} />
              </Pressable>
            </View>
          }
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pr-6">
          <Chip selected={filter === "all"} onPress={() => setFilter("all")}>
            All
          </Chip>
          {NOTIFICATION_FILTER_TYPES.map((type) => {
            const meta = notificationKindMeta(type);
            return (
              <Chip
                key={type}
                selected={filter === type}
                leadingIcon={<Icon name={meta.icon} size={14} color={filter === type ? "#0A0A0B" : colors.text.secondary} />}
                onPress={() => setFilter(type)}
              >
                {meta.label}
              </Chip>
            );
          })}
        </ScrollView>

        {listQ.isLoading ? (
          <View className="gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </View>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={<Icon name="bell" size={26} color={colors.text.muted} />}
            title="No notifications yet"
            description="Booking activity, payments, reviews, and messages will show up here as they happen."
          />
        ) : (
          <View className="gap-0.5 rounded-xl border border-border-subtle bg-surface-base p-1">
            {notifications.map((n) => (
              <NotificationListItem key={n.id} notification={n} onSelect={handleSelect} />
            ))}
          </View>
        )}

        {hasMore && !listQ.isLoading ? (
          <Button
            variant="secondary"
            size="sm"
            className="self-center"
            onPress={() => setVisibleCount((v) => v + PAGE_SIZE)}
          >
            Load more
          </Button>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function BackLink() {
  return (
    <Text
      onPress={() => (router.canGoBack() ? router.back() : router.push("/(tabs)/profile"))}
      className="text-sm text-content-secondary"
    >
      {"< Back"}
    </Text>
  );
}
