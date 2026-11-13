import { HARAKAT_GLYPHS, type HarakaGlyphName } from "./harakatGlyphs";

/** Marks drawn under the letter; everything else sits above it. */
const BELOW = new Set<HarakaGlyphName>(["i", "in"]);

// Layout in a 100×120 box: dotted circle plus the mark above or below it, centred as a group.
const W = 100;
const H = 120;
const CX = W / 2;
const R = 17;
const GAP = 6;
const SCALE = 0.13; // glyph units (1000/em) → box units

/**
 * A haraka drawn the way Android's Arabic keyboard shows it: the mark over (or under) a dotted
 * circle standing in for the letter. Uses Amiri's own outlines (harakatGlyphs.ts), so it looks the
 * same everywhere and scales cleanly.
 */
export function HarakaGlyph({ name, className = "w-14 h-[4.25rem]" }: { name: HarakaGlyphName; className?: string }) {
  const { d, box } = HARAKAT_GLYPHS[name];
  const [x1, y1, x2, y2] = box;
  const below = BELOW.has(name);
  const markH = SCALE * (y2 - y1);
  const top = (H - (2 * R + GAP + markH)) / 2;
  const cy = below ? top + R : top + markH + GAP + R;
  const markTop = below ? cy + R + GAP : top;
  const tx = CX - SCALE * ((x1 + x2) / 2);
  const ty = markTop - SCALE * y1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} aria-hidden>
      <circle
        cx={CX}
        cy={cy}
        r={R}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.55}
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeDasharray="0 7.3"
      />
      <path d={d} fill="currentColor" transform={`translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${SCALE})`} />
    </svg>
  );
}
