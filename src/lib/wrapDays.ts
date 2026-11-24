/**
 * Wrap-around for the daily games. When a game's list of days runs out, day N replays day
 * ((N − 1) mod count) + 1 under its own number N, so the site never runs out of days and the
 * content files never change. The game pages look a day up by its number, so they need no change.
 *
 * Works on one entry per day (حلبيّات, عربيّات) or several (Shakkil's easy/medium/hard sentences).
 */
export function wrapDays<T extends { number: number }>(entries: T[], lastDay: number): T[] {
  const count = Math.max(0, ...entries.map((e) => e.number));
  if (count === 0 || lastDay <= count) return entries;
  const byDay = new Map<number, T[]>();
  for (const e of entries) byDay.set(e.number, [...(byDay.get(e.number) ?? []), e]);
  const out = [...entries];
  for (let n = count + 1; n <= lastDay; n++) {
    for (const e of byDay.get(sourceDay(n, count)) ?? []) out.push({ ...e, number: n });
  }
  return out;
}

/** The original day that day `n` replays when there are `count` days (n itself while n ≤ count). */
export function sourceDay(n: number, count: number): number {
  return ((n - 1) % count) + 1;
}
