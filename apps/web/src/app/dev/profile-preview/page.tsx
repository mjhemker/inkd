"use client";

/**
 * Dev-only preview harness for the own-profile management screen
 * (`/profile`). Renders the REAL `ProfilePage` component against an
 * in-memory mock Supabase client + realistic seed data instead of the live
 * `khlpidflnvkqafkvkpfy.supabase.co` project, because this sandbox's egress
 * policy blocks that host for this session (see mockSupabaseClient.ts).
 *
 * This nested `InkdProvider` shadows the root one from `Providers` for this
 * subtree only — `ToastProvider` is already mounted at the root layout, so
 * it doesn't need to be duplicated here.
 *
 * Never linked from product nav. Not for production use.
 */
import { InkdProvider } from "@inkd/core/hooks";
import { createMockSupabaseClient } from "./mockSupabaseClient";
import { demoSeed } from "./seed";
import ProfilePage from "../../(app)/profile/page";

export default function ProfilePreviewPage() {
  const mockClient = createMockSupabaseClient(demoSeed);

  return (
    <InkdProvider client={mockClient}>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <ProfilePage />
      </div>
    </InkdProvider>
  );
}
