import type { Metadata } from "next";
import { PlaceholderScreen } from "@/components/placeholder-screen";

export const metadata: Metadata = { title: "Home" };

export default function FeedPage() {
  return (
    <PlaceholderScreen
      eyebrow="Your feed"
      title="Home"
      subtitle="New work from the artists and studios you follow."
      icon="image"
      emptyTitle="Your feed is quiet for now"
      description="Follow a few artists and their latest pieces will land here — flash, healed shots and open books."
      actionLabel="Explore artists"
      actionHref="/discover"
    />
  );
}
