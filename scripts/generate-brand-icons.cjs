/**
 * Regenerate INKD favicons + web/mobile app icons from the master brand SVGs
 * in apps/web/public/brand (inkd-mark.svg / inkd-icon-square.svg / inkd-glyph.svg).
 *
 *   node scripts/generate-brand-icons.cjs   (run from the repo root; needs sharp)
 *
 * Outputs: web favicons + PNGs (apps/web/...), and the Expo icon/adaptive/splash
 * PNGs (apps/mobile/assets). Commit the results.
 */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const tileSquare = fs.readFileSync("apps/web/public/brand/inkd-icon-square.svg");
const tileRounded = fs.readFileSync("apps/web/public/brand/inkd-mark.svg");
const glyph = fs.readFileSync("apps/web/public/brand/inkd-glyph.svg");
// The bare mark drawn in light ink, for the near-black splash. The dark `glyph`
// is invisible there — pick the variant that matches the surface behind it.
const glyphLight = fs.readFileSync("apps/web/public/brand/inkd-glyph-light.svg");

const png = (svg, size, opts = {}) =>
  sharp(svg, { density: 384 })
    .resize(size, size, { fit: "contain", background: opts.bg || { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

// Glyph centered on a transparent canvas with margin (for splash / adaptive).
async function paddedGlyph(canvas, glyphFrac, art = glyph) {
  const g = Math.round(canvas * glyphFrac);
  const buf = await png(art, g);
  return sharp({
    create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: buf, gravity: "center" }])
    .png()
    .toBuffer();
}

function icoFrom(png32) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type icon
  header.writeUInt16LE(1, 4); // count
  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0); // width
  entry.writeUInt8(32, 1); // height
  entry.writeUInt8(0, 2); // palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(png32.length, 8); // size
  entry.writeUInt32LE(22, 12); // offset
  return Buffer.concat([header, entry, png32]);
}

(async () => {
  const out = (p) => path.join(ROOT, p);
  const write = (p, buf) => { fs.mkdirSync(path.dirname(out(p)), { recursive: true }); fs.writeFileSync(out(p), buf); };

  // --- WEB ---
  write("apps/web/public/brand/icon-32.png", await png(tileRounded, 32));
  write("apps/web/public/brand/icon-192.png", await png(tileRounded, 192));
  write("apps/web/public/brand/icon-512.png", await png(tileRounded, 512));
  write("apps/web/public/brand/apple-icon.png", await png(tileSquare, 180)); // apple wants opaque square
  fs.copyFileSync(out("apps/web/public/brand/inkd-mark.svg"), out("apps/web/src/app/icon.svg"));
  write("apps/web/src/app/favicon.ico", icoFrom(await png(tileRounded, 32)));

  // --- MOBILE ---
  write("apps/mobile/assets/icon.png", await png(tileSquare, 1024));          // ios/general
  write("apps/mobile/assets/adaptive-icon.png", await paddedGlyph(1024, 0.62)); // android fg, on the white adaptive bg
  write("apps/mobile/assets/splash.png", await paddedGlyph(1200, 0.30, glyphLight)); // splash sits on near-black
  write("apps/mobile/assets/favicon.png", await png(tileRounded, 48));          // expo web

  console.log("generated icons");
})().catch((e) => { console.error(e); process.exit(1); });
