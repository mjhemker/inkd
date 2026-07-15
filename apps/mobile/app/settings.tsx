import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, EmptyState, Icon } from "@inkd/ui/native";

import { ScreenHeader } from "@/components/ScreenHeader";

export default function SettingsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
      <ScrollView className="flex-1" contentContainerClassName="gap-8 px-6 py-8">
        <ScreenHeader
          eyebrow="ACCOUNT"
          title="Settings"
          subtitle="Manage your account, notifications, and studio preferences."
        />

        <EmptyState
          icon={<Icon name="settings" size={32} color="#71717A" />}
          title="Settings will live here"
          description="Account details, notification preferences, and studio configuration are coming soon."
          action={
            <Button size="md" onPress={() => {}}>
              Back to profile
            </Button>
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
