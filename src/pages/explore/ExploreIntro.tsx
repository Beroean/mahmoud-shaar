import { useEffect } from "react";
import "./exploreIntro.css";
import { INTRO_FROM, INTRO_SERIES } from "./introData";
import { COLORS } from "./timeSeries";

/**
 * Opening scene, about 3.9 s (timings in exploreIntro.css):
 * 1. a chart frame fades in: "Life expectancy at birth", gridlines every 20 years of age;
 * 2. a gold cursor sweeps from 1960 to 2024, the year counting up as it goes, and five countries'
 *    lines are revealed behind it (China's famine in 1960–61, Ethiopia's in 1984, Korea's climb);
 * 3. each line gets its name at its end;
 * 4. the chart lifts away and the page shows through.
 * Real WDI values (introData.ts), drawn once as SVG; the sweep is a clip that grows left to right.
 * Plays once per browser session; skipped for reduced motion; ?intro=1 forces it (introOnce.ts).
 */

const DURATION_MS = 3900;

// Plot box in a 800 × 440 viewBox; the right margin holds the country names.
const W = 800;
const H = 440;
const X0 = 60;
const X1 = 630;
const Y0 = 50;
const Y1 = 400;
const MIN = 30;
const MAX = 90;
const YEARS = INTRO_SERIES[0].values.length;

const x = (i: number) => X0 + (i / (YEARS - 1)) * (X1 - X0);
const y = (v: number) => Y1 - ((v - MIN) / (MAX - MIN)) * (Y1 - Y0);
const f = (n: number) => Math.round(n * 10) / 10;

/** Vertical room each name needs (fits the phone size in exploreIntro.css). */
const LABEL_GAP = 32;

const LINES = INTRO_SERIES.map((s, slot) => ({
  name: s.name,
  color: COLORS[slot],
  d: "M" + s.values.map((v, i) => `${f(x(i))} ${f(y(v))}`).join("L"),
  end: y(s.values[s.values.length - 1]),
  labelY: 0,
}));

// Names sit at their line's end, pushed down just enough not to overlap the one above.
let floor = -Infinity;
for (const l of [...LINES].sort((a, b) => a.end - b.end)) {
  l.labelY = Math.max(l.end, floor + LABEL_GAP);
  floor = l.labelY;
}

export function ExploreIntro({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, DURATION_MS);
    const onKey = () => onDone();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [onDone]);

  return (
    <div className="ei-overlay" onClick={onDone} role="presentation">
      <div className="ei-stage">
        <div className="ei-head">
          <p className="ei-title font-serif">Life expectancy at birth</p>
          <p className="ei-sub">
            Years · <span className="ei-year" aria-hidden /> · World Bank
          </p>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="ei-chart" aria-hidden>
          <defs>
            <clipPath id="ei-sweep">
              <rect className="ei-clip" x={X0 - 4} y={0} width={X1 - X0 + 8} height={H} />
            </clipPath>
          </defs>

          <g className="ei-frame">
            {[30, 50, 70, 90].map((v) => (
              <g key={v}>
                <line x1={X0} x2={X1} y1={y(v)} y2={y(v)} stroke="rgb(232 228 220 / 0.08)" strokeWidth={1} />
                <text className="ei-axis" x={X0 - 12} y={y(v)} dy="0.35em" textAnchor="end">
                  {v}
                </text>
              </g>
            ))}
            {[1960, 1980, 2000, 2020].map((year) => (
              <text key={year} className="ei-axis" x={x(year - INTRO_FROM)} y={Y1 + 28} textAnchor="middle">
                {year}
              </text>
            ))}
          </g>

          <g clipPath="url(#ei-sweep)">
            {LINES.map((l) => (
              <path
                key={l.name}
                d={l.d}
                fill="none"
                stroke={l.color}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
          </g>

          {/* The sweep's leading edge: a hairline the lines are drawn behind. */}
          <line
            className="ei-cursor"
            style={{ ["--ei-travel" as string]: `${X1 - X0}px` }}
            x1={X0} x2={X0} y1={Y0 - 16} y2={Y1} stroke="#c9a96e" strokeWidth={1.5} />

          {LINES.map((l, i) => (
            <g key={l.name} className="ei-label" style={{ animationDelay: `${2.45 + i * 0.07}s` }}>
              <circle cx={X1} cy={l.end} r={5} fill={l.color} stroke="#0a0a0a" strokeWidth={2} />
              <text x={X1 + 14} y={l.labelY} dy="0.35em">
                {l.name}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <span className="ei-skip">Click to skip</span>
    </div>
  );
}
