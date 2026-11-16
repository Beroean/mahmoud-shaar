/**
 * Loads حلبيّات content from content/halab and turns it into days. Shared by the Vite plugin that
 * compiles days into the game bundle and by the data test.
 *
 * - origins.yaml   round 1 · where did the word come from?
 * - proverbs.yaml  round 2 · finish the saying: proverb (default) / wisdom / taunt
 * - wildcards.yaml round 3 · riddle / vendor cry / idiom / folk belief / simile / blessing / song
 *
 * Day N plays item N of each list, so the number of days is the length of the shortest list.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { BLANK, type Day, type Round, type RoundKind } from "../../src/pages/halab/core/types";

export const CONTENT_DIR = resolve(import.meta.dirname, "../../content/halab");
const FILES = { origins: "origins.yaml", proverbs: "proverbs.yaml", wildcards: "wildcards.yaml" } as const;
const SAYING_KINDS = new Set<RoundKind>(["proverb", "wisdom", "taunt"]);
const WILD_KINDS = new Set<RoundKind>(["riddle", "vendor", "idiom", "belief", "simile", "blessing", "song"]);
/** Wildcard kinds whose prompt hides a part behind the blank. */
const BLANK_KINDS = new Set<RoundKind>(["vendor", "belief", "simile", "blessing", "song"]);
const STATUSES = new Set(["draft", "approved"]);

type Raw = Record<string, unknown>;

/** Deterministic PRNG so a day's choice order never changes between builds. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.codePointAt(0)!, 16777619);
  return h >>> 0;
}

/** Answer + wrong options, shuffled with a seed taken from the item ID. */
export function shuffledChoices(id: string, answer: string, others: string[]): string[] {
  const out = [answer, ...others];
  const rand = mulberry32(hash(id));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const str = (x: unknown) => (typeof x === "string" ? x.trim() : "");

/** Validates one item and returns its errors (empty = fine). */
function check(item: Raw, kind: RoundKind, textKey: string, needsBlank: boolean): string[] {
  const errors: string[] = [];
  const text = str(item[textKey]);
  const answer = str(item.answer);
  if (!/^[a-z]\d{3,4}$/.test(str(item.id))) errors.push(`bad id ${JSON.stringify(item.id)}`);
  if (!text) errors.push(`missing ${textKey}`);
  if (!answer) errors.push("missing answer");
  const others = Array.isArray(item.others) ? item.others.map(str) : [];
  if (others.length !== 3 || others.some((o) => !o)) errors.push("others must be three non-empty answers");
  if (new Set([answer, ...others]).size !== others.length + 1) errors.push("answer and others must all differ");
  const blanks = text.split(BLANK).length - 1;
  if (needsBlank && blanks !== 1) errors.push(`${kind}: ${textKey} needs exactly one ${BLANK}`);
  if (!needsBlank && blanks) errors.push(`${kind}: ${textKey} must not contain ${BLANK}`);
  if (item.status !== undefined && !STATUSES.has(String(item.status))) errors.push(`unknown status ${item.status}`);
  if (item.line !== undefined && !Number.isInteger(item.line)) errors.push("line must be a whole number");
  return errors;
}

function toRound(item: Raw, kind: RoundKind, prompt: string, extra: Partial<Round>): Round {
  const id = str(item.id);
  const answer = str(item.answer);
  const others = (item.others as unknown[]).map(str);
  return {
    id,
    kind,
    prompt,
    answer,
    choices: shuffledChoices(id, answer, others),
    ...(str(item.note) && { note: str(item.note) }),
    ...extra,
  };
}

export interface Loaded {
  days: Day[];
  errors: string[];
  counts: { origins: number; proverbs: number; wildcards: number };
}

function readList(file: string, errors: string[]): Raw[] {
  try {
    const data = parseYaml(readFileSync(resolve(CONTENT_DIR, file), "utf8"));
    if (!Array.isArray(data)) throw new Error("expected a list");
    return data as Raw[];
  } catch (e) {
    errors.push(`${file}: ${(e as Error).message}`);
    return [];
  }
}

export function loadDays(): Loaded {
  const errors: string[] = [];
  const ids = new Set<string>();
  const collect = (file: string, list: Raw[], fn: (item: Raw) => { errs: string[]; round?: Round }) =>
    list.flatMap((item, i) => {
      const where = `${file} #${i + 1} (${str(item.id) || "no id"})`;
      const { errs, round } = fn(item);
      if (ids.has(str(item.id))) errs.push("duplicate id");
      ids.add(str(item.id));
      errors.push(...errs.map((e) => `${where}: ${e}`));
      return errs.length || !round ? [] : [round];
    });

  const origins = collect(FILES.origins, readList(FILES.origins, errors), (item) => {
    const errs = check(item, "origin", "word", false);
    if (!str(item.meaning)) errs.push("missing meaning");
    return {
      errs,
      round: toRound(item, "origin", str(item.word), { hint: str(item.meaning), entry: str(item.entry) || str(item.word) }),
    };
  });

  const proverbs = collect(FILES.proverbs, readList(FILES.proverbs, errors), (item) => {
    const kind = (str(item.kind) || "proverb") as RoundKind;
    if (!SAYING_KINDS.has(kind)) return { errs: [`unknown kind ${JSON.stringify(item.kind)}`] };
    const errs = check(item, kind, "text", true);
    return { errs, round: toRound(item, kind, str(item.text), str(item.meaning) ? { meaning: str(item.meaning) } : {}) };
  });

  const wildcards = collect(FILES.wildcards, readList(FILES.wildcards, errors), (item) => {
    const kind = str(item.kind) as RoundKind;
    if (!WILD_KINDS.has(kind)) return { errs: [`unknown kind ${JSON.stringify(item.kind)}`] };
    const errs = check(item, kind, "prompt", BLANK_KINDS.has(kind));
    return { errs, round: toRound(item, kind, str(item.prompt), {}) };
  });

  const count = Math.min(origins.length, proverbs.length, wildcards.length);
  const days: Day[] = Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    rounds: [origins[i], proverbs[i], wildcards[i]],
  }));
  return { days, errors, counts: { origins: origins.length, proverbs: proverbs.length, wildcards: wildcards.length } };
}
