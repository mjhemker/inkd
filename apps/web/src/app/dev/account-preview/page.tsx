"use client";

/**
 * Dev-only preview of the Settings → Account controls (Switch-to-client +
 * Danger Zone), rendered outside the auth wall so the confirmation modals can be
 * reviewed. Uses the real components from the settings view. Dev-only; not
 * indexed and not linked from the app.
 */
import {
  DangerZoneCard,
  SwitchToClientCard,
} from "@/app/(app)/settings/settings-view";

export default function AccountPreviewPage() {
  return (
    <div className="min-h-dvh bg-surface-base px-5 py-10 text-content-primary">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Account controls (preview)
        </h1>
        <SwitchToClientCard />
        <DangerZoneCard />
      </div>
    </div>
  );
}
