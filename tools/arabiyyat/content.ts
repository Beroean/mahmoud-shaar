/**
 * Loads عربيّات content from content/arabiyyat and turns it into days. Shared by the Vite plugin
 * that compiles days into the game bundle and by the data test.
 *
 * - sources.yaml    the books, each with the place it records
 * - sayings.yaml    round 1 · finish the saying
 * - usage.yaml      round 2 · when is it said (usage) / what does it mean (meaning)
 * - wildcards.yaml  round 3 · word origin / classical root / riddle / custom
 *
 * Day N plays item N of each list, so the number of days is the length of the shortest list.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { BLANK, type Day, type Round, type RoundKind, type Source } from "../../src/pages/arabiyyat/core/types";
import { BOUNDS } from "../../src/pages/arabiyyat/ui/projection";
import { shuffledChoices } from "../halab/content";

export const CONTENT_DIR = resolve(import.meta.dirname, "../../content/arabiyyat");
export const FILES = { sayings: "sayings.yaml", usage: "usage.yaml", wildcards: "wildcards.yaml" } as const;
const KINDS: Record<keyof typeof FILES, RoundKind[]> = {
  sayings: ["saying"],
  usage: ["usage", "meaning"],
  wildcards: ["origin", "root", "riddle", "custom"],
};
const STATUSES = new Set(["draft", "approved"]);

type Raw = Record<string, unknown>;
const str = (x: unknown) => (typeof x === "string" ? x.trim() : "");
const positiveInt = (x: unknown) => Number.isInteger(x) && (x as number) > 0;

export interface Loaded {
  days: Day[];
  errors: string[];
  sources: Source[];
  counts: Record<keyof typeof FILES, number>;
  /** Aleppo items taken from حلبيّات spares: their Halab IDs (the test checks Halab never plays them). */
  halabIds: string[];
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
  const halabIds: string[] = [];

  const sources = readList("sources.yaml", errors).flatMap((s, i): Source[] => {
    const src = { id: str(s.id), title: str(s.title), author: str(s.author), place: str(s.place), url: str(s.url) };
    const missing = Object.entries(src).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) {
      errors.push(`sources.yaml #${i + 1}: missing ${missing.join(", ")}`);
      return [];
    }
    // The mini map's pin: must fall inside the map (projection.ts).
    const { lat, lon } = s as { lat?: unknown; lon?: unknown };
    if (typeof lat !== "number" || typeof lon !== "number" || lat < BOUNDS.south || lat > BOUNDS.north || lon < BOUNDS.west || lon > BOUNDS.east) {
      errors.push(`sources.yaml #${i + 1} (${src.id}): lat/lon missing or outside the map`);
      return [];
    }
    return [{ ...src, lat, lon }];
  });
  const byId = new Map(sources.map((s) => [s.id, s]));

  const ids = new Set<string>();
  const load = (list: keyof typeof FILES): Round[] =>
    readList(FILES[list], errors).flatMap((item, i) => {
      const id = str(item.id);
      const kind = (str(item.kind) || KINDS[list][0]) as RoundKind;
      const prompt = str(item.prompt);
      const answer = str(item.answer);
      const others = Array.isArray(item.others) ? item.others.map(str) : [];
      const source = byId.get(str(item.source));
      const errs: string[] = [];
      if (!/^[a-z]\d{3,4}$/.test(id)) errs.push(`bad id ${JSON.stringify(item.id)}`);
      if (ids.has(id)) errs.push("duplicate id");
      ids.add(id);
      if (!KINDS[list].includes(kind)) errs.push(`kind ${JSON.stringify(item.kind)} doesn't belong in ${FILES[list]}`);
      if (!prompt) errs.push("missing prompt");
      if (!answer) errs.push("missing answer");
      if (others.length !== 3 || others.some((o) => !o)) errs.push("others must be three non-empty answers");
      if (new Set([answer, ...others]).size !== 4) errs.push("answer and others must all differ");
      const blanks = prompt.split(BLANK).length - 1;
      if (kind === "saying" && blanks !== 1) errs.push(`prompt needs exactly one ${BLANK}`);
      if (kind !== "saying" && blanks) errs.push(`prompt must not contain ${BLANK}`);
      if (!source) errs.push(`unknown source ${JSON.stringify(item.source)}`);
      // Every item points into its book: a printed page, or (for the Aleppo book) a line of its text.
      if (!positiveInt(item.page) && !positiveInt(item.line)) errs.push("needs a page (or line) in the source");
      if (item.status !== undefined && !STATUSES.has(String(item.status))) errs.push(`unknown status ${item.status}`);
      if (item.halab !== undefined) halabIds.push(str(item.halab));
      errors.push(...errs.map((e) => `${FILES[list]} #${i + 1} (${id || "no id"}): ${e}`));
      if (errs.length || !source) return [];
      return [
        {
          id,
          kind,
          prompt,
          answer,
          choices: shuffledChoices(id, answer, others),
          source,
          ...(positiveInt(item.page) && { page: item.page as number }),
          ...(str(item.volume) && { volume: str(item.volume) }),
          ...(str(item.hint) && { hint: str(item.hint) }),
          ...(str(item.note) && { note: str(item.note) }),
        },
      ];
    });

  const sayings = load("sayings");
  const usage = load("usage");
  const wildcards = load("wildcards");
  const count = Math.min(sayings.length, usage.length, wildcards.length);
  const days: Day[] = Array.from({ length: count }, (_, i) => ({ number: i + 1, rounds: [sayings[i], usage[i], wildcards[i]] }));
  return {
    days,
    errors,
    sources,
    counts: { sayings: sayings.length, usage: usage.length, wildcards: wildcards.length },
    halabIds,
  };
}
