import type { Chart, ChartType, Plugin } from "chart.js";

/**
 * Chart.js plugin for the "over time" chart: a dot and a name for each line in a gutter on the
 * right, level with the line's last value, joined to that point by a faint connector (a line can
 * end years before the chart does). The gutter is reserved with layout.padding.right.
 */
export interface EndLabelOptions {
  /** One label per dataset, by index. */
  labels: string[];
  font: string;
  color: string;
}

declare module "chart.js" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface PluginOptionsByType<TType extends ChartType> {
    endLabels?: EndLabelOptions;
  }
}

const GAP = 15; // px between label centres
const PAD = 10; // px from the plot to the dot
const TEXT_AT = PAD + 10; // px from the plot to the text

/**
 * Label positions for the wanted y's, at least `gap` apart and inside [top, bottom], each moved as
 * little as the others allow. Keeps the input order.
 */
export function dodge(wanted: number[], gap: number, top: number, bottom: number): number[] {
  const order = wanted.map((y, i) => [y, i]).sort((a, b) => a[0] - b[0]);
  const pos = order.map(([y]) => y);
  for (let i = 0; i < pos.length; i++) pos[i] = Math.max(pos[i], top, i ? pos[i - 1] + gap : -Infinity);
  for (let i = pos.length - 1; i >= 0; i--) pos[i] = Math.min(pos[i], bottom, i < pos.length - 1 ? pos[i + 1] - gap : Infinity);
  const out = new Array<number>(wanted.length);
  order.forEach(([, i], k) => (out[i] = pos[k]));
  return out;
}

/** Width the gutter needs for these labels in this font, capped at `max`. */
export function gutterWidth(labels: string[], font: string, max: number): number {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return max;
  ctx.font = font;
  const widest = Math.max(0, ...labels.map((l) => ctx.measureText(l).width));
  return Math.min(Math.ceil(widest) + TEXT_AT + 4, max);
}

/** `text`, cut with an ellipsis to fit `width`. */
function fit(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + "…").width > width) s = s.slice(0, -1);
  return s.trimEnd() + "…";
}

export const endLabels: Plugin<"line"> = {
  id: "endLabels",
  afterDatasetsDraw(chart: Chart<"line">) {
    const opts = (chart.options.plugins as { endLabels?: EndLabelOptions }).endLabels;
    if (!opts) return;
    const { ctx, chartArea } = chart;
    const ends: { x: number; y: number; color: string; label: string }[] = [];
    chart.data.datasets.forEach((ds, i) => {
      if (!chart.isDatasetVisible(i)) return;
      let last = ds.data.length - 1;
      while (last >= 0 && ds.data[last] === null) last--;
      const pt = chart.getDatasetMeta(i).data[last];
      if (!pt || !Number.isFinite(pt.y)) return;
      ends.push({ x: pt.x, y: pt.y, color: String(ds.borderColor), label: opts.labels[i] ?? "" });
    });
    if (!ends.length) return;

    const ys = dodge(
      ends.map((e) => e.y),
      GAP,
      chartArea.top + GAP / 2,
      chartArea.bottom - GAP / 2,
    );
    const x0 = chartArea.right + PAD;
    const room = chart.width - (chartArea.right + TEXT_AT) - 2;
    ctx.save();
    ctx.font = opts.font;
    ctx.textBaseline = "middle";
    ends.forEach((e, i) => {
      const y = ys[i];
      // Dashed and faint, so a connector from a line that ends early doesn't read as data.
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(e.x + 3, e.y);
      ctx.lineTo(x0 - 4, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(x0, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = opts.color;
      ctx.fillText(fit(ctx, e.label, room), chartArea.right + TEXT_AT, y);
    });
    ctx.restore();
  },
};
