import { useEffect, useRef, useState } from "react";
import type { Point } from "./verdict";

const INK = "rgba(232,228,220,";

function path(points: Point[], x: (y: number) => number, y: (v: number) => number) {
  return "M" + points.map(([yr, v]) => `${x(yr).toFixed(1)} ${y(v).toFixed(1)}`).join("L");
}

/** Value range with a little room, so the line never sits on the frame. */
function extent(points: Point[]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const [, v] of points) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.08;
  return [lo - pad, hi + pad];
}

/**
 * A measure's whole record in a row, about a thumb wide: every figure joined by a line (survey
 * years are joined across their gaps), with the two compared figures marked. Figures outside the
 * compared years are dimmed.
 */
export function Sparkline({ points, first, last }: { points: Point[]; first: Point | null; last: Point | null }) {
  const W = 112;
  const H = 30;
  if (points.length < 2) return <svg width={W} height={H} aria-hidden />;
  const [lo, hi] = extent(points);
  const y0 = points[0][0];
  const y1 = points[points.length - 1][0];
  const x = (yr: number) => 3 + ((yr - y0) / (y1 - y0 || 1)) * (W - 6);
  const y = (v: number) => H - 3 - ((v - lo) / (hi - lo)) * (H - 6);
  const compared = first && last ? points.filter(([yr]) => yr >= first[0] && yr <= last[0]) : [];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden className="shrink-0">
      <path d={path(points, x, y)} fill="none" stroke={`${INK}0.22)`} strokeWidth={1.5} strokeLinejoin="round" />
      {compared.length > 1 && (
        <path d={path(compared, x, y)} fill="none" stroke={`${INK}0.75)`} strokeWidth={1.5} strokeLinejoin="round" />
      )}
      {[first, last].map((p, i) => p && <circle key={i} cx={x(p[0])} cy={y(p[1])} r={2.5} fill="#c9a96e" />)}
    </svg>
  );
}

/**
 * The same record at reading size: touch or hover anywhere to read the figure for the nearest
 * year. Year ticks at both ends, value ticks at the range's ends; the compared figures in gold.
 */
export function TrendChart({
  points,
  first,
  last,
  format,
  label,
}: {
  points: Point[];
  first: Point | null;
  last: Point | null;
  format: (v: number) => string;
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(0);
  const [at, setAt] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 190;
  const L = 8;
  const R = 8;
  const T = 12;
  const B = 22;
  const [lo, hi] = extent(points);
  const y0 = points[0][0];
  const y1 = points[points.length - 1][0];
  const x = (yr: number) => L + ((yr - y0) / (y1 - y0 || 1)) * (W - L - R);
  const y = (v: number) => H - B - ((v - lo) / (hi - lo)) * (H - T - B);
  const compared = first && last ? points.filter(([yr]) => yr >= first[0] && yr <= last[0]) : [];
  const shown = at !== null ? points[at] : (last ?? points[points.length - 1]);

  const onMove = (e: React.PointerEvent) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    let best = 0;
    points.forEach(([yr], i) => {
      if (Math.abs(x(yr) - px) < Math.abs(x(points[best][0]) - px)) best = i;
    });
    setAt(best);
  };

  return (
    <div ref={box}>
      <p className="text-xs text-paper/50 mb-2 tabular-nums" aria-live="polite">
        {shown && (
          <>
            <span className="text-gold">{shown[0]}</span> · <span className="text-paper">{format(shown[1])}</span>
            {at === null && <span className="text-paper/30"> · touch the chart to read any year</span>}
          </>
        )}
      </p>
      {W > 0 && (
        <svg
          width={W}
          height={H}
          role="img"
          aria-label={`${label}, ${y0} to ${y1}. The figures are listed in the table below.`}
          className="touch-pan-y select-none"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setAt(null)}
        >
          {[hi, lo].map((v, i) => (
            <g key={i}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={`${INK}0.07)`} />
              <text x={L} y={y(v) + (i ? -4 : 12)} fontSize={10} fill={`${INK}0.35)`}>
                {format(v)}
              </text>
            </g>
          ))}
          <text x={L} y={H - 6} fontSize={10} fill={`${INK}0.4)`}>
            {y0}
          </text>
          <text x={W - R} y={H - 6} fontSize={10} fill={`${INK}0.4)`} textAnchor="end">
            {y1}
          </text>
          <path d={path(points, x, y)} fill="none" stroke={`${INK}0.25)`} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {compared.length > 1 && (
            <path d={path(compared, x, y)} fill="none" stroke={`${INK}0.85)`} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          )}
          {[first, last].map(
            (p, i) => p && <circle key={i} cx={x(p[0])} cy={y(p[1])} r={4.5} fill="#c9a96e" stroke="#0d0d0d" strokeWidth={2} />,
          )}
          {at !== null && (
            <g>
              <line x1={x(points[at][0])} x2={x(points[at][0])} y1={T} y2={H - B} stroke="rgba(201,169,110,0.5)" />
              <circle cx={x(points[at][0])} cy={y(points[at][1])} r={5} fill="#e8e4dc" stroke="#0d0d0d" strokeWidth={2} />
            </g>
          )}
        </svg>
      )}
    </div>
  );
}
