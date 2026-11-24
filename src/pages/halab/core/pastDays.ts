/**
 * Past days for حلبيّات and عربيّات (same shape: rounds answered by picking a choice). Opened with
 * ?day=N, saved in the archive (src/lib/archive.ts), never counted in the stats.
 */
import { loadArchive, recordArchiveDay } from "../../../lib/archive";

/**
 * daily: today's day, saved and counted. archive: a past day, saved apart and not counted.
 * preview: before launch, or a future day in dev; never saved.
 */
export type DayMode = "daily" | "archive" | "preview";

/** `requested` is the ?day=N the page was opened with (previewNumber), or null. */
export function dayMode(requested: number | null, today: number, launched: boolean): DayMode {
  if (!launched) return "preview";
  if (requested === null || requested === today) return "daily";
  return requested < today ? "archive" : "preview";
}

export interface PicksProgress {
  ids: string[];
  picks: (string | null)[];
}

interface PickDay {
  number: number;
  rounds: { id: string; answer: string }[];
}

const ids = (day: PickDay) => day.rounds.map((r) => r.id);

/** The saved answers for a past day, or null (none, or the day's rounds changed since). */
export function archivedPicks(game: string, day: PickDay): (string | null)[] | null {
  const saved = loadArchive<PicksProgress>(game)[day.number]?.progress;
  return saved && saved.ids.join() === ids(day).join() && saved.picks.length === day.rounds.length ? saved.picks : null;
}

/**
 * Saves a day's answers to the archive, with this play's score once every round is answered (the
 * day keeps its best score across replays). Replaying a day saves it with every answer cleared.
 */
export function archivePicks(game: string, day: PickDay, picks: (string | null)[]): void {
  const done = picks.every((p) => p !== null);
  const got = day.rounds.filter((r, i) => picks[i] === r.answer).length;
  recordArchiveDay<PicksProgress>(game, day.number, { ids: ids(day), picks }, done ? { got, of: day.rounds.length } : undefined);
}
