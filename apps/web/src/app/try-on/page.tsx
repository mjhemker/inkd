import type { Metadata } from "next";
import { TryOnEditor } from "./TryOnEditor";

export const metadata: Metadata = {
  title: "Fit check — INKD",
  description:
    "Photo-based tattoo fit check. Size a design, place it on your own photo, and sit with it. A placement preview — not a prediction, not AR. Everything stays on your device.",
};

/**
 * Public, deep-linkable fit-check editor at `/try-on`. A `?design=<url>` param
 * (passed by post/flash entry points) pre-loads a design. No auth, no backend —
 * the body photo never leaves the browser.
 */
export default async function TryOnPage({
  searchParams,
}: {
  searchParams: Promise<{ design?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.design) ? params.design[0] : params.design;
  const initialDesign = normalizeDesign(raw);
  return <TryOnEditor initialDesign={initialDesign} />;
}

/** Only accept http(s) or same-origin relative image paths as a design source. */
function normalizeDesign(value: string | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("/")) return v;
  return null;
}
