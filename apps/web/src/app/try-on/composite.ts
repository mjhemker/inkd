/**
 * Client-side canvas compositing for the web fit check. Pure DOM/canvas — no
 * React, no network. Everything runs against images already in the browser.
 */
import {
  INK_BLEND,
  TRYON_PLACARD_LABEL,
  TRYON_WRAP_STRIPS_WEB,
  cylindricalWarpStrips,
  fitDimensions,
  inkFilter,
  type TryOnTransform,
} from "@inkd/core";

export interface LoadedImage {
  el: HTMLImageElement;
  width: number;
  height: number;
  /** True when the source is remote and loaded without CORS — export may taint. */
  crossOriginBlocked: boolean;
}

/** Read a picked File into a data URL (stays entirely in-browser). */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

/**
 * Load an <img> from any src. For remote URLs we first try `crossOrigin`
 * so the export canvas stays untainted; if that fails (server sent no CORS
 * header) we fall back to a plain load so the preview still works, and flag it
 * so the UI can explain why export is blocked.
 */
export function loadImage(src: string): Promise<LoadedImage> {
  const isRemote = /^https?:\/\//i.test(src) && !src.startsWith(location.origin);
  const attempt = (crossOrigin: boolean) =>
    new Promise<LoadedImage>((resolve, reject) => {
      const img = new Image();
      if (crossOrigin) img.crossOrigin = "anonymous";
      img.onload = () =>
        resolve({
          el: img,
          width: img.naturalWidth,
          height: img.naturalHeight,
          crossOriginBlocked: isRemote && !crossOrigin,
        });
      img.onerror = () => reject(new Error("Could not load that image."));
      img.src = src;
    });

  if (!isRemote) return attempt(false);
  return attempt(true).catch(() => attempt(false));
}

/**
 * The stage is sized to the (downscaled) body photo. Returns the CSS pixel
 * dimensions the canvas backing store should use.
 */
export function stageSize(body: LoadedImage): { width: number; height: number } {
  const { width, height } = fitDimensions(body.width, body.height);
  return { width, height };
}

/** Base on-stage design width before the user's scale multiplier is applied. */
function baseDesignScale(stageW: number, design: LoadedImage): number {
  // Start every design at ~34% of the stage width — a believable small/medium
  // tattoo — then the user scales from there.
  return (stageW * 0.34) / Math.max(1, design.width);
}

export interface DrawOptions {
  /** When false, only the body photo is drawn (the "before" view). */
  showDesign: boolean;
  /**
   * Offscreen-canvas cache for the cylindrical wrap remap. Pass the SAME
   * instance across frames (e.g. a `useRef`) so the strip slicing only
   * reruns when the wrap amount or source design changes — every other
   * control (position/scale/rotation/opacity/ink-blend) redraws against the
   * already-warped bitmap, keeping the stage 60fps-usable while dragging.
   * If omitted, a throwaway cache is built for this call only (fine for a
   * one-off export, wasteful for a live redraw loop).
   */
  warpCache?: WarpCache;
}

/**
 * Slices `design` into `stripCount` vertical strips and remaps each one via
 * `cylindricalWarpStrip` onto a same-size offscreen canvas — this is the
 * actual "wrap around a limb" effect (see packages/core/src/tryon/index.ts
 * for the math). Strips draw with a hairline overlap to avoid seams from
 * subpixel rounding between adjacent slices.
 */
function buildWarpedDesign(
  design: LoadedImage,
  wrapDeg: number,
  stripCount: number,
): HTMLCanvasElement {
  const w = Math.max(1, design.width);
  const h = Math.max(1, design.height);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const strips = cylindricalWarpStrips(stripCount, wrapDeg);
  const overlap = 0.75; // px of destination overdraw per strip edge, hides seams
  for (const strip of strips) {
    const sx = strip.uStart * w;
    const sw = Math.max(0.5, (strip.uEnd - strip.uStart) * w);
    const dx = strip.xStart * w - overlap / 2;
    const dw = Math.max(0.75, strip.width * w + overlap);

    ctx.save();
    ctx.globalAlpha = strip.opacity;
    if (strip.brightness < 1) ctx.filter = `brightness(${strip.brightness})`;
    ctx.drawImage(design.el, sx, 0, sw, h, dx, 0, dw, h);
    ctx.restore();
  }
  return canvas;
}

