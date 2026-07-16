import type { Metadata } from "next";
import { TryOnEditor } from "@/app/try-on/TryOnEditor";
import { WrapComparison } from "./WrapComparison";

export const metadata: Metadata = {
  title: "Fit check — dev harness (internal)",
  robots: { index: false, follow: false },
};

const SAMPLE_BODY = "/dev/tryon/sample-limb.jpg";
const SAMPLE_DESIGN = "/dev/tryon/sample-design.png";

/**
 * Offline demo of the photo-based fit-check editor, preloaded with a bundled
 * sample limb photo + sample design (generated placeholders under
 * /dev/tryon/*). Fully demoable with no upload, no backend. The production
 * route at `/try-on` never preloads a body photo — the user picks their own.
 *
 * Above the interactive editor: a flat/mid/max wrap comparison strip, so the
 * cylindrical-remap effect (compression + shading toward the silhouette
 * edges — NOT a shear) is obvious from a single screenshot.
 */
export default function DevTryOnPreviewPage() {
  return (
    <div className="flex flex-col gap-8">
      <section className="mx-auto w-full max-w-6xl px-4 pt-6 lg:px-6">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-content-muted">
          Wrap comparison — same design + limb photo, wrap only
        </p>
        <WrapComparison bodySrc={SAMPLE_BODY} designSrc={SAMPLE_DESIGN} />
      </section>
      <TryOnEditor initialBody={SAMPLE_BODY} initialDesign={SAMPLE_DESIGN} />
    </div>
  );
}
