"use client";

/**
 * Dev-only side-by-side proof that the "Wrap (limb curve)" control is a real
 * cylindrical remap, not a shear: the same design + limb photo rendered at
 * flat / mid / max wrap, so the compression-toward-the-edges + brightness/
 * opacity falloff is obvious in one screenshot. Never rendered in production
 * (this route is `robots: noindex` and only reachable at /dev/try-on-preview).
 */
import { useEffect, useRef, useState } from "react";
import { clampTransform, DEFAULT_TRYON_TRANSFORM, TRYON_LIMITS, type TryOnTransform } from "@inkd/core";
import { createWarpCache, drawComposite, loadImage, stageSize, type LoadedImage } from "@/app/try-on/composite";

const PRESETS: { label: string; wrap: number }[] = [
  { label: "Flat — wrap 0°", wrap: 0 },
  { label: "Mid wrap — 75°", wrap: Math.round(TRYON_LIMITS.wrapMax / 2) },
  { label: "Max wrap — 150°", wrap: TRYON_LIMITS.wrapMax },
];

// A believable placement: mid-limb, sized up a bit and rotated slightly so
// it reads like a forearm piece — same for all three tiles except `wrap`.
const BASE_TRANSFORM: TryOnTransform = clampTransform({
  ...DEFAULT_TRYON_TRANSFORM,
  x: 0.5,
  y: 0.46,
  scale: 1.35,
  rotation: -4,
  opacity: 0.92,
  inkBlend: true,
});

export function WrapComparison({
  bodySrc,
  designSrc,
}: {
  bodySrc: string;
  designSrc: string;
}) {
  const [body, setBody] = useState<LoadedImage | null>(null);
  const [design, setDesign] = useState<LoadedImage | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([loadImage(bodySrc), loadImage(designSrc)]).then(([b, d]) => {
      if (!alive) return;
      setBody(b);
      setDesign(d);
    });
    return () => {
      alive = false;
    };
  }, [bodySrc, designSrc]);

  if (!body || !design) {
    return <p className="text-sm text-content-muted">Loading wrap comparison…</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {PRESETS.map((preset) => (
        <WrapTile key={preset.wrap} label={preset.label} wrap={preset.wrap} body={body} design={design} />
      ))}
    </div>
  );
}

function WrapTile({
  label,
  wrap,
  body,
  design,
}: {
  label: string;
  wrap: number;
  body: LoadedImage;
  design: LoadedImage;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const warpCacheRef = useRef(createWarpCache());
  const size = stageSize(body);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const t = clampTransform({ ...BASE_TRANSFORM, wrap });
    drawComposite(ctx, size.width, size.height, body, design, t, {
      showDesign: true,
      warpCache: warpCacheRef.current,
    });
  }, [body, design, wrap, size.width, size.height]);

  return (
    <figure className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-sm border border-border bg-surface-raised">
        <canvas ref={canvasRef} width={size.width} height={size.height} className="block h-auto w-full" />
      </div>
      <figcaption className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-content-muted">
        {label}
      </figcaption>
    </figure>
  );
}
