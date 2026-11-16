/**
 * Loads puzzles from content/shakkil. Shared by the CLI tools, the tests and the Vite plugin that
 * compiles puzzles into the game bundle.
 *
 * - content/shakkil/puzzles/NNNN.yaml: one puzzle per file. NNNN is a permanent ID, not a day.
 * - content/shakkil/schedule.yaml: one entry per day (day 1 = first entry). An entry is either one ID
 *   (a single-sentence day) or a list of three IDs: easy, medium, hard (a three-sentence day).
 *   While every day is single, unlisted puzzles run after the listed ones in ID order; once
 *   three-sentence days exist, unlisted puzzles are an unscheduled pool (see `npm run schedule -- plan`).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { compilePuzzle, type Puzzle, type PuzzleSource } from "../../src/pages/shakkil/core/puzzle";

export const PUZZLE_DIR = resolve(import.meta.dirname, "../../content/shakkil/puzzles");
export const SCHEDULE_FILE = resolve(import.meta.dirname, "../../content/shakkil/schedule.yaml");
export const REJECTED_FILE = resolve(import.meta.dirname, "../../content/shakkil/rejected.yaml");
export const FILE_RE = /^(\d{4})\.yaml$/;
const KNOWN_KEYS = new Set(["text", "irab", "alts", "author", "source", "level", "ref"]);

export interface FileResult {
  file: string;
  /** Permanent puzzle ID (file name without extension). */
  id: string;
  /** 1-based day in the schedule. 0 until the schedule is resolved (or unscheduled). */
  number: number;
  /** Position within the day: 0 for single days; 0/1/2 (easy/medium/hard) on three-sentence days. */
  slot: number;
  source?: PuzzleSource;
  puzzle?: Puzzle;
  errors: string[];
}

export function puzzleFiles(dir = PUZZLE_DIR): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort()
    .map((f) => join(dir, f));
}

export const idOfFile = (file: string) => basename(file).replace(/\.ya?ml$/, "");

/** Normalizes a schedule entry (YAML may read 0042 as the number 42) to a 4-digit ID. */
export function normalizeId(x: unknown): string {
  const s = String(x).trim().replace(/\.ya?ml$/, "");
  return /^\d{1,4}$/.test(s) ? s.padStart(4, "0") : s;
}

/** schedule.yaml → one array of IDs per day. */
export function parseSchedule(text: string | null): string[][] {
  if (!text) return [];
  const data = parseYaml(text);
  if (!Array.isArray(data)) return [];
  return data.map((entry) => (Array.isArray(entry) ? entry.map(normalizeId) : [normalizeId(entry)]));
}

export function readSchedule(): string[][] {
  return existsSync(SCHEDULE_FILE) ? parseSchedule(readFileSync(SCHEDULE_FILE, "utf8")) : [];
}

/**
 * The days, in order. Scheduled entries first (unknown or repeated IDs are reported and skipped).
 * Unlisted puzzles follow as single days while the schedule has only single days; once it has
 * three-sentence days they stay unscheduled (`pool`) until `npm run schedule -- plan` places them.
 */
export function resolveOrder(
  schedule: string[][],
  ids: string[],
): { days: string[][]; order: string[]; pool: string[]; errors: string[] } {
  const known = new Set(ids);
  const errors: string[] = [];
  const seen = new Set<string>();
  const days: string[][] = [];
  schedule.forEach((entry, k) => {
    if (entry.length !== 1 && entry.length !== 3) {
      errors.push(`schedule.yaml: اليوم ${k + 1} يجب أن يحوي جملة واحدة أو ثلاثًا / day ${k + 1} must list 1 or 3 IDs`);
    }
    const day: string[] = [];
    for (const id of entry) {
      if (!known.has(id)) errors.push(`schedule.yaml: لا يوجد ملف ${id}.yaml / unknown puzzle ${id}`);
      else if (seen.has(id)) errors.push(`schedule.yaml: ${id} مكرر / ${id} is listed twice`);
      else {
        seen.add(id);
        day.push(id);
      }
    }
    if (day.length) days.push(day);
  });
  const unlisted = [...ids].sort().filter((id) => !seen.has(id));
  const hasTriples = days.some((d) => d.length > 1);
  if (!hasTriples) for (const id of unlisted) days.push([id]);
  return { days, order: days.flat(), pool: hasTriples ? unlisted : [], errors };
}

