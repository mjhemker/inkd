import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ThreadList } from "@/components/messages/ThreadList";

export default function MessagesListScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
      <View className="gap-3 px-6 pb-4 pt-6">
        <ScreenHeader
          eyebrow="Inbox"
          title="Messages"
          subtitle="Every client conversation, organized by thread."
        />
      </View>
      <ThreadList />
    </SafeAreaView>
  );
}
