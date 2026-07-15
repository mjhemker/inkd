import { useLocalSearchParams } from "expo-router";
import { ChatThread } from "@/components/messages/ChatThread";

export default function ThreadScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  return <ChatThread threadId={threadId} />;
}
