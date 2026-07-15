/**
 * Client-side canvas compositing for the web fit check. Pure DOM/canvas — no
 * React, no network. Everything runs against images already in the browser.
 */
import {
  INK_BLEND,
  TRYON_PLACARD_LABEL,
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

  ctx.save();
  ctx.globalAlpha = t.opacity;
  if (t.inkBlend) {
    ctx.globalCompositeOperation = INK_BLEND.compositeOperation;
    ctx.filter = inkFilter();
  }
  ctx.translate(t.x * stageW, t.y * stageH);
  ctx.rotate((t.rotation * Math.PI) / 180);
  // Horizontal skew fakes wrapping around a limb.
  ctx.transform(1, 0, Math.tan((t.skewX * Math.PI) / 180), 1, 0, 0);
  ctx.drawImage(design.el, -w / 2, -h / 2, w, h);
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
