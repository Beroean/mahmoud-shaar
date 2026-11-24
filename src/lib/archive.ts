/**
 * Past days a player has played, for the daily games' archive. Kept apart from each game's save
 * (today's progress and the stats): archive plays never count toward stats or streaks. A daily day
 * is copied here once it's finished, so the archive shows it as played too.
 *
 * Never throws: blocked or corrupt storage starts empty.
 */

/** How a finished day went: `got` of `of` (rounds answered right, sentences solved). */
export interface Score {
  got: number;
  of: number;
}

export interface PastDay<P> {
  /** The game's own progress for the day (answers so far), to restore it when reopened. */
  progress: P;
  /** Set once every round is finished. */
  score?: Score;
}

export type Archive<P> = Record<number, PastDay<P>>;

/** The subset of the Storage API we use, so tests can pass a fake. */
export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultKV(): KV | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

const keyOf = (game: string) => `${game}:archive`;

export function loadArchive<P>(game: string, kv: KV | undefined = defaultKV()): Archive<P> {
  try {
    const data: unknown = JSON.parse(kv?.getItem(keyOf(game)) ?? "{}");
    return data && typeof data === "object" && !Array.isArray(data) ? (data as Archive<P>) : {};
  } catch {
    return {};
  }
}

export function saveArchiveDay<P>(game: string, day: number, entry: PastDay<P>, kv: KV | undefined = defaultKV()): void {
  try {
    kv?.setItem(keyOf(game), JSON.stringify({ ...loadArchive<P>(game, kv), [day]: entry }));
  } catch {
    // Storage full or blocked: the day just isn't remembered.
  }
}

const DAY_MS = 86_400_000;

/** The calendar date of day `n` for a game whose day 1 is `launchDate` (YYYY-MM-DD), at 00:00 UTC. */
export function dateOfDay(launchDate: string, n: number): Date {
  return new Date(Date.parse(`${launchDate}T00:00:00Z`) + (n - 1) * DAY_MS);
}

/** A random past day, preferring ones not played yet. */
export function randomPastDay(today: number, archive: Archive<unknown>, random = Math.random): number | null {
  const past = Array.from({ length: Math.max(0, today - 1) }, (_, i) => i + 1);
  const fresh = past.filter((n) => !archive[n]);
  const pool = fresh.length ? fresh : past;
  return pool.length ? pool[Math.floor(random() * pool.length)] : null;
}

/** Link to a past day: each game opens `?day=N` from its own page. */
export const dayHref = (n: number) => `?day=${n}`;
