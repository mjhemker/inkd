import type { Metadata } from "next";
import { PlaceholderScreen } from "@/components/placeholder-screen";

export const metadata: Metadata = { title: "Messages" };

export default function MessagesPage() {
  return (
    <PlaceholderScreen
      eyebrow="Inbox"
      title="Messages"
      subtitle="Client conversations, with your AI front desk drafting the replies."
      icon="message-circle"
      emptyTitle="No conversations yet"
      description="When clients reach out, threads show up here. Your assistant drafts grounded replies for you to approve and send."
    />
  );
}
