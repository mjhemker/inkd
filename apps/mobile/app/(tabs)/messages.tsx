import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, EmptyState, Icon } from "@inkd/ui/native";

import { ScreenHeader } from "@/components/ScreenHeader";

export default function MessagesScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
      <ScrollView className="flex-1" contentContainerClassName="gap-8 px-6 py-8">
        <ScreenHeader
          eyebrow="INBOX"
          title="Messages"
          subtitle="Every client conversation, organized by thread."
        />

        <EmptyState
          icon={<Icon name="message-circle" size={32} color="#71717A" />}
          title="No conversations yet"
          description="Client chats will land here the moment your first message comes through."
          action={
            <Button size="md" onPress={() => {}}>
              Start a conversation
            </Button>
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
