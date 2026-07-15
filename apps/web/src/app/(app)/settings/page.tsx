import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  // useSearchParams (?tab deep link) needs a Suspense boundary in App Router.
  return (
    <Suspense fallback={null}>
      <SettingsView />
    </Suspense>
  );
}
