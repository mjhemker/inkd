"use client";

/**
 * Dev-only preview harness for the DAILY DROP surface (`/daily-drop`). Renders
 * the REAL DailyDropSurface + @inkd/core daily-drop hooks against an in-memory
 * mock Supabase client seeded with demo data, because this sandbox blocks egress
 * to the live Supabase project for browser/SSR requests.
 *
 * The nested InkdProvider shadows the root one for this subtree only. Never
 * linked from product nav. Not for production use.
 */
import { useMemo } from "react";
import { InkdProvider } from "@inkd/core/hooks";
import { DailyDropSurface } from "@/components/daily-drop/DailyDropSurface";
import { createDropMockClient } from "./dropMockClient";
import { dailyDropDemoSeed } from "./dropSeed";

export default function DailyDropPreviewPage() {
  const client = useMemo(() => createDropMockClient(dailyDropDemoSeed), []);
  return (
    <InkdProvider client={client}>
      <div className="min-h-dvh bg-surface-base">
        <div className="mx-auto w-full max-w-5xl px-5 py-10 md:px-8">
          <DailyDropSurface />
        </div>
      </div>
    </InkdProvider>
  );
}
