/**
 * Standalone notification preferences screen — reachable by every signed-in
 * user (clients included, who have no artist Settings), e.g. from the gear on
 * the Notifications inbox. Artists also see the same editor as a Settings tab.
 */
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ToastProvider } from "@inkd/ui/native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { NotificationPreferencesEditor } from "@/components/notifications/NotificationPreferencesEditor";

export default function NotificationSettingsScreen() {
  return (
    <ToastProvider>
      <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
        <ScrollView className="flex-1" contentContainerClassName="gap-5 px-6 py-6">
          <Text
            onPress={() =>
              router.canGoBack() ? router.back() : router.push("/notifications")
            }
            className="text-sm text-content-secondary"
          >
            {"< Back"}
          </Text>
          <ScreenHeader
            eyebrow="SETTINGS"
            title="Notification settings"
            subtitle="How INKD reaches you — in-app, push, and email."
          />
          <View>
            <NotificationPreferencesEditor />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ToastProvider>
  );
}
