/**
 * عربيّات day numbers. Same clock as Shakkil and حلبيّات: a new day at midnight Mecca time (UTC+3).
 * Until LAUNCH_DATE is set every visit is a preview: day 1, or any day with ?day=N, never saved.
 */
import { dayIndex } from "../../shakkil/core/daily";

export const LAUNCH_DATE: string | null = null;
const DAY_MS = 86_400_000;
const OFFSET_MS = 3 * 3_600_000;

const LAUNCH_DAY = LAUNCH_DATE ? Math.floor(Date.parse(`${LAUNCH_DATE}T00:00:00Z`) / DAY_MS) : null;

export function isLaunched(now: Date | number = Date.now()): boolean {
  return LAUNCH_DAY !== null && dayIndex(now) >= LAUNCH_DAY;
}

/** Today's 1-based day number (1 before launch). */
export function todayNumber(now: Date | number = Date.now()): number {
  return LAUNCH_DAY === null ? 1 : Math.max(1, dayIndex(now) - LAUNCH_DAY + 1);
}

/** A preview day from ?day=N: any day before launch and in dev, only past days and today after launch. */
export function previewNumber(search: string, count: number, dev = false, now: Date | number = Date.now()): number | null {
  const n = Number(new URLSearchParams(search).get("day"));
  if (!Number.isInteger(n) || n < 1 || n > count) return null;
  if (isLaunched(now) && !dev && n > todayNumber(now)) return null;
  return n;
}

export function msUntilNext(now: Date | number = Date.now()): number {
  const t = typeof now === "number" ? now : now.getTime();
  return (dayIndex(t) + 1) * DAY_MS - OFFSET_MS - t;
}
