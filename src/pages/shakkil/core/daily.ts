/**
 * Daily schedule. Puzzle #1 is published on LAUNCH_DATE and a new one every day after, rolling
 * over at midnight Mecca time (UTC+3, no DST) so the whole Arab world shares a day.
 */
export const LAUNCH_DATE = "2026-11-13";
export const UTC_OFFSET_HOURS = 3;
const DAY_MS = 86_400_000;
const OFFSET_MS = UTC_OFFSET_HOURS * 3_600_000;

const ms = (now: Date | number) => (typeof now === "number" ? now : now.getTime());

/** Days since 1970-01-01 in the game's timezone. */
export function dayIndex(now: Date | number = Date.now()): number {
  return Math.floor((ms(now) + OFFSET_MS) / DAY_MS);
}

export const LAUNCH_DAY = Math.floor(Date.parse(`${LAUNCH_DATE}T00:00:00Z`) / DAY_MS);

/** True once puzzle #1 is live (midnight Mecca time on LAUNCH_DATE). */
export function isLaunched(now: Date | number = Date.now()): boolean {
  return dayIndex(now) >= LAUNCH_DAY;
}

/** Milliseconds until launch (0 once launched). */
export function msUntilLaunch(now: Date | number = Date.now()): number {
  return Math.max(0, LAUNCH_DAY * DAY_MS - OFFSET_MS - ms(now));
}

/** 1-based puzzle number for a moment in time. Before launch this is 1 (preview). */
export function puzzleNumber(now: Date | number = Date.now()): number {
  return Math.max(1, dayIndex(now) - LAUNCH_DAY + 1);
}

/**
 * Which puzzle (0-based index) to serve for a number. If the schedule runs out it wraps around
 * rather than breaking; the data test fails CI well before that happens.
 */
export function scheduledIndex(number: number, count: number): number {
  return (number - 1) % count;
}

/** Milliseconds until the next puzzle. */
export function msUntilNext(now: Date | number = Date.now()): number {
  return (dayIndex(now) + 1) * DAY_MS - OFFSET_MS - ms(now);
}
