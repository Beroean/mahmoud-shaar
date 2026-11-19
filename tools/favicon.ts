/**
 * Writes the site icon into public/: the eight-point star (khatam) from the page background,
 * gold on ink.
 *
 *   npm run favicon
 *
 * - favicon.svg            modern browsers (sharp at any size)
 * - favicon-32x32.png      browsers without SVG favicons
 * - favicon.ico            the default /favicon.ico request (one 32×32 PNG inside)
 * - apple-touch-icon.png   iOS home screen (180×180, full-bleed: iOS rounds the corners itself)
 *
 * The files are committed; rerun this only when the design changes.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const OUT = resolve(import.meta.dirname, "../public");
const INK = "#0a0a0a";
const GOLD = "#c9a96e";

/** Two overlapping squares (one turned 45°) and a centre dot, on a 32×32 grid. */
const STAR = `<g fill="none" stroke="${GOLD}" stroke-width="2" stroke-linejoin="round">
    <rect x="9" y="9" width="14" height="14"/>
    <rect x="9" y="9" width="14" height="14" transform="rotate(45 16 16)"/>
  </g>
  <circle cx="16" cy="16" r="2.2" fill="${GOLD}"/>`;

/** `radius` rounds the tile's corners; the touch icon is square since iOS masks it. */
const icon = (radius: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="${radius}" fill="${INK}"/>
  ${STAR}
</svg>
`;

const png = (svg: string, size: number) =>
  new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();

/** An .ico holding one PNG image (supported by every browser that still asks for .ico). */
function ico(image: Buffer, size: number): Buffer {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  header.writeUInt8(size, 6);
  header.writeUInt8(size, 7);
  header.writeUInt8(0, 8); // no palette
  header.writeUInt8(0, 9); // reserved
  header.writeUInt16LE(1, 10); // colour planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(image.length, 14);
  header.writeUInt32LE(22, 18); // image data starts after this header
  return Buffer.concat([header, image]);
}

const tab = icon(7);
const small = png(tab, 32);
const files: Record<string, string | Buffer> = {
  "favicon.svg": tab,
  "favicon-32x32.png": small,
  "favicon.ico": ico(small, 32),
  "apple-touch-icon.png": png(icon(0), 180),
};
for (const [name, data] of Object.entries(files)) {
  writeFileSync(resolve(OUT, name), data);
  console.log(`public/${name}  ${(Buffer.byteLength(data) / 1024).toFixed(1)} KB`);
}
