import type { Metadata } from "next";
import { TryOnEditor } from "@/app/try-on/TryOnEditor";

export const metadata: Metadata = {
  title: "Fit check — dev harness (internal)",
  robots: { index: false, follow: false },
};

/**
 * Offline demo of the photo-based fit-check editor, preloaded with a bundled
 * sample body photo + sample design (generated placeholders under
 * /dev/tryon/*). Fully demoable with no upload, no backend. The production
 * route at `/try-on` never preloads a body photo — the user picks their own.
 */
export default function DevTryOnPreviewPage() {
  return (
    <TryOnEditor
      initialBody="/dev/tryon/sample-body.jpg"
      initialDesign="/dev/tryon/sample-design.png"
    />
  );
}
