/** Shapes and colours for the explorer's "over time" chart (TimeSeriesView.tsx). */

/** public/data/wdi/ts/<id>.json: one value per year from `from` to `to`, null where missing. */
export interface TimeSeries {
  from: number;
  to: number;
  series: Record<string, (number | null)[]>;
}

/** A country on the chart. `slot` is its colour, kept for as long as it stays on (colour follows the country). */
export interface ChartLine {
  code: string;
  slot: number;
}

/**
 * Categorical colours for the dark surface, in fixed order (validated: lightness band, chroma,
 * colour-blind and normal-vision separation, ≥ 3:1 on #0d0d0d). Eight at most, so never cycled.
 */
export const COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#0ca30c", "#9085e9", "#e66767"];
export const MAX_LINES = COLORS.length;
export const DEFAULT_LINES = 5;

/** The first free colour slot. */
export function nextSlot(lines: ChartLine[]): number {
  const used = new Set(lines.map((l) => l.slot));
  return COLORS.findIndex((_, i) => !used.has(i));
}
