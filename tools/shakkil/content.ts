/**
 * Loads puzzles from content/shakkil. Shared by the CLI tools, the tests and the Vite plugin that
 * compiles puzzles into the game bundle.
 *
 * - content/shakkil/puzzles/NNNN.yaml: one puzzle per file. NNNN is a permanent ID, not a day.
 * - content/shakkil/schedule.yaml: the order puzzles run in (day 1 = first entry). Puzzles not
 *   listed there run after the listed ones, in ID order.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { compilePuzzle, type Puzzle, type PuzzleSource } from "../../src/pages/shakkil/core/puzzle";

export const PUZZLE_DIR = resolve(import.meta.dirname, "../../content/shakkil/puzzles");
export const SCHEDULE_FILE = resolve(import.meta.dirname, "../../content/shakkil/schedule.yaml");
export const REJECTED_FILE = resolve(import.meta.dirname, "../../content/shakkil/rejected.yaml");
export const FILE_RE = /^(\d{4})\.yaml$/;
const KNOWN_KEYS = new Set(["text", "irab", "alts", "author", "source"]);

export interface FileResult {
  file: string;
  /** Permanent puzzle ID (file name without extension). */
  id: string;
  /** 1-based day in the schedule. 0 until the schedule is resolved. */
  number: number;
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

export function parseSchedule(text: string | null): string[] {
  if (!text) return [];
  const data = parseYaml(text);
  return Array.isArray(data) ? data.map(normalizeId) : [];
}

export function readSchedule(): string[] {
  return existsSync(SCHEDULE_FILE) ? parseSchedule(readFileSync(SCHEDULE_FILE, "utf8")) : [];
}

/** Day order: scheduled IDs first (those that exist), then every unscheduled ID ascending. */
export function resolveOrder(schedule: string[], ids: string[]): { order: string[]; errors: string[] } {
  const known = new Set(ids);
  const errors: string[] = [];
  const seen = new Set<string>();
  const order: string[] = [];
  for (const id of schedule) {
    if (!known.has(id)) errors.push(`schedule.yaml: لا يوجد ملف ${id}.yaml / unknown puzzle ${id}`);
    else if (seen.has(id)) errors.push(`schedule.yaml: ${id} مكرر / ${id} is listed twice`);
    else {
      seen.add(id);
      order.push(id);
    }
  }
  for (const id of [...ids].sort()) if (!seen.has(id)) order.push(id);
  return { order, errors };
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
    return { file, id, number: 0, errors: [...errors, `YAML غير صالح / invalid YAML: ${(e as Error).message}`] };
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { file, id, number: 0, errors: [...errors, "الملف يجب أن يحتوي على حقول / file must be a YAML mapping"] };
  }
  for (const k of Object.keys(data)) {
    if (!KNOWN_KEYS.has(k)) errors.push(`حقل غير معروف «${k}» / unknown field "${k}"`);
  }
  const source: PuzzleSource = { ...(data as Omit<PuzzleSource, "number" | "id">), number: 0, id };
  const { puzzle, errors: puzzleErrors } = compilePuzzle(source);
  return { file, id, number: 0, source, puzzle, errors: [...errors, ...puzzleErrors] };
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
export function loadAll(dir = PUZZLE_DIR, schedule = readSchedule()): { results: FileResult[]; setErrors: string[] } {
  const byId = new Map(puzzleFiles(dir).map(loadPuzzleFile).map((r) => [r.id, r]));
  const { order, errors: setErrors } = resolveOrder(schedule, [...byId.keys()]);
  const results = order.map((id, k) => {
    const r = byId.get(id)!;
    r.number = k + 1;
    if (r.source) r.source.number = k + 1;
    if (r.puzzle) r.puzzle.number = k + 1;
    return r;
  });
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
  return { results, setErrors };
}