export function loadPuzzleFile(path: string): FileResult {
  const file = basename(path);
  const id = idOfFile(file);
  const errors: string[] = [];
  if (!FILE_RE.test(file)) {
    errors.push(`اسم الملف يجب أن يكون أربعة أرقام مثل 0012.yaml / file name must be 4 digits, e.g. 0012.yaml`);
  }
  let data: unknown;
  try {
    data = parseYaml(readFileSync(path, "utf8"));
  } catch (e) {
    return { file, id, number: 0, slot: 0, errors: [...errors, `YAML غير صالح / invalid YAML: ${(e as Error).message}`] };
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { file, id, number: 0, slot: 0, errors: [...errors, "الملف يجب أن يحتوي على حقول / file must be a YAML mapping"] };
  }
  for (const k of Object.keys(data)) {
    if (!KNOWN_KEYS.has(k)) errors.push(`حقل غير معروف «${k}» / unknown field "${k}"`);
  }
  const source: PuzzleSource = { ...(data as Omit<PuzzleSource, "number" | "id">), number: 0, id };
  const { puzzle, errors: puzzleErrors } = compilePuzzle(source);
  return { file, id, number: 0, slot: 0, source, puzzle, errors: [...errors, ...puzzleErrors] };
}

const sentenceKey = (text: string) => text.normalize("NFC").replace(/[«»"']/g, "").trim();

/** Rejected or reserved sentences (content/shakkil/rejected.yaml), normalized for comparison. */
export function readRejected(): Set<string> {
  if (!existsSync(REJECTED_FILE)) return new Set();
  const data = parseYaml(readFileSync(REJECTED_FILE, "utf8"));
  return new Set(
    (Array.isArray(data) ? data : []).map((e: { text?: unknown }) => String(e?.text ?? "")).filter(Boolean).map(sentenceKey),
  );
}

/**
 * Loads every puzzle in schedule (day) order, numbering them by day, and checks the set as a whole
 * (schedule entries, duplicate sentences).
 */
export function loadAll(
  dir = PUZZLE_DIR,
  schedule = readSchedule(),
): { results: FileResult[]; days: string[][]; pool: FileResult[]; setErrors: string[] } {
  const byId = new Map(puzzleFiles(dir).map(loadPuzzleFile).map((r) => [r.id, r]));
  const { days, pool: poolIds, errors: setErrors } = resolveOrder(schedule, [...byId.keys()]);
  const results = days.flatMap((day, k) =>
    day.map((id, slot) => {
      const r = byId.get(id)!;
      r.number = k + 1;
      r.slot = slot;
      if (r.source) Object.assign(r.source, { number: k + 1, slot });
      if (r.puzzle) Object.assign(r.puzzle, { number: k + 1, slot });
      return r;
    }),
  );
  // Three-sentence days must be easy, medium, hard in that order.
  days.forEach((day, k) => {
    if (day.length !== 3) return;
    const levels = day.map((id) => byId.get(id)?.source?.level ?? 1);
    if (levels.join() !== "1,2,3") {
      setErrors.push(`schedule.yaml: اليوم ${k + 1} يجب أن يكون سهلًا ثم متوسطًا ثم صعبًا / day ${k + 1} must be easy, medium, hard (got levels ${levels.join(", ")})`);
    }
  });
  const pool = poolIds.map((id) => byId.get(id)!);
  const rejected = readRejected();
  const seen = new Map<string, string>();
  for (const r of results) {
    const key = r.source?.text?.normalize("NFC").trim();
    if (!key) continue;
    if (rejected.has(sentenceKey(key))) {
      setErrors.push(`${r.file}: الجملة مرفوضة أو محجوزة في rejected.yaml / sentence is rejected or reserved in rejected.yaml`);
    }
    if (seen.has(key)) setErrors.push(`جملة مكررة في ${seen.get(key)} و ${r.file} / duplicate sentence`);
    else seen.set(key, r.file);
  }
  for (const r of pool) {
    const key = r.source?.text?.normalize("NFC").trim();
    if (key && rejected.has(sentenceKey(key))) setErrors.push(`${r.file}: الجملة مرفوضة أو محجوزة في rejected.yaml / sentence is rejected or reserved`);
  }
  return { results, days, pool, setErrors };
}
