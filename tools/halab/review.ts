/**
 * Backend for the dev-only حلبيّات review page (halab/review/index.html, served by the Vite dev
 * server only). Reads and edits content/halab/*.yaml in place, keeping comments and formatting.
 *
 * - listItems():      every item, with its file, day number and a few lines of the book around it
 * - saveItem():       apply edits and mark approved (drops the `flag`)
 * - rejectItem():     remove from its file and record it in content/halab/rejected.yaml
 *
 * The book itself isn't in the repo. Set HALAB_BOOK to its .txt path, or keep it at
 * ~/Downloads/موسوعة حلب المقارنة_djvu.txt. Item `line` numbers count non-blank lines of that file.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { isMap, isSeq, parseDocument, type Document, type YAMLMap } from "yaml";
import { CONTENT_DIR, loadDays } from "./content";

export const FILES = ["origins", "proverbs", "wildcards"] as const;
export type FileName = (typeof FILES)[number];
const REJECTED = resolve(CONTENT_DIR, "rejected.yaml");
/** Fields the review page may edit. */
const EDITABLE = new Set(["word", "text", "prompt", "answer", "others", "meaning", "note", "entry"]);

export interface ReviewItem {
  file: FileName;
  /** Day this item plays on (null for spares beyond the last day). */
  day: number | null;
  data: Record<string, unknown>;
  /** Book lines around `line`: [lineNumber, text]. */
  context: [number, string][];
}

const path = (f: FileName) => resolve(CONTENT_DIR, `${f}.yaml`);
const readDoc = (f: FileName) => parseDocument(readFileSync(path(f), "utf8"));
const writeDoc = (f: FileName, doc: Document) => writeFileSync(path(f), doc.toString({ lineWidth: 0 }));

let book: string[] | null = null;
function bookLines(): string[] {
  if (book) return book;
  const file = process.env.HALAB_BOOK ?? resolve(homedir(), "Downloads", "موسوعة حلب المقارنة_djvu.txt");
  book = existsSync(file) ? readFileSync(file, "utf8").split(/\r?\n/).filter((l) => !/^\s*$/.test(l)) : [];
  return book;
}

export function bookContext(line: unknown, before = 3, after = 5): [number, string][] {
  const lines = bookLines();
  if (typeof line !== "number" || !lines.length) return [];
  const out: [number, string][] = [];
  for (let n = Math.max(1, line - before); n <= Math.min(lines.length, line + after); n++) out.push([n, lines[n - 1]]);
  return out;
}

function findItem(id: string): { file: FileName; doc: Document; index: number; map: YAMLMap } | null {
  for (const file of FILES) {
    const doc = readDoc(file);
    if (!isSeq(doc.contents)) continue;
    const index = doc.contents.items.findIndex((m) => isMap(m) && String((m as YAMLMap).get("id")) === id);
    if (index !== -1) return { file, doc, index, map: doc.contents.items[index] as YAMLMap };
  }
  return null;
}

export function listItems(): { items: ReviewItem[]; bookFound: boolean } {
  const dayOf = new Map<string, number>();
  for (const d of loadDays().days) for (const r of d.rounds) dayOf.set(r.id, d.number);
  const items = FILES.flatMap((file) => {
    const data = readDoc(file).toJS() as Record<string, unknown>[];
    return data.map((it) => ({ file, day: dayOf.get(String(it.id)) ?? null, data: it, context: bookContext(it.line) }));
  });
  return { items, bookFound: bookLines().length > 0 };
}

/** Applies edits (only editable fields), marks approved and clears the flag. */
export function saveItem(id: string, patch: Record<string, unknown>): Record<string, unknown> {
  const found = findItem(id);
  if (!found) throw new Error(`no item ${id}`);
  const { file, doc, map } = found;
  for (const [k, v] of Object.entries(patch)) {
    if (!EDITABLE.has(k)) continue;
    if (k === "others") {
      if (!Array.isArray(v) || v.length !== 3) throw new Error("others must be three answers");
      const seq = doc.createNode(v.map((x) => String(x).trim()));
      seq.flow = true;
      map.set("others", seq);
    } else if (typeof v === "string") {
      if (v.trim()) map.set(k, v.trim());
      else map.delete(k);
    }
  }
  map.set("status", "approved");
  map.delete("flag");
  // Validate with the real loader; roll back if the edit made the item invalid.
  const before = readFileSync(path(file), "utf8");
  writeDoc(file, doc);
  const mine = loadDays().errors.filter((e) => e.includes(`(${id})`));
  if (mine.length) {
    writeFileSync(path(file), before);
    throw new Error(`not saved: ${mine.map((e) => e.split(": ").slice(1).join(": ")).join("; ")}`);
  }
  return map.toJSON() as Record<string, unknown>;
}

/** Removes the item and appends it, with the reason, to rejected.yaml. */
export function rejectItem(id: string, reason: string): void {
  const found = findItem(id);
  if (!found || !isSeq(found.doc.contents)) throw new Error(`no item ${id}`);
  const item = found.map.toJSON() as Record<string, unknown>;
  found.doc.contents.items.splice(found.index, 1);
  writeDoc(found.file, found.doc);
  const rejected = existsSync(REJECTED)
    ? parseDocument(readFileSync(REJECTED, "utf8"))
    : parseDocument("# Items rejected in review, so they aren't curated again.\n[]\n");
  if (!isSeq(rejected.contents)) throw new Error("rejected.yaml must be a list");
  rejected.contents.flow = false;
  rejected.add({ ...item, file: found.file, reason, rejected: new Date().toISOString().slice(0, 10) });
  writeFileSync(REJECTED, rejected.toString({ lineWidth: 0 }));
}

/** Sets or clears an item's review flag (used to mark items that need a closer look). */
export function flagItem(id: string, flag: string | null): void {
  const found = findItem(id);
  if (!found) throw new Error(`no item ${id}`);
  if (flag) found.map.set("flag", flag);
  else found.map.delete("flag");
  writeDoc(found.file, found.doc);
}
