/**
 * Loads puzzle YAML files from content/shakkil/puzzles. Shared by the CLI tools, the tests and
 * (from M3) the Vite plugin that compiles puzzles into the game bundle.
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { compilePuzzle, type Puzzle, type PuzzleSource } from "../../src/pages/shakkil/core/puzzle";

export const PUZZLE_DIR = resolve(import.meta.dirname, "../../content/shakkil/puzzles");
export const FILE_RE = /^(\d{4})\.yaml$/;
const KNOWN_KEYS = new Set(["text", "irab", "alts", "author", "source"]);

export interface FileResult {
  file: string;
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

export function loadPuzzleFile(path: string): FileResult {
  const file = basename(path);
  const m = FILE_RE.exec(file);
  const number = m ? Number(m[1]) : NaN;
  const errors: string[] = [];
  if (!m) {
    errors.push(`اسم الملف يجب أن يكون أربعة أرقام مثل 0012.yaml / file name must be 4 digits, e.g. 0012.yaml`);
  }
  let data: unknown;
  try {
    data = parseYaml(readFileSync(path, "utf8"));
  } catch (e) {
    return { file, number, errors: [...errors, `YAML غير صالح / invalid YAML: ${(e as Error).message}`] };
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { file, number, errors: [...errors, "الملف يجب أن يحتوي على حقول / file must be a YAML mapping"] };
  }
  for (const k of Object.keys(data)) {
    if (!KNOWN_KEYS.has(k)) errors.push(`حقل غير معروف «${k}» / unknown field "${k}"`);
  }
  const source = { ...(data as Omit<PuzzleSource, "number">), number };
  const { puzzle, errors: puzzleErrors } = compilePuzzle(source);
  return { file, number, source, puzzle, errors: [...errors, ...puzzleErrors] };
}

/** Loads every puzzle and checks the set as a whole (numbering, duplicates). */
export function loadAll(dir = PUZZLE_DIR): { results: FileResult[]; setErrors: string[] } {
  const results = puzzleFiles(dir).map(loadPuzzleFile);
  const setErrors: string[] = [];
  results.forEach((r, i) => {
    if (r.number !== i + 1) {
      setErrors.push(
        `الترقيم غير متسلسل: المتوقع ${String(i + 1).padStart(4, "0")}.yaml ووُجد ${r.file} / numbering must be consecutive from 0001 (expected ${String(i + 1).padStart(4, "0")}.yaml, found ${r.file})`,
      );
    }
  });
  const seen = new Map<string, string>();
  for (const r of results) {
    const key = r.source?.text?.normalize("NFC").trim();
    if (!key) continue;
    if (seen.has(key)) setErrors.push(`جملة مكررة في ${seen.get(key)} و ${r.file} / duplicate sentence`);
    else seen.set(key, r.file);
  }
  return { results, setErrors };
}
