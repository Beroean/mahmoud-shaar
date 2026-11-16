/**
 * حلبيّات day numbers. Same clock as Shakkil: a new day at midnight Mecca time (UTC+3).
 * Day 1 is LAUNCH_DATE. Past days (and, in dev, any day) can be replayed with ?day=N.
 */
import { dayIndex } from "../../shakkil/core/daily";

export const LAUNCH_DATE: string | null = "2026-11-16";
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

/**
 * A preview day from ?day=N, allowed before launch and in dev (`dev` = import.meta.env.DEV). After launch only past days and
 * today can be opened this way, so the URL can't spoil tomorrow.
 */
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
