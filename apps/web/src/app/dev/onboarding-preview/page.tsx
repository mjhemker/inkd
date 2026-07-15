"use client";

/**
 * Offline PREVIEW harness for the artist onboarding flow + settings, rendered
 * against an in-memory fake Supabase client. Exists only so the real screens
 * can be reviewed/screenshotted without network access to Supabase.
 * Visit /dev/onboarding-preview?view=onboarding or ?view=settings.
 */
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { InkdProvider } from "@inkd/core/hooks";
import { Spinner, ToastProvider } from "@inkd/ui/web";

import { OnboardingFlow } from "@/app/onboarding/onboarding-flow";
import { SettingsView } from "@/app/(app)/settings/settings-view";
import { createFakeClient } from "./fake-client";

function Preview() {
  const params = useSearchParams();
  const view = params.get("view") ?? "onboarding";
  const [client] = useState(() => createFakeClient());

  return (
    <InkdProvider client={client}>
      <ToastProvider>
        {view === "settings" ? (
          <div className="mx-auto w-full max-w-5xl px-5 py-10">
            <SettingsView />
          </div>
        ) : (
          <OnboardingFlow />
        )}
      </ToastProvider>
    </InkdProvider>
  );
}

export default function OnboardingPreviewPage() {
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
