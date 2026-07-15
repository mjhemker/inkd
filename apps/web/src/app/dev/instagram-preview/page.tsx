"use client";

/**
 * Offline PREVIEW harness for the Instagram import scaffold + share kit
 * (settings "Share & connect" tab), rendered against an in-memory fake
 * Supabase client — mirrors dev/onboarding-preview/fake-client.ts's pattern,
 * extended with `functions.invoke` interception for the instagram-oauth /
 * instagram-import edge functions. Exists only so these screens can be
 * reviewed/screenshotted without network access to Supabase.
 *
 * Visit /dev/instagram-preview?scenario=not-configured|not-connected|connected
 */
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { InkdProvider } from "@inkd/core/hooks";
import { Spinner, ToastProvider } from "@inkd/ui/web";

import { SettingsView } from "@/app/(app)/settings/settings-view";
import { createFakeInstagramClient, type InstagramScenario } from "./fake-client";

function Preview() {
  const params = useSearchParams();
  const scenario = (params.get("scenario") as InstagramScenario | null) ?? "connected";
  const [client] = useState(() => createFakeInstagramClient(scenario));

  return (
    <InkdProvider client={client}>
      <ToastProvider>
        <div className="mx-auto w-full max-w-5xl px-5 py-10">
          <SettingsView />
        </div>
      </ToastProvider>
    </InkdProvider>
  );
}

export default function InstagramPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-dvh place-items-center bg-surface-base">
          <Spinner size={26} />
        </div>
      }
    >
      <Preview />
    </Suspense>
  );
}
