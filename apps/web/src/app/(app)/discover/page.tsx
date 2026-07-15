import type { Metadata } from "next";
import { PlaceholderScreen } from "@/components/placeholder-screen";

export const metadata: Metadata = { title: "Discover" };

export default function DiscoverPage() {
  return (
    <PlaceholderScreen
      eyebrow="Discover"
      title="Discover"
      subtitle="Find artists near you by style, city, price and open books."
      icon="map-pin"
      emptyTitle="The map is warming up"
      description="A live map with filters that actually work — style, city, price band and availability — is being built on this screen."
      actionLabel="Browse by style"
      actionHref="/feed"
    />
  );
}
