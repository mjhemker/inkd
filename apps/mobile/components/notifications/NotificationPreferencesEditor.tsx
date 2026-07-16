/**
 * Notifications preferences editor (mobile). Per-category channel toggles plus
 * the push-permission status + enable button — the mobile-specific piece that
 * actually registers this device's Expo token. Used by the artist Settings tab
 * and the standalone /notification-settings screen (reachable by clients too).
 */
import { useCallback, useEffect, useState } from "react";
import { Linking, Platform, Text, View } from "react-native";
import { Button, Card, Icon, Spinner, Toggle } from "@inkd/ui/native";
import {
  NOTIFICATION_CATEGORY_META,
  type ChannelPrefs,
  type NotificationCategory,
} from "@inkd/core";
import {
  useCurrentProfile,
  useNotificationPreferences,
  useRegisterPushToken,
  useSetNotificationPreference,
} from "@inkd/core/hooks";

import {
  getPushPermissionStatus,
  registerForPushNotificationsAsync,
} from "@/lib/push";

const CHANNELS: { key: keyof ChannelPrefs; label: string }[] = [
  { key: "in_app", label: "In-app" },
  { key: "push", label: "Push" },
  { key: "email", label: "Email" },
];

export function NotificationPreferencesEditor() {
  const { data: profile } = useCurrentProfile();
  const userId = profile?.id;
  const prefsQ = useNotificationPreferences(userId);
  const setPref = useSetNotificationPreference(userId);
  const registerToken = useRegisterPushToken();

  const [permission, setPermission] = useState<string>("undetermined");
  const [enabling, setEnabling] = useState(false);

  const refreshPermission = useCallback(async () => {
    setPermission(await getPushPermissionStatus());
  }, []);

  useEffect(() => {
    void refreshPermission();
  }, [refreshPermission]);

  async function handleEnablePush() {
    setEnabling(true);
    try {
      const reg = await registerForPushNotificationsAsync();
      setPermission(reg.status);
      if (reg.token) {
        registerToken.mutate({ token: reg.token, platform: reg.platform });
      } else if (reg.status === "denied") {
        // OS-level denial — the only way back is system settings.
        void Linking.openSettings();
      }
    } finally {
      setEnabling(false);
    }
  }

  if (prefsQ.isLoading || !userId) {
    return (
      <View className="min-h-[240px] items-center justify-center">
        <Spinner size="large" />
      </View>
    );
  }

  const prefs = prefsQ.data ?? [];
  const byCategory = new Map(prefs.map((p) => [p.category, p]));
  const pushGranted = permission === "granted";

  function toggle(category: NotificationCategory, channel: keyof ChannelPrefs, next: boolean) {
    const current = byCategory.get(category);
    if (!current) return;
    setPref.mutate({
      category,
      channels: {
        in_app: current.in_app,
        push: current.push,
        email: current.email,
        [channel]: next,
      },
    });
  }

  return (
    <View className="gap-6">
      <View className="gap-1.5">
        <Text className="font-display text-xl text-content-primary">Notifications</Text>
        <Text className="text-sm text-content-secondary">
          Choose how INKD reaches you for each kind of update. In-app always shows
          in your bell; push lands on this phone; email is best for what you
          can&apos;t miss.
        </Text>
      </View>

      {/* Push permission status */}
      <Card padding="md" className="gap-3">
        <View className="flex-row items-center gap-3">
          <View
            className={`h-9 w-9 items-center justify-center rounded-sm ${
              pushGranted ? "bg-surface-ember" : "bg-surface-overlay"
            }`}
          >
            <Icon name="bell" size={17} color={pushGranted ? "#0A0A0B" : "#A1A1AA"} />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-sans-semibold text-content-primary">
              Push on this device
            </Text>
            <Text className="text-xs text-content-muted">
              {pushGranted
                ? "Enabled — you'll get alerts on this phone."
                : permission === "denied"
                  ? "Blocked in system settings. Tap to open settings."
                  : "Not enabled yet."}
            </Text>
          </View>
        </View>
        {!pushGranted ? (
          <Button
            variant="secondary"
            size="sm"
            onPress={() => void handleEnablePush()}
            loading={enabling}
            className="self-start"
          >
            {permission === "denied" ? "Open settings" : "Enable push"}
          </Button>
        ) : null}
      </Card>

      {/* Per-category channels */}
      <View className="gap-3">
        {NOTIFICATION_CATEGORY_META.map((meta) => {
          const row = byCategory.get(meta.category);
          if (!row) return null;
          return (
            <Card key={meta.category} padding="md" className="gap-3">
              <View>
                <Text className="text-sm font-sans-semibold text-content-primary">
                  {meta.label}
                </Text>
                <Text className="text-xs text-content-muted">{meta.description}</Text>
              </View>
              <View className="gap-1">
                {CHANNELS.map((c) => (
                  <Toggle
                    key={c.key}
                    label={c.label}
                    checked={row[c.key]}
                    disabled={setPref.isPending}
                    onCheckedChange={(v) => toggle(meta.category, c.key, v)}
                  />
                ))}
              </View>
            </Card>
          );
        })}
      </View>

      {Platform.OS === "web" ? null : (
        <Text className="text-xs text-content-muted">
          Turning a channel off here stops that kind of notification on that
          channel across your account.
        </Text>
      )}
    </View>
  );
}
