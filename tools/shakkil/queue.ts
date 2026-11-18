/**
 * Review queue for candidate puzzles.
 *
 * Candidates live in content/shakkil/queue/*.yaml, each file a YAML list of entries shaped like a
 * puzzle plus optional reviewer `notes`. Approving one writes the next numbered puzzle file and
 * removes it from the queue; rejecting one records it in content/shakkil/rejected.yaml (so the same
 * sentence isn't drafted again) and removes it.
 *
 *   npm run queue:check                 validate every queued candidate (errors only)
 *   npm run queue:check -- --verbose    also list each candidate with its difficulty score and
 *                                       ambiguity warnings, and a per-file summary
 *
 * Errors: the puzzle checker, a Quran item that isn't verbatim Tanzil text (when .cache/tanzil is
 * downloaded), and a sentence that's already a puzzle, rejected, or queued twice.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse, stringify } from "yaml";
import { ambiguities, describeAmbiguity } from "../../src/pages/shakkil/core/ambiguity";
import { difficulty } from "../../src/pages/shakkil/core/difficulty";
import { compilePuzzle } from "../../src/pages/shakkil/core/puzzle";
import { readRejected, sentenceKey } from "./content";
import { quranProblems } from "./tanzil";
import { FILE_RE, PUZZLE_DIR, REJECTED_FILE, puzzleFiles } from "./content";

export const QUEUE_DIR = resolve(import.meta.dirname, "../../content/shakkil/queue");

export interface Candidate {
  text: string;
  irab: string[];
  alts?: string[];
  vary?: string[][];
  context?: string;
  fixed?: string[];
  author?: string;
  source?: string;
  level?: number;
  ref?: string;
  /** Drafting notes for the reviewer: ambiguity, rule being tested, etc. */
  notes?: string;
}

export interface QueuedCandidate extends Candidate {
  /** Stable id: hash of the original text. */
  id: string;
  /** Queue file it came from. */
  file: string;
  errors: string[];
}

export const idOf = (text: string) =>
  createHash("sha1").update(text.normalize("NFC").trim()).digest("hex").slice(0, 10);

function queueFiles(): string[] {
  if (!existsSync(QUEUE_DIR)) return [];
  return readdirSync(QUEUE_DIR)
    .filter((f) => f.endsWith(".yaml"))
    .sort()
    .map((f) => join(QUEUE_DIR, f));
}

function readList(path: string): Candidate[] {
  const data = parse(readFileSync(path, "utf8"));
  return Array.isArray(data) ? data : [];
}

function validate(c: Candidate): string[] {
  const quran = c.source === "quran" ? quranProblems(c.text, c.ref) : [];
  return [...quran, ...compilePuzzle({
    number: 0,
    text: c.text,
    irab: c.irab,
    alts: c.alts,
    vary: c.vary,
    context: c.context,
    fixed: c.fixed,
    source: c.source ?? "llm-reviewed",
    level: c.level,
    ref: c.ref,
  }).errors];
}

/** Sentences already used: every puzzle file plus rejected.yaml. */
function usedSentences(): Map<string, string> {
  const used = new Map<string, string>();
  for (const path of puzzleFiles()) {
    const m = /^text:\s*(.*)$/m.exec(readFileSync(path, "utf8"));
    if (m) used.set(sentenceKey(m[1]), `puzzle ${basename(path)}`);
  }
  for (const t of readRejected()) used.set(t, "rejected.yaml");
  return used;
}

export function loadQueue(): QueuedCandidate[] {
  return queueFiles().flatMap((path): QueuedCandidate[] => {
    let list: Candidate[];
    try {
      list = readList(path);
    } catch (e) {
      // Surface a broken file as one invalid entry instead of failing the whole queue.
      const firstLine = (e as Error).message.split(/\r?\n/)[0];
      const msg = `YAML غير صالح / invalid YAML in ${basename(path)}: ${firstLine}`;
      return [{ text: "", irab: [], id: idOf(path), file: path, errors: [msg] }];
    }
    return list.map((c) => ({ ...c, id: idOf(c.text), file: path, errors: validate(c) }));
  });
}

/** loadQueue, plus duplicate errors: a sentence that's already a puzzle, rejected, or queued twice. */
export function checkQueue(): QueuedCandidate[] {
  const queue = loadQueue();
  const used = usedSentences();
  const queued = new Map<string, string>();
  for (const c of queue) {
    if (!c.text) continue;
    const key = sentenceKey(c.text);
    const where = used.get(key) ?? queued.get(key);
    if (where) c.errors.push(`الجملة موجودة في ${where} / duplicate of ${where}`);
    else queued.set(key, `queue ${basename(c.file)}`);
  }
  return queue;
}

