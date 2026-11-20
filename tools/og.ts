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
/** عربيّات' accent: Tailwind sky-200, as on the game page. */
const SKY = "#bae6fd";
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

/** The game icons from src/components/icons.tsx (24×24 line drawings), as SVG markup. */
const HARAKA = `
  <path d="M20.5 9v4.5a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3V12"/>
  <circle cx="12" cy="20.5" r="0.9" fill="currentColor" stroke="none"/>
  <path d="M9.5 7 15 4.5"/>`;
const CITADEL = `
  <path d="M1.5 21h21"/>
  <path d="M2.8 14.5 3.2 4.8h7.6l.4 9.7"/>
  <path d="M4.4 4.8V3.4M7 4.8V3.4M9.6 4.8V3.4"/>
  <path d="M5.6 14.5v-3.3c0-1.2.6-2 1.4-2.6.8.6 1.4 1.4 1.4 2.6v3.3"/>
  <path d="M1.5 20.5c.5-2.2.9-4.2 1.3-6h8.4c.4 1.9.9 4.1 1.5 6.5"/>
  <path d="m11.4 15.3 5.9 2.5"/>
  <path d="M14.3 21v-4.4M16.2 21v-3.6"/>
  <path d="M17.3 21v-5.8h1.5v-2.4H22V21"/>
  <path d="M19.9 12.8v-1.4M21.4 12.8v-1.4"/>`;
const DALLAH = `
  <path d="M1.5 21h21"/>
  <path d="M7 21c-.6-2.6.3-5 2.2-6.3h3.6c1.9 1.3 2.8 3.7 2.2 6.3"/>
  <path d="M9.2 14.7 9.8 10h2.4l.6 4.7"/>
  <path d="M9.3 10h3.4"/>
  <path d="M10 10c0-1.4.4-2.6 1-3.4.6.8 1 2 1 3.4"/>
  <path d="M11 6.6V5.4"/>
  <path d="M11 3.6a.9.9 0 1 0 0 1.8.9.9 0 1 0 0-1.8"/>
  <path d="M8.4 16.3C6.1 15.7 4.5 13.2 3.5 9.7L2.3 8.9"/>
  <path d="M14.9 16.2c2.3-.8 3.4-2.5 3.2-4.5-.2-1.6-1.6-2.4-3.4-2.2l-2.4.9"/>
  <path d="M18.3 19h3.4l-.6 2h-2.2z"/>`;
const BARS = `
  <path d="M4 3v18"/>
  <path d="M4 6h15M4 10h12M4 14h8M4 18h5"/>`;

/** Draws one of the icons above at (x, y), `size` px square, with a stroke `stroke` px wide. */
const icon = (paths: string, x: number, y: number, size: number, color: string, stroke: number) => {
  const k = size / 24;
  return `<g transform="translate(${x} ${y}) scale(${k})" color="${color}" fill="none" stroke="${color}" stroke-width="${stroke / k}" stroke-linecap="round" stroke-linejoin="round">${paths}
  </g>`;
};

const IMAGES: Record<string, string> = {
  // The home page cards' icons: the three daily games and the data explorer.
  home: frame(`
  ${overline("MAHMOUD SHAAR")}
  <text x="80" y="285" font-family="${SERIF}" font-size="92" fill="${PAPER}">Things I make</text>
  <text x="80" y="395" font-family="${SERIF}" font-style="italic" font-size="92" fill="${GOLD}">after hours.</text>
  <text x="80" y="470" font-family="${MONO}" font-size="26" fill="${PAPER}" fill-opacity="0.6">Three Arabic word games · a World Bank data explorer</text>
  ${[
    { paths: HARAKA, name: "شَكِّل", color: GOLD },
    { paths: CITADEL, name: "حلبيّات", color: GOLD },
    { paths: DALLAH, name: "عربيّات", color: SKY },
    { paths: BARS, name: "Data", color: GOLD, latin: true },
  ]
    .map(
      (g, i) => `${icon(g.paths, 700 + i * 112, 226, 80, g.color, 2.4)}
  <text x="${740 + i * 112}" y="370" text-anchor="middle" font-family="${g.latin ? SERIF : "Amiri"}" ${g.latin ? 'font-style="italic" font-size="34"' : 'font-weight="700" font-size="34"'} fill="${g.color}">${g.name}</text>`,
    )
    .join("\n  ")}
  ${footer("mahmoudshaar.com", "Houston, TX · Software Engineer")}`),

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
  ${icon(CITADEL, 70, 140, 384, GOLD, 3.84)}
  <text x="1120" y="235" text-anchor="end" font-family="Amiri" font-weight="700" font-size="150" fill="${GOLD}">حلبيّات</text>
  <text x="1120" y="345" text-anchor="end" font-family="Amiri" font-size="44" fill="${PAPER}" fill-opacity="0.85">ثلاث جولات يومية من موسوعة حلب المقارنة</text>
  <text x="1120" y="450" text-anchor="end" font-family="Amiri" font-size="44" fill="${PAPER}">أصل كلمة · مثل حلبي · حزّورة</text>
  ${footer("mahmoudshaar.com/halab", "إلى روح أبي، أحمد أديب شعار")}`),

  // The dallah is DallahIcon (src/components/icons.tsx), drawn 16× larger, in عربيّات' sky accent.
  arabiyyat: frame(`
  ${icon(DALLAH, 70, 140, 384, SKY, 3.84)}
  <text x="1120" y="235" text-anchor="end" font-family="Amiri" font-weight="700" font-size="150" fill="${SKY}">عربيّات</text>
  <text x="1120" y="345" text-anchor="end" font-family="Amiri" font-size="44" fill="${PAPER}" fill-opacity="0.85">ثلاثة أسئلة يومية من أمثال العرب وكلامهم</text>
  <text x="1120" y="450" text-anchor="end" font-family="Amiri" font-size="44" fill="${PAPER}">مثل · معنى · كلمة أو حزّورة</text>
  ${footer("mahmoudshaar.com/arabiyyat", "من المحيط إلى الخليج")}`),
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
