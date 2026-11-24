/**
 * How the daily games ship their days without every visit downloading all of them.
 *
 * A build splits a game's days (splitDays) into `recent` (today and tomorrow, inlined in the small
 * module every visit loads) and `blocks` of BLOCK_DAYS original days each, which are separate chunks
 * fetched only when a past day is opened. A full block never changes, so browsers keep it cached
 * across the nightly rebuilds; only the newest block changes as days are added.
 *
 * Days past the end of the content wrap around (src/lib/wrapDays.ts): blocks hold each original day
 * once, and dayStore() renumbers the original for a repeated day, so the archive stops growing once
 * every original day is out.
 */
import { sourceDay, wrapDays } from "./wrapDays";

export const BLOCK_DAYS = 30;

/** What a build ships for one game, besides the blocks' own chunks. */
export interface DayIndex<T> {
  /** Today's and tomorrow's entries, under their own (possibly wrapped) day numbers. */
  recent: T[];
  /** Number of original days in the content. */
  count: number;
  /** The last day this build can serve (tomorrow; in dev, every day). */
  last: number;
  blockDays: number;
}

export interface DaySplit<T> extends DayIndex<T> {
  /** blocks[k] = original days k·blockDays+1 … (k+1)·blockDays, never past `last`. */
  blocks: T[][];
}

/**
 * Build side. `lastDay` is tomorrow's number; nothing after it ships, so future answers aren't
 * readable from the site. The dev server (`dev`) also ships the future days, so ?day=N can preview
 * any of them. Works on one entry per day or several (Shakkil's easy/medium/hard).
 */
export function splitDays<T extends { number: number }>(
  entries: T[],
  lastDay: number,
  dev = false,
  blockDays = BLOCK_DAYS,
): DaySplit<T> {
  const count = Math.max(0, ...entries.map((e) => e.number));
  const last = dev ? Math.max(count, lastDay) : lastDay;
  const blocks: T[][] = Array.from({ length: Math.ceil(Math.min(count, last) / blockDays) }, () => []);
  for (const e of entries) if (e.number >= 1 && e.number <= last) blocks[Math.floor((e.number - 1) / blockDays)].push(e);
  const recent = wrapDays(entries, lastDay).filter((e) => e.number >= lastDay - 1 && e.number <= lastDay);
  return { recent, count, last, blockDays, blocks };
}

export interface DayStore<T> {
  /** The last day this build can serve. */
  last: number;
  /** Day `n`'s entries (empty if it isn't in this build). Fetches its block the first time. */
  day(n: number): Promise<T[]>;
}

/** The module a game's `virtual:*-days` compiles to: the index plus one loader per block. */
export interface DayModule<T> extends DayIndex<T> {
  blocks: (() => Promise<{ default: T[] }>)[];
}

/** Client side: looks days up in the shipped index and blocks. */
export function dayStore<T extends { number: number }>(m: DayModule<T>): DayStore<T> {
  const cache = new Map<number, Promise<T[]>>();
  const block = (k: number): Promise<T[]> => {
    let p = cache.get(k);
    if (!p) {
      const load = m.blocks[k];
      p = load ? load().then((b) => b.default) : Promise.resolve([]);
      // A failed fetch (offline, say) is retried the next time instead of staying failed.
      p.catch(() => cache.delete(k));
      cache.set(k, p);
    }
    return p;
  };
  return {
    last: m.last,
    async day(n) {
      if (!Number.isInteger(n) || n < 1 || n > m.last) return [];
      const recent = m.recent.filter((e) => e.number === n);
      if (recent.length) return recent;
      const source = sourceDay(n, m.count);
      const list = await block(Math.floor((source - 1) / m.blockDays));
      return list.filter((e) => e.number === source).map((e) => (source === n ? e : { ...e, number: n }));
    },
  };
}

/** A store over a split held in memory (tests and Node tools; the site loads blocks as chunks). */
export function storeOf<T extends { number: number }>(split: DaySplit<T>): DayStore<T> {
  return dayStore({ ...split, blocks: split.blocks.map((b) => async () => ({ default: b })) });
}
