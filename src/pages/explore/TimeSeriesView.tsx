import { useEffect, useMemo, useRef, useState } from "react";
import { Chart as ChartJS, LineElement, PointElement, type ChartOptions } from "chart.js";
import { Line } from "react-chartjs-2";
import { COLORS, type ChartLine, MAX_LINES, type TimeSeries } from "./timeSeries";
import { endLabels, gutterWidth } from "./endLabels";

ChartJS.register(LineElement, PointElement);

const MONO = "'IBM Plex Mono', monospace";
const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 });
const LABEL_FONT = `11px ${MONO}`;
/** Below this chart width the end labels are country codes, not names. */
const NARROW = 560;
const PLUGINS = [endLabels];

/** Width of the element, kept current. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function TimeSeriesView({
  ts,
  lines,
  names,
  choices,
  onAdd,
  onRemove,
}: {
  ts: TimeSeries;
  lines: ChartLine[];
  names: Map<string, string>;
  /** Codes that can be added (have data, pass the countries filter), not already on the chart. */
  choices: string[];
  onAdd: (code: string) => void;
  onRemove: (code: string) => void;
}) {
  // Only the years where at least one chosen country has a value.
  const [lo, hi] = useMemo(() => {
    let a = Infinity;
    let b = -Infinity;
    for (const { code } of lines) {
      ts.series[code]?.forEach((v, i) => {
        if (v === null) return;
        a = Math.min(a, i);
        b = Math.max(b, i);
      });
    }
    return a <= b ? [a, b] : [0, ts.to - ts.from];
  }, [ts, lines]);

  const data = useMemo(
    () => ({
      labels: Array.from({ length: hi - lo + 1 }, (_, i) => String(ts.from + lo + i)),
      datasets: lines.map(({ code, slot }) => ({
        label: names.get(code) ?? code,
        data: (ts.series[code] ?? []).slice(lo, hi + 1),
        borderColor: COLORS[slot],
        backgroundColor: COLORS[slot],
        borderWidth: 2,
        borderCapStyle: "round" as const,
        borderJoinStyle: "round" as const,
        // Survey-based indicators only have some years; join across the gaps.
        spanGaps: true,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBorderWidth: 2,
        pointHoverBorderColor: "#0d0d0d",
        tension: 0,
      })),
    }),
    [ts, lines, names, lo, hi],
  );

  // Names at the end of each line; codes on a narrow chart, where names would squeeze the plot.
  const [boxRef, width] = useWidth();
  const narrow = width > 0 && width < NARROW;
  const labels = useMemo(
    () => lines.map(({ code }) => (narrow ? code : (names.get(code) ?? code))),
    [lines, names, narrow],
  );
  const gutter = useMemo(() => gutterWidth(labels, LABEL_FONT, narrow ? 64 : 170), [labels, narrow]);

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: { mode: "index", intersect: false },
      layout: { padding: { right: gutter } },
      plugins: {
        // The labels at the line ends and the country chips above the chart are the legend.
        legend: { display: false },
        endLabels: { labels, font: LABEL_FONT, color: "rgba(232,228,220,0.8)" },
        tooltip: {
          backgroundColor: "#111",
          borderColor: "rgba(201,169,110,0.3)",
          borderWidth: 1,
          titleColor: "#c9a96e",
          bodyColor: "#e8e4dc",
          titleFont: { family: MONO, size: 11 },
          bodyFont: { family: MONO, size: 12 },
          padding: 12,
          boxWidth: 10,
          boxHeight: 2,
          itemSort: (a, b) => (b.raw as number) - (a.raw as number),
          filter: (item) => item.raw !== null,
          callbacks: { label: (item) => ` ${item.dataset.label}: ${fmt(item.raw as number)}` },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "rgba(232,228,220,0.4)", font: { family: MONO, size: 10 }, maxRotation: 0, autoSkipPadding: 16 },
          border: { color: "rgba(232,228,220,0.1)" },
        },
        y: {
          grid: { color: "rgba(232,228,220,0.06)" },
          ticks: {
            color: "rgba(232,228,220,0.4)",
            font: { family: MONO, size: 10 },
            callback: (v) => Number(v).toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 2 }),
          },
          border: { color: "rgba(232,228,220,0.1)" },
        },
      },
    }),
    [labels, gutter],
  );

  const sortedChoices = useMemo(
    () => [...choices].sort((a, b) => (names.get(a) ?? a).localeCompare(names.get(b) ?? b)),
    [choices, names],
  );

  return (
    <div ref={boxRef}>
      <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
        {lines.map(({ code, slot }) => (
          <span key={code} className="inline-flex items-center gap-2 border border-paper/15 pl-3 pr-1 py-1 text-xs text-paper/80">
            <span className="inline-block w-3 h-[3px] rounded-full" style={{ background: COLORS[slot] }} aria-hidden />
            {names.get(code) ?? code}
            <button
              type="button"
              onClick={() => onRemove(code)}
              aria-label={`Remove ${names.get(code) ?? code}`}
              className="px-1.5 text-paper/40 hover:text-paper"
            >
              ×
            </button>
          </span>
        ))}
        <select
          value=""
          disabled={lines.length >= MAX_LINES || !choices.length}
          onChange={(e) => e.target.value && onAdd(e.target.value)}
          aria-label="Add a country"
          className="bg-ink-1 border border-paper/15 px-3 py-1.5 text-xs text-paper/60 hover:border-gold/50 disabled:opacity-40 max-w-[12rem]"
        >
          <option value="">{lines.length >= MAX_LINES ? `Up to ${MAX_LINES} lines` : "+ Add country"}</option>
          {sortedChoices.map((code) => (
            <option key={code} value={code}>
              {names.get(code) ?? code}
            </option>
          ))}
        </select>
      </div>

      {lines.length ? (
        <div className="border border-paper/10 bg-ink-1 p-4 sm:p-6 h-[420px] sm:h-[480px]">
          <Line data={data} options={options} plugins={PLUGINS} />
        </div>
      ) : (
        <div className="border border-paper/10 bg-ink-1 px-6 py-16 text-xs text-paper/30">Add a country to draw its line.</div>
      )}
    </div>
  );
}
