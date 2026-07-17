import type { Metadata } from "next";
import { Suspense } from "react";
import { FeedScreen } from "@/components/feed/FeedScreen";

export const metadata: Metadata = { title: "Home" };

// The signed-in home tab is the discovery feed (SPEC §4). Artists are clients
// too, so they see the same feed — no separate artist home this wave.
// useSearchParams (URL-persisted feed filters) needs a Suspense boundary.
export default function FeedPage() {
  return (
    <Suspense fallback={null}>
      <FeedScreen />
    </Suspense>
  );
}
