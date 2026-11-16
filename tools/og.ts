/**
 * Renders the 1200×630 link-preview (Open Graph) images into public/og/.
 *
 *   npm run og
 *
 * Uses resvg (HarfBuzz shaping, so Arabic joins correctly) with the site's own fonts from
 * @fontsource. Those ship as WOFF, which resvg can't read, so they're unpacked to plain
 * TrueType in memory first. The PNGs are committed; rerun this only when the designs change.
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { inflateSync } from "node:zlib";
import { Resvg } from "@resvg/resvg-js";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = resolve(ROOT, "public/og");
const font = (pkg: string, file: string) => resolve(ROOT, "node_modules/@fontsource", pkg, "files", file);

/** WOFF 1.0 → sfnt (TTF/OTF): inflate each table and rebuild the table directory. */
export function woffToSfnt(woff: Buffer): Buffer {
  if (woff.toString("ascii", 0, 4) !== "wOFF") throw new Error("not a WOFF file");
  const flavor = woff.readUInt32BE(4);
  const numTables = woff.readUInt16BE(12);
  const tables = Array.from({ length: numTables }, (_, i) => {
    const d = 44 + i * 20;
    const [tag, offset, compLength, origLength, checksum] = [
      woff.subarray(d, d + 4),
      woff.readUInt32BE(d + 4),
      woff.readUInt32BE(d + 8),
      woff.readUInt32BE(d + 12),
      woff.readUInt32BE(d + 16),
    ];
    const raw = woff.subarray(offset, offset + compLength);
    return { tag, checksum, data: compLength < origLength ? inflateSync(raw) : raw };
  });
  const entrySelector = Math.floor(Math.log2(numTables));
  const searchRange = 2 ** entrySelector * 16;
  const header = Buffer.alloc(12 + 16 * numTables);
  header.writeUInt32BE(flavor, 0);
  header.writeUInt16BE(numTables, 4);
  header.writeUInt16BE(searchRange, 6);
  header.writeUInt16BE(entrySelector, 8);
  header.writeUInt16BE(numTables * 16 - searchRange, 10);
  const chunks: Buffer[] = [header];
  let offset = header.length;
  tables.forEach((t, i) => {
    const d = 12 + i * 16;
    t.tag.copy(header, d);
    header.writeUInt32BE(t.checksum, d + 4);
    header.writeUInt32BE(offset, d + 8);
    header.writeUInt32BE(t.data.length, d + 12);
    const padded = Buffer.alloc((t.data.length + 3) & ~3);
    t.data.copy(padded);
    chunks.push(padded);
    offset += padded.length;
  });
  return Buffer.concat(chunks);
}

const FONTS = [
  font("amiri", "amiri-arabic-400-normal.woff"),
  font("amiri", "amiri-arabic-700-normal.woff"),
  font("dm-serif-display", "dm-serif-display-latin-400-normal.woff"),
  font("dm-serif-display", "dm-serif-display-latin-400-italic.woff"),
  font("ibm-plex-mono", "ibm-plex-mono-latin-400-normal.woff"),
];

/** resvg-js only loads fonts from files, so write the unpacked TTFs to a temp folder. */
function fontFiles(): string[] {
  const dir = mkdtempSync(join(tmpdir(), "og-fonts-"));
  return FONTS.map((p) => {
    const out = join(dir, basename(p).replace(/\.woff$/, ".ttf"));
    writeFileSync(out, woffToSfnt(readFileSync(p)));
    return out;
  });
}

const INK = "#0a0a0a";
const PAPER = "#e8e4dc";
const GOLD = "#c9a96e";
const MONO = "IBM Plex Mono";
const SERIF = "DM Serif Display";

