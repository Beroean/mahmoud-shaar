/**
 * Validates puzzles and shows how each letter will be graded.
 *
 *   npm run puzzle:check                      # every puzzle (also checks numbering)
 *   npm run puzzle:check -- 0003.yaml         # specific files (names or paths)
 *   npm run puzzle:check -- --text "ذَهَبَ الْوَلَدُ"   # try a sentence without making a file
 *   npm run puzzle:check -- --quiet           # errors only (used by CI)
 *
 * Exits with code 1 if anything is invalid.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { VOWEL_NAMES_AR, letterToString, wordToString, type Word } from "../../src/pages/shakkil/core/arabic";
import { ambiguities, describeAmbiguity } from "../../src/pages/shakkil/core/ambiguity";
import { difficulty } from "../../src/pages/shakkil/core/difficulty";
import { RULE_LABELS, type Spec } from "../../src/pages/shakkil/core/rules";
import { compilePuzzle } from "../../src/pages/shakkil/core/puzzle";
import { PUZZLE_DIR, loadAll, loadPuzzleFile, type FileResult } from "./content";

const args = process.argv.slice(2);
const quiet = args.includes("--quiet");
const textIdx = args.indexOf("--text");

const color = (code: number) => (s: string) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = color(31);
const green = color(32);
const dim = color(2);
const yellow = color(33);
const bold = color(1);

function describeMark(spec: Spec, word: Word, i: number): string {
  const l = word.letters[i];
  if (!spec.graded) return dim("—");
  const parts = [];
  if (l.mark.shadda) parts.push("شدة");
  if (l.mark.vowel) parts.push(VOWEL_NAMES_AR[l.mark.vowel]);
  return parts.join(" + ");
}

function preview(words: Word[], specs: Spec[][]) {
  words.forEach((word, w) => {
    console.log(`  ${bold(`word ${w + 1}`)}  ${wordToString(word)}`);
    word.letters.forEach((l, i) => {
      const spec = specs[w][i];
      const label = RULE_LABELS[spec.rule];
      const tag = !spec.graded ? dim("·") : spec.emptyOk ? "○" : green("●");
      console.log(
        `    ${tag} ${letterToString(l).padEnd(4)} ${describeMark(spec, word, i).padEnd(14)} ${spec.graded ? label.en : dim(label.en)}  ${dim(label.ar)}`,
      );
    });
  });
  console.log(dim("    ● required   ○ may be left bare   · not graded"));
}

let unresolved = 0;

/** Pronoun suffixes whose vowel the sentence leaves open (see core/ambiguity.ts). */
function ambiguityWarnings(r: FileResult): string[] {
  if (!r.puzzle) return [];
  return ambiguities(r.puzzle).map((a) => `⚠ ${describeAmbiguity(r.puzzle!, a)}`);
}

function report(r: FileResult): boolean {
  const ok = r.errors.length === 0;
  const warnings = ambiguityWarnings(r);
  if (warnings.length) unresolved++;
  if (quiet && ok) return ok;
  console.log(`${ok ? green("✓") : red("✗")} ${bold(r.file)}${r.source?.text ? `  ${r.source.text}` : ""}`);
  for (const e of r.errors) console.log(red(`    ${e}`));
  for (const w of warnings) console.log(yellow(`    ${w}`));
  if (ok && !quiet && r.puzzle) {
    const d = difficulty(r.puzzle);
    console.log(dim(`  difficulty ${d.score}: ${d.marks} marks${d.traps.length ? ` + ${d.traps.join(", ")}` : ""}${d.defused ? `, ${d.defused} defused by alts` : ""} · level ${r.puzzle.level ?? 1}`));
  }
  if (ok && !quiet && r.puzzle) {
    preview(r.puzzle.words, r.puzzle.variants[0].specs);
    r.puzzle.variants.slice(1).forEach((v, k) => {
      console.log(dim(`  alt ${k + 1}:`));
      preview(v.words, v.specs);
    });
  }
  return ok;
}

let ok = true;

if (textIdx >= 0) {
  const text = args[textIdx + 1] ?? "";
  // Ad-hoc check: fill in i'rab placeholders so only the diacritization is validated.
  const words = text.trim().split(/\s+/);
  const { puzzle, errors } = compilePuzzle({ number: 0, text, irab: words.map(() => "-") });
  ok = report({ file: "--text", id: "--text", number: 0, slot: 0, source: { number: 0, text, irab: [] }, puzzle, errors });
} else {
  const files = args.filter((a) => !a.startsWith("--"));
  if (files.length) {
    for (const f of files) {
      const path = existsSync(f) ? f : join(PUZZLE_DIR, f);
      if (!existsSync(path)) {
        console.log(red(`✗ not found: ${f}`));
        ok = false;
        continue;
      }
      ok = report(loadPuzzleFile(path)) && ok;
    }
  } else {
    const { results, pool, setErrors } = loadAll();
    for (const r of [...results, ...pool]) ok = report(r) && ok;
    for (const e of setErrors) console.log(red(`✗ ${e}`));
    ok = ok && setErrors.length === 0;
    console.log(`\n${results.length + pool.length} puzzles (${pool.length} not scheduled yet), ${ok ? green("all valid") : red("errors found")}`);
    if (unresolved) console.log(yellow(`${unresolved} with a pronoun suffix the sentence leaves open (⚠ above)`));
  }
}

process.exit(ok ? 0 : 1);