function removeFromQueue(id: string): QueuedCandidate {
  const item = loadQueue().find((c) => c.id === id);
  if (!item) throw new Error(`candidate ${id} not found`);
  const rest = readList(item.file).filter((c) => idOf(c.text) !== id);
  if (rest.length) writeFileSync(item.file, stringify(rest, { lineWidth: 0 }), "utf8");
  else unlinkSync(item.file);
  return item;
}

function nextNumber(): number {
  const nums = puzzleFiles()
    .map((p) => FILE_RE.exec(p.split(/[\\/]/).pop()!)?.[1])
    .filter(Boolean)
    .map(Number);
  return (nums.length ? Math.max(...nums) : 0) + 1;
}

/** Validates the (possibly edited) candidate, writes it as the next puzzle, and dequeues it. */
export function approve(id: string, edited: Candidate): { number: number; file: string } {
  const errors = validate(edited);
  if (errors.length) throw new Error(errors.join("\n"));
  removeFromQueue(id);
  const number = nextNumber();
  const file = `${String(number).padStart(4, "0")}.yaml`;
  const doc: Record<string, unknown> = { text: edited.text.trim(), irab: edited.irab.map((s) => s.trim()) };
  doc.alts = (edited.alts ?? []).map((s) => s.trim()).filter(Boolean);
  const vary = (edited.vary ?? []).map((g) => g.map((s) => s.trim()).filter(Boolean)).filter((g) => g.length);
  if (vary.length) doc.vary = vary;
  if (edited.context?.trim()) doc.context = edited.context.trim();
  if (edited.fixed?.length) doc.fixed = edited.fixed;
  if (edited.author?.trim()) doc.author = edited.author.trim();
  doc.source = edited.source ?? "llm-reviewed";
  if (edited.level && edited.level !== 1) doc.level = edited.level;
  if (edited.ref?.trim()) doc.ref = edited.ref.trim();
  writeFileSync(join(PUZZLE_DIR, file), stringify(doc, { lineWidth: 0 }), "utf8");
  return { number, file };
}

export function reject(id: string, reason: string): void {
  const item = removeFromQueue(id);
  const raw = existsSync(REJECTED_FILE) ? readFileSync(REJECTED_FILE, "utf8") : "";
  // Keep the file's comment header; yaml.stringify would drop it.
  const header = raw
    .split(/\r?\n/)
    .filter((l) => l.startsWith("#"))
    .join("\n");
  const list = (parse(raw) as unknown[] | null) ?? [];
  list.push({ text: item.text, reason: reason.trim() || undefined });
  const body = stringify(list, { lineWidth: 0 });
  writeFileSync(REJECTED_FILE, header ? `${header}\n${body}` : body, "utf8");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const verbose = process.argv.includes("--verbose");
  const queue = checkQueue();
  const bad = queue.filter((c) => c.errors.length);
  const byFile = new Map<string, { n: number; scores: number[]; words: number[] }>();
  for (const c of queue) {
    const file = basename(c.file);
    const puzzle = c.errors.length ? undefined : compilePuzzle({ number: 0, ...c, source: c.source ?? "llm-reviewed" }).puzzle;
    const d = puzzle ? difficulty(puzzle) : null;
    const s = byFile.get(file) ?? { n: 0, scores: [], words: [] };
    s.n++;
    if (d && puzzle) {
      s.scores.push(d.score);
      s.words.push(puzzle.words.length);
    }
    byFile.set(file, s);
    const warnings = puzzle ? ambiguities(puzzle).map((a) => describeAmbiguity(puzzle, a)) : [];
    if (!c.errors.length && !warnings.length && !verbose) continue;
    console.log(`${c.errors.length ? "✗" : warnings.length ? "⚠" : "✓"} ${file}  ${d ? `[${d.score}] ` : ""}${c.text}`);
    for (const e of c.errors) console.log(`    ${e}`);
    for (const w of warnings) console.log(`    ⚠ ${w}`);
  }
  if (verbose) {
    console.log("");
    for (const [file, s] of byFile) {
      const sorted = [...s.scores].sort((a, b) => a - b);
      const avg = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / (xs.length || 1)).toFixed(1);
      console.log(
        `${file}: ${s.n} items, ${avg(s.words)} words avg, difficulty ${sorted[0] ?? "-"}–${sorted.at(-1) ?? "-"} (median ${sorted[sorted.length >> 1] ?? "-"})`,
      );
    }
  }
  console.log(`${queue.length} queued, ${bad.length} invalid`);
  process.exit(bad.length ? 1 : 0);
}