/**
 * Single-slot cache: remembers the last `(source, stripCount, wrapDeg)` it
 * warped and reuses that offscreen canvas until one of those actually
 * changes. `wrapDeg <= 0` skips the canvas entirely and hands back the raw
 * `<img>` element (the flat/identity fast path costs nothing).
 */
export class WarpCache {
  private key: string | null = null;
  private canvas: HTMLCanvasElement | null = null;

  get(design: LoadedImage, wrapDeg: number, stripCount: number = TRYON_WRAP_STRIPS_WEB): CanvasImageSource {
    if (wrapDeg <= 0) {
      this.key = null;
      this.canvas = null;
      return design.el;
    }
    const key = `${design.el.src}|${design.width}x${design.height}|${stripCount}|${Math.round(wrapDeg)}`;
    if (this.key === key && this.canvas) return this.canvas;
    this.canvas = buildWarpedDesign(design, wrapDeg, stripCount);
    this.key = key;
    return this.canvas;
  }
}

export function createWarpCache(): WarpCache {
  return new WarpCache();
}

/** Draw body + transformed design onto a 2D context sized to the stage. */
export function drawComposite(
  ctx: CanvasRenderingContext2D,
  stageW: number,
  stageH: number,
  body: LoadedImage,
  design: LoadedImage | null,
  t: TryOnTransform,
  opts: DrawOptions,
): void {
  ctx.clearRect(0, 0, stageW, stageH);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(body.el, 0, 0, stageW, stageH);

  if (!design || !opts.showDesign) return;

  const base = baseDesignScale(stageW, design);
  const w = design.width * base * t.scale;
  const h = design.height * base * t.scale;

  // Cylindrical remap happens in the design's own local space (around its
  // vertical axis) BEFORE the on-stage scale/rotate/position transform is
  // applied, so wrapping composes correctly at any size/angle/placement.
  const cache = opts.warpCache ?? new WarpCache();
  const source = cache.get(design, t.wrap, TRYON_WRAP_STRIPS_WEB);

  ctx.save();
  ctx.globalAlpha = t.opacity;
  if (t.inkBlend) {
    ctx.globalCompositeOperation = INK_BLEND.compositeOperation;
    ctx.filter = inkFilter();
  }
  ctx.translate(t.x * stageW, t.y * stageH);
  ctx.rotate((t.rotation * Math.PI) / 180);
  ctx.drawImage(source, -w / 2, -h / 2, w, h);
  ctx.restore();

  // Reset shared state for the next frame.
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

/**
 * Render the full composite to an offscreen canvas and stamp the mono placard,
 * then return a PNG blob. Throws a SecurityError if the design tainted the
 * canvas (remote image without CORS) — the caller surfaces that to the user.
 */
export async function exportComposite(
  body: LoadedImage,
  design: LoadedImage | null,
  t: TryOnTransform,
): Promise<Blob> {
  const { width, height } = stageSize(body);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");

  drawComposite(ctx, width, height, body, design, t, { showDesign: true });
  stampPlacard(ctx, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not build the image."));
    }, "image/png");
  });
}

/** Bottom mono placard: honest framing baked into every export. */
function stampPlacard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const barH = Math.max(28, Math.round(height * 0.052));
  const pad = Math.round(barH * 0.34);
  const fontPx = Math.max(10, Math.round(barH * 0.4));

  ctx.save();
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  // Plate
  ctx.fillStyle = "rgba(10,10,11,0.86)";
  ctx.fillRect(0, height - barH, width, barH);
  // Ember hairline on top edge of the plate
  ctx.fillStyle = "#F0662E";
  ctx.fillRect(0, height - barH, width, Math.max(1, Math.round(barH * 0.05)));

  ctx.fillStyle = "#FAFAFA";
  ctx.font = `600 ${fontPx}px ui-monospace, "JetBrains Mono", "SFMono-Regular", Menlo, monospace`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(TRYON_PLACARD_LABEL, pad, height - barH / 2, width - pad * 2);
  ctx.restore();
}

/** Trigger a browser download for an exported blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
