/** Saved progress and stats for حلبيّات. Never throws: blocked or corrupt storage starts fresh. */

const KEY = "halab:v1";
export const ROUNDS = 3;

/** One day's answers: the chosen option per round (null = not answered yet). */
export interface DayRecord {
  day: number;
  /** Round IDs, so a schedule change under a save drops it instead of mixing answers. */
  ids: string[];
  picks: (string | null)[];
}

export interface Stats {
  played: number;
  /** dist[k] = days finished with k correct answers (0..3). */
  dist: number[];
  /** Consecutive days played (a day counts once all three rounds are answered). */
  streak: number;
  maxStreak: number;
  lastPlayed: number | null;
}

export interface SaveData {
  version: 1;
  daily: DayRecord | null;
  stats: Stats;
}

export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const emptyStats = (): Stats => ({ played: 0, dist: Array(ROUNDS + 1).fill(0), streak: 0, maxStreak: 0, lastPlayed: null });
export const emptySave = (): SaveData => ({ version: 1, daily: null, stats: emptyStats() });

function validate(raw: unknown): SaveData | null {
  const d = raw as Partial<SaveData> | null;
  if (!d || d.version !== 1 || typeof d.stats !== "object" || !d.stats) return null;
  const stats: Stats = { ...emptyStats(), ...d.stats };
  if (!Array.isArray(stats.dist) || stats.dist.length !== ROUNDS + 1) stats.dist = emptyStats().dist;
  let daily = d.daily ?? null;
  const ok =
    daily &&
    typeof daily.day === "number" &&
    Array.isArray(daily.ids) &&
    Array.isArray(daily.picks) &&
    daily.picks.every((p) => p === null || typeof p === "string");
  if (!ok) daily = null;
  return { version: 1, daily, stats };
}

function defaultKV(): KV | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/** `key` lets another three-round game (عربيّات) keep its own save with the same shape. */
export function load(kv: KV | undefined = defaultKV(), key = KEY): SaveData {
  try {
    const raw = kv?.getItem(key);
    return (raw && validate(JSON.parse(raw))) || emptySave();
  } catch {
    return emptySave();
  }
}

export function save(data: SaveData, kv: KV | undefined = defaultKV(), key = KEY): void {
  try {
    kv?.setItem(key, JSON.stringify(data));
  } catch {
    /* storage full or blocked: the game still works for this visit */
  }
}

/** Counts a finished day once. `score` is the number of correct answers. */
export function recordDay(stats: Stats, day: number, score: number): Stats {
  const s: Stats = { ...stats, dist: [...stats.dist] };
  s.played++;
  if (score >= 0 && score <= ROUNDS) s.dist[score]++;
  s.streak = s.lastPlayed === day - 1 ? s.streak + 1 : 1;
  s.maxStreak = Math.max(s.maxStreak, s.streak);
  s.lastPlayed = day;
  return s;
}

/** The streak to show today: broken once a whole day passes unplayed. */
export function currentStreak(stats: Stats, today: number): number {
  return stats.lastPlayed !== null && stats.lastPlayed >= today - 1 ? stats.streak : 0;
}
