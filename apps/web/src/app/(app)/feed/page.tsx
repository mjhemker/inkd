import type { Metadata } from "next";
import { FeedScreen } from "@/components/feed/FeedScreen";

export const metadata: Metadata = { title: "Home" };

// The signed-in home tab is the discovery feed (SPEC §4). Artists are clients
// too, so they see the same feed — no separate artist home this wave.
export default function FeedPage() {
  return <FeedScreen />;
}
