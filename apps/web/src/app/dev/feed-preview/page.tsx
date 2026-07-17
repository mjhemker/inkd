"use client";

/**
 * Dev-only preview harness for the discovery FEED (`/feed`). Renders the REAL
 * `FeedScreen` + `@inkd/core` feed hooks against an in-memory mock Supabase
 * client seeded with demo data, because this sandbox blocks egress to the live
 * `khlpidflnvkqafkvkpfy.supabase.co` project for browser/SSR requests.
 *
 * The nested `InkdProvider` shadows the root one for this subtree only.
 * Never linked from product nav. Not for production use.
 */
import { Suspense, useMemo } from "react";
import { InkdProvider } from "@inkd/core/hooks";
import { FeedScreen } from "@/components/feed/FeedScreen";
import { createFeedMockClient } from "./feedMockClient";
import { feedDemoSeed } from "./feedSeed";

export default function FeedPreviewPage() {
  const client = useMemo(() => createFeedMockClient(feedDemoSeed), []);

  return (
    <InkdProvider client={client}>
      <div className="min-h-dvh bg-surface-base">
        <div className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8">
          {/* FeedScreen reads useSearchParams (URL-persisted filters). */}
          <Suspense fallback={null}>
            <FeedScreen />
          </Suspense>
        </div>
      </div>
    </InkdProvider>
  );
}
