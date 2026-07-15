"use client";

/**
 * Client-side QR + placard PNG generator for the settings "Share kit"
 * (see components/artist/share-kit.tsx). Uses the `qrcode` npm package
 * (tiny, no API key) to render a matrix, then composites it onto a branded
 * INKD placard — dark plate, violet frame, mono handle — with the Canvas API.
 * Nothing here touches the network; the QR just encodes the artist's own
 * booking URL.
 */
import QRCode from "qrcode";

export interface PlacardOptions {
  url: string;
  handle: string;
}

const WIDTH = 640;
const HEIGHT = 800;
const QR_SIZE = 400;

// Brand tokens (packages/ui/tokens.cjs) — duplicated as literal hex here since
// canvas drawing can't consume Tailwind classes.
const INK = "#0A0A0B"; // surface.base
const PAPER = "#FAFAFA"; // content.primary / neutral-50
const VIOLET = "#7C3AED"; // brand.primary
const VIOLET_LIGHT = "#A78BFA"; // primary-400, used for text on the dark plate
const MUTED = "#A1A1AA"; // neutral-300

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to render QR image"));
    img.src = src;
  });
}

/** Renders the branded booking-link placard (QR + handle + INKD mark) onto a
 * canvas. Waits for the page's custom fonts so the mono/display faces render
 * where available, falling back to system fonts otherwise. */
export async function renderBookingPlacard(opts: PlacardOptions): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser");

  if (typeof document !== "undefined" && "fonts" in document) {
    try {
      await document.fonts.ready;
    } catch {
      // Fall back to whatever's loaded — never block the render on this.
    }
  }

  // Dark plate background.
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Violet placard frame.
  ctx.strokeStyle = VIOLET;
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, WIDTH - 6, HEIGHT - 6);

  ctx.textAlign = "center";

  // INKD wordmark.
  ctx.fillStyle = PAPER;
  ctx.font = "800 40px 'Bricolage Grotesque', system-ui, sans-serif";
  ctx.fillText("INKD", WIDTH / 2, 84);

  // Mono eyebrow.
  ctx.fillStyle = VIOLET_LIGHT;
  ctx.font = "600 14px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillText("B O O K   V I A   I N K D", WIDTH / 2, 116);

  // QR code — dark modules on a light plate so it's high-contrast and prints
  // cleanly regardless of the surface it's shared to.
  const qrDataUrl = await QRCode.toDataURL(opts.url, {
    margin: 0,
    width: QR_SIZE,
    color: { dark: INK, light: PAPER },
  });
  const qrImage = await loadImage(qrDataUrl);
  const qrX = (WIDTH - QR_SIZE) / 2;
  const qrY = 150;
  const pad = 24;
  ctx.fillStyle = PAPER;
  ctx.fillRect(qrX - pad, qrY - pad, QR_SIZE + pad * 2, QR_SIZE + pad * 2);
  ctx.drawImage(qrImage, qrX, qrY, QR_SIZE, QR_SIZE);

  // Mono handle.
  const belowQr = qrY + QR_SIZE + pad;
  ctx.fillStyle = PAPER;
  ctx.font = "600 28px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillText(`@${opts.handle}`, WIDTH / 2, belowQr + 54);

  // URL.
  ctx.fillStyle = MUTED;
  ctx.font = "500 18px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillText(opts.url.replace(/^https?:\/\//, ""), WIDTH / 2, belowQr + 88);

  return canvas;
}

/** Triggers a browser download of a canvas as a PNG file. */
export async function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Couldn't generate a PNG from the placard");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
