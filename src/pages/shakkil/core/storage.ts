import type { Mark } from "./arabic";
import type { Guess } from "./grade";

export const MAX_ATTEMPTS = 6;
const KEY = "shakkil:v1";

export type GameStatus = "playing" | "won" | "lost";

export interface GameRecord {
  puzzle: number;
  attempts: Guess[];
  status: GameStatus;
}

export interface Stats {
  played: number;
  won: number;
  /** dist[k] = games won on attempt k+1. */
  dist: number[];
  streak: number;
  maxStreak: number;
  /** Puzzle number of the last daily win (one puzzle per day, so numbers are days). */
  lastWon: number | null;
}

export interface SaveData {
  version: 1;
  daily: GameRecord | null;
  stats: Stats;
}

/** The subset of the Storage API we use, so tests can pass a fake. */
export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function emptyStats(): Stats {
  return {
    played: 0,
    won: 0,
    dist: Array(MAX_ATTEMPTS).fill(0),
    streak: 0,
    maxStreak: 0,
    lastWon: null,
  };
}

export function emptySave(): SaveData {
  return { version: 1, daily: null, stats: emptyStats() };
}

function isMark(m: unknown): m is Mark {
  return typeof m === "object" && m !== null && "shadda" in m && "vowel" in m;
}

function isGuess(g: unknown): boolean {
  return Array.isArray(g) && g.every((w) => Array.isArray(w) && w.every(isMark));
}

function validate(raw: unknown): SaveData | null {
  if (typeof raw !== "object" || raw === null) return null;
  const d = raw as Partial<SaveData>;
  if (d.version !== 1 || typeof d.stats !== "object" || d.stats === null) return null;
  const stats: Stats = { ...emptyStats(), ...d.stats };
  if (!Array.isArray(stats.dist) || stats.dist.length !== MAX_ATTEMPTS) {
    stats.dist = emptyStats().dist;
  }
  let daily = d.daily ?? null;
  if (daily && !(typeof daily.puzzle === "number" && Array.isArray(daily.attempts) && daily.attempts.every(isGuess))) {
    daily = null;
  }
  return { version: 1, daily, stats };
}

function defaultKV(): KV | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined; // accessing localStorage itself can throw when storage is blocked
  }
}

/** Never throws: private mode, blocked storage or corrupt data all fall back to a fresh save. */
export function load(kv: KV | undefined = defaultKV()): SaveData {
  try {
    const raw = kv?.getItem(KEY);
    return (raw && validate(JSON.parse(raw))) || emptySave();
  } catch {
    return emptySave();
  }
}

export function save(data: SaveData, kv: KV | undefined = defaultKV()): void {
  try {
    kv?.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage full or blocked: the game still works for this session */
  }
}

/** Records a finished daily game and returns the new stats. */
export function recordResult(stats: Stats, puzzle: number, won: boolean, attempts: number): Stats {
  const s: Stats = { ...stats, dist: [...stats.dist] };
  s.played++;
  if (won) {
    s.won++;
    s.dist[attempts - 1]++;
    s.streak = s.lastWon === puzzle - 1 ? s.streak + 1 : 1;
    s.maxStreak = Math.max(s.maxStreak, s.streak);
    s.lastWon = puzzle;
  } else {
    s.streak = 0;
  }
  return s;
}

/** The streak to display today: it's broken once a day passes without winning that day's puzzle. */
export function currentStreak(stats: Stats, today: number): number {
  if (stats.lastWon === null) return 0;
  return stats.lastWon >= today - 1 ? stats.streak : 0;
}
