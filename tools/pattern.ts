/**
 * Generates the site's background tile: a Damascene-style 12-point star pattern.
 *
 *   npm run pattern
 *
 * Method: Hankin's "polygons in contact" on the 4.6.12 tiling (dodecagons on a
 * hexagonal lattice, squares between neighbouring dodecagons, hexagons in the
 * gaps). From every edge midpoint two rays leave at the contact angle and run
 * until they meet the ray from the next midpoint. Dodecagons become 12-point
 * stars, hexagons 6-point stars, and the strands between them close into kites
 * and pentagons, as in Damascene mosaic and mother-of-pearl inlay. Each strand
 * is drawn as a hollow strap (a gold line with a black core), giving the
 * double-line look of carved strapwork.
 *
 * The tile is the rectangle W × W√3 of the hexagonal lattice, so it repeats
 * seamlessly; strands crossing the border are clipped by the viewBox and
 * continue in the neighbouring tile.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT = resolve(import.meta.dirname, "../src/assets/damascene-tile.svg");

const GOLD = "#c9a96e";
const INK = "#0a0a0a";

/** Contact angle between each ray and its edge, in degrees. */
const CONTACT = 66;

const W = 240; // lattice spacing = tile width (viewBox units)
const H = W * Math.sqrt(3);
// Polygon edge length: W = 2·r12 + s with dodecagon inradius r12 = s(2+√3)/2.
const s = W / (3 + Math.sqrt(3));

type Poly = { cx: number; cy: number; n: number; r: number; phi0: number };

const r12 = (s * (2 + Math.sqrt(3))) / 2;
const r6 = (s * Math.sqrt(3)) / 2;
const r4 = s / 2;
const deg = Math.PI / 180;

const polys: Poly[] = [];
for (let j = -2; j <= 3; j++) {
  for (let i = -2; i <= 3; i++) {
    const cx = i * W + j * (W / 2);
    const cy = (j * H) / 2;
    polys.push({ cx, cy, n: 12, r: r12, phi0: 0 });
    for (const b of [0, 60, 120]) {
      polys.push({
        cx: cx + (W / 2) * Math.cos(b * deg),
        cy: cy + (W / 2) * Math.sin(b * deg),
        n: 4,
        r: r4,
        phi0: b * deg,
      });
    }
    for (const b of [30, 90]) {
      polys.push({
        cx: cx + (W / Math.sqrt(3)) * Math.cos(b * deg),
        cy: cy + (W / Math.sqrt(3)) * Math.sin(b * deg),
        n: 6,
        r: r6,
        phi0: 30 * deg,
      });
    }
  }
}

const fmt = (v: number) => {
  const t = Math.round(v * 10) / 10;
  return Object.is(t, -0) ? "0" : String(t);
};

/** Closed zigzag through the edge midpoints and the points where neighbouring rays meet. */
function hankin({ cx, cy, n, r, phi0 }: Poly): string {
  const a = Math.PI / n;
  const th = CONTACT * deg;
  const t = (r * Math.sin(a)) / Math.cos(th - a);
  const pts: string[] = [];
  for (let k = 0; k < n; k++) {
    const phi = phi0 + 2 * a * k;
    const c = Math.cos(phi);
    const sn = Math.sin(phi);
    // local frame: midpoint at (r, 0), edge runs along +y
    const lx = r - t * Math.sin(th);
    const ly = t * Math.cos(th);
    pts.push(`${fmt(cx + r * c)} ${fmt(cy + r * sn)}`);
    pts.push(`${fmt(cx + lx * c - ly * sn)} ${fmt(cy + lx * sn + ly * c)}`);
  }
  return `M${pts.join("L")}Z`;
}

// Every strand of a polygon lies within its inradius (+ stroke), so this keeps exactly what the tile shows.
const m = (p: Poly) => p.r + 4;
const visible = polys.filter(
  (p) => p.cx > -m(p) && p.cx < W + m(p) && p.cy > -m(p) && p.cy < H + m(p),
);

const d = visible.map(hankin).join("");
/** Small 12-point star at the heart of each rosette, like the inlaid centre of a Damascene star. */
function seal({ cx, cy }: Poly): string {
  const pts: string[] = [];
  for (let k = 0; k < 24; k++) {
    const rad = k % 2 ? s * 0.36 : s * 0.56;
    const phi = (k * Math.PI) / 12;
    pts.push(`${fmt(cx + rad * Math.cos(phi))} ${fmt(cy + rad * Math.sin(phi))}`);
  }
  return `M${pts.join("L")}Z`;
}
const rings = visible.filter((p) => p.n === 12).map(seal).join("");

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${fmt(H)}" preserveAspectRatio="none">` +
  `<g fill="none" stroke-linejoin="round">` +
  `<path d="${d}${rings}" stroke="${GOLD}" stroke-width="3.2"/>` +
  `<path d="${d}${rings}" stroke="${INK}" stroke-width="1.4"/>` +
  `</g></svg>\n`;

writeFileSync(OUT, svg);
console.log(`wrote ${OUT} (${svg.length} bytes, ${visible.length} polygons)`);
