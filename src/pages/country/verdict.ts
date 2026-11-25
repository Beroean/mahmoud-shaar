/**
 * Reads one measure's figures for one country as better, worse or little changed: the latest
 * figure against the first one in the chosen years, nothing else. No trend fitting, smoothing,
 * gap filling or weighting, so anyone can redo it from the two figures shown on the page.
 */
import type { Measure } from "./basket";

/** One figure: [year, value]. A series is these in year order, missing years left out. */
export type Point = [year: number, value: number];

/**
 * The years compared, chosen by the reader. A measure's first figure is its earliest in or after
 * `from`, its latest the last in or before `to`; an open end means the record's own end.
 */
export interface Range {
  from?: number;
  to?: number;
}

export type Verdict =
  /** The latest figure is on the better side of the first by more than the little-change rule. */
  | "better"
  | "worse"
  /** The two figures differ by less than the measure's little-change rule. */
  | "flat"
  /** A context measure: the change is shown but not read. */
  | "context"
  /** No reading: no figures, one figure, or first and latest too close together (MIN_SPAN). */
  | "short"
  /** No reading: the latest figure is too old (STALE_AFTER) to say how things stand now. */
  | "stale";

/** First and latest figure must be at least this many years apart. */
export const MIN_SPAN = 5;
/**
 * A latest figure this many years older than the end of the range (or than the dataset's newest
 * year, if that comes first) is too old to read.
 */
export const STALE_AFTER = 10;

export interface Change {
  verdict: Verdict;
  first: Point | null;
  last: Point | null;
  /** last − first, in the measure's unit; and as a percentage of the first figure (null from 0). */
  diff: number | null;
  percent: number | null;
}

/**
 * @param newest the newest year the World Bank has for this measure in any country, so "too old"
 *   is judged against what the dataset holds, not against today's date.
 */
export function readChange(m: Measure, points: Point[], range: Range, newest: number): Change {
  const inRange = points.filter(([y]) => y >= (range.from ?? -Infinity) && y <= (range.to ?? Infinity));
  if (!inRange.length) return { verdict: "short", first: null, last: null, diff: null, percent: null };
  const first = inRange[0];
  const last = inRange[inRange.length - 1];

  const diff = last[1] - first[1];
  const percent = first[1] !== 0 ? (diff / Math.abs(first[1])) * 100 : null;
  const change = { first, last, diff, percent };
  if (last[0] - first[0] < MIN_SPAN) return { verdict: "short", ...change };
  if (Math.min(newest, range.to ?? Infinity) - last[0] > STALE_AFTER) return { verdict: "stale", ...change };
  if (m.reading === "context") return { verdict: "context", ...change };

  const small =
    "points" in m.flat ? Math.abs(diff) < m.flat.points : percent !== null && Math.abs(percent) < m.flat.percent;
  if (small || diff === 0) return { verdict: "flat", ...change };
  const up = diff > 0;
  return { verdict: up === (m.reading === "higher") ? "better" : "worse", ...change };
}

/** The little-change rule in words. */
export function flatRuleText(m: Measure): string {
  if ("percent" in m.flat) return `less than ${m.flat.percent}% of the first figure`;
  const unit = m.suffix === "%" ? "percentage point" : m.suffix === " yrs" ? "year" : "point";
  return `less than ${m.flat.points} ${unit}${m.flat.points === 1 ? "" : "s"}`;
}

export type Tally = Record<Exclude<Verdict, "context">, number>;

export function tally(verdicts: Verdict[]): Tally {
  const t: Tally = { better: 0, worse: 0, flat: 0, short: 0, stale: 0 };
  for (const v of verdicts) if (v !== "context") t[v]++;
  return t;
}
