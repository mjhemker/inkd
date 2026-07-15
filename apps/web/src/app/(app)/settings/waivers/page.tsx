import type { Metadata } from "next";
import { Eyebrow } from "@inkd/ui/web";
import { WaiverTemplateManager } from "@/components/waivers/WaiverTemplateManager";

export const metadata: Metadata = { title: "Waivers" };

/**
 * Standalone artist-facing waiver management page. Deliberately its own
 * subroute (not a tab inside /settings/page.tsx, which another agent owns) —
 * SPEC §2 "waivers ... MD/PA-aware, e-signature, retention".
 */
export default function SettingsWaiversPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Eyebrow>Settings &middot; Waivers</Eyebrow>
        <h1 className="font-display text-3xl font-bold tracking-tight text-content-primary sm:text-4xl">
          Waivers &amp; consent
        </h1>
        <p className="max-w-xl text-content-secondary">
          Pick and customize your state consent forms, then track every
          client&apos;s signed, immutable record in one place.
        </p>
      </header>

      <WaiverTemplateManager />
    </div>
  );
}