function frame(body: string): string {
  const grid = Array.from({ length: 16 }, (_, i) => i * 80)
    .map((x) => `<line x1="${x}" y1="0" x2="${x}" y2="630"/><line x1="0" y1="${x}" x2="1200" y2="${x}"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${INK}"/>
  <g stroke="${PAPER}" stroke-opacity="0.04" stroke-width="1">${grid}</g>
  ${body}
  <line x1="80" y1="560" x2="1120" y2="560" stroke="${PAPER}" stroke-opacity="0.12"/>
</svg>`;
}

const overline = (text: string) =>
  `<line x1="80" y1="140" x2="140" y2="140" stroke="${GOLD}" stroke-width="2"/>
  <text x="160" y="146" font-family="${MONO}" font-size="20" letter-spacing="6" fill="${GOLD}">${text}</text>`;

const footer = (left: string, right: string) =>
  `<text x="80" y="600" font-family="${MONO}" font-size="20" fill="${PAPER}" fill-opacity="0.45">${left}</text>
  <text x="1120" y="600" text-anchor="end" font-family="${MONO}" font-size="20" fill="${PAPER}" fill-opacity="0.45">${right}</text>`;

const IMAGES: Record<string, string> = {
  home: frame(`
  ${overline("HOUSTON, TX · SOFTWARE ENGINEER")}
  <text x="80" y="300" font-family="${SERIF}" font-size="112" fill="${PAPER}">Mahmoud Shaar</text>
  <text x="80" y="400" font-family="${SERIF}" font-style="italic" font-size="64" fill="${GOLD}">personal corner of the internet</text>
  ${footer("mahmoudshaar.com", "experiments · data · games")}`),

  explore: frame(`
  ${overline("DATA EXPLORER")}
  <text x="80" y="290" font-family="${SERIF}" font-size="100" fill="${PAPER}">World Development</text>
  <text x="80" y="400" font-family="${SERIF}" font-style="italic" font-size="100" fill="${GOLD}">Indicators</text>
  <text x="80" y="480" font-family="${MONO}" font-size="26" fill="${PAPER}" fill-opacity="0.6">1,400+ World Bank indicators · every country ranked</text>
  ${footer("mahmoudshaar.com/explore", "World Bank WDI")}`),

  // The sample line must never be a real puzzle (it would spoil it); it is reserved in
  // content/shakkil/rejected.yaml.
  shakkil: frame(`
  <text x="1120" y="215" text-anchor="end" font-family="Amiri" font-weight="700" font-size="160" fill="${GOLD}">شَكِّل</text>
  <text x="1120" y="372" text-anchor="end" font-family="Amiri" font-size="48" fill="${PAPER}" fill-opacity="0.85">لعبة التشكيل اليومية</text>
  <text x="1120" y="485" text-anchor="end" font-family="Amiri" font-size="64" fill="${PAPER}">«شَكِّلْ تَفُزْ»</text>
  <g>
    <rect x="80" y="430" width="56" height="56" rx="6" fill="#10b981" fill-opacity="0.85"/>
    <rect x="148" y="430" width="56" height="56" rx="6" fill="#f59e0b" fill-opacity="0.85"/>
    <rect x="216" y="430" width="56" height="56" rx="6" fill="#10b981" fill-opacity="0.85"/>
    <rect x="284" y="430" width="56" height="56" rx="6" fill="#f43f5e" fill-opacity="0.85"/>
  </g>
  ${footer("mahmoudshaar.com/shakkil", "جملة جديدة كل يوم، وست محاولات")}`),

  // The citadel is CitadelIcon (src/components/icons.tsx), drawn 16× larger.
  halab: frame(`
  <g transform="translate(70 140) scale(16)" fill="none" stroke="${GOLD}" stroke-width="0.24" stroke-linecap="round" stroke-linejoin="round">
    <path d="M1.5 21h21"/>
    <path d="M2.8 14.5 3.2 4.8h7.6l.4 9.7"/>
    <path d="M4.4 4.8V3.4M7 4.8V3.4M9.6 4.8V3.4"/>
    <path d="M5.6 14.5v-3.3c0-1.2.6-2 1.4-2.6.8.6 1.4 1.4 1.4 2.6v3.3"/>
    <path d="M1.5 20.5c.5-2.2.9-4.2 1.3-6h8.4c.4 1.9.9 4.1 1.5 6.5"/>
    <path d="m11.4 15.3 5.9 2.5"/>
    <path d="M14.3 21v-4.4M16.2 21v-3.6"/>
    <path d="M17.3 21v-5.8h1.5v-2.4H22V21"/>
    <path d="M19.9 12.8v-1.4M21.4 12.8v-1.4"/>
  </g>
  <text x="1120" y="235" text-anchor="end" font-family="Amiri" font-weight="700" font-size="150" fill="${GOLD}">حلبيّات</text>
  <text x="1120" y="345" text-anchor="end" font-family="Amiri" font-size="44" fill="${PAPER}" fill-opacity="0.85">ثلاث جولات يومية من موسوعة حلب المقارنة</text>
  <text x="1120" y="450" text-anchor="end" font-family="Amiri" font-size="44" fill="${PAPER}">أصل كلمة · مثل حلبي · حزّورة</text>
  ${footer("mahmoudshaar.com/halab", "إلى روح أبي، أحمد أديب شعار")}`),
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = fontFiles();
  mkdirSync(OUT, { recursive: true });
  for (const [name, svg] of Object.entries(IMAGES)) {
    const png = new Resvg(svg, {
      fitTo: { mode: "width", value: 1200 },
      font: { fontFiles: files, loadSystemFonts: false, defaultFontFamily: MONO },
    })
      .render()
      .asPng();
    writeFileSync(resolve(OUT, `${name}.png`), png);
    console.log(`public/og/${name}.png  ${(png.length / 1024).toFixed(0)} KB`);
  }
}
