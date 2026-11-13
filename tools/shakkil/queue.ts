/**
 * Review queue for candidate puzzles.
 *
 * Candidates live in content/shakkil/queue/*.yaml, each file a YAML list of entries shaped like a
 * puzzle plus optional reviewer `notes`. Approving one writes the next numbered puzzle file and
 * removes it from the queue; rejecting one records it in content/shakkil/rejected.yaml (so the same
 * sentence isn't drafted again) and removes it.
 *
 *   npm run queue:check     validate every queued candidate
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse, stringify } from "yaml";
import { compilePuzzle } from "../../src/pages/shakkil/core/puzzle";
import { FILE_RE, PUZZLE_DIR, REJECTED_FILE, puzzleFiles } from "./content";

export const QUEUE_DIR = resolve(import.meta.dirname, "../../content/shakkil/queue");

export interface Candidate {
  text: string;
  irab: string[];
  alts?: string[];
  author?: string;
  source?: string;
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
  return compilePuzzle({ number: 0, text: c.text, irab: c.irab, alts: c.alts, source: "llm-reviewed" }).errors;
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
  if (edited.author?.trim()) doc.author = edited.author.trim();
  doc.source = edited.source ?? "llm-reviewed";
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
  const queue = loadQueue();
  const bad = queue.filter((c) => c.errors.length);
  for (const c of bad) {
    console.log(`✗ ${c.file.split(/[\\/]/).pop()}  ${c.text}`);
    for (const e of c.errors) console.log(`    ${e}`);
  }
  console.log(`${queue.length} queued, ${bad.length} invalid`);
  process.exit(bad.length ? 1 : 0);
}
