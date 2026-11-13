import { type Mark, type Vowel, type Word, isEmptyMark, sameMark } from "./arabic";
import type { Spec } from "./rules";

/**
 * - correct: an accepted mark (or bare where bare is allowed)
 * - partial: half right: right vowel but shadda missing/extra, right shadda but wrong/missing
 *   vowel, or tanween vs plain vowel of the same kind
 * - wrong:   anything else (including bare where a mark is required)
 * - fixed:   not graded (long vowel letters etc.)
 */
export type LetterResult = "correct" | "partial" | "wrong" | "fixed";

/** The plain vowel a tanween belongs to (an → a). */
function family(v: Vowel | null): Vowel | null {
  if (v === "an") return "a";
  if (v === "un") return "u";
  if (v === "in") return "i";
  return v;
}

function isPartial(guess: Mark, target: Mark): boolean {
  if (isEmptyMark(guess)) return false;
  // Right vowel, shadda wrong.
  if (guess.vowel !== null && guess.vowel === target.vowel) return true;
  // Right shadda, vowel wrong or missing.
  if (target.shadda && guess.shadda) return true;
  // Same vowel family (tanween vs plain), shadda right.
  if (
    guess.shadda === target.shadda &&
    guess.vowel !== null &&
    family(guess.vowel) === family(target.vowel)
  ) {
    return true;
  }
  return false;
}

export function gradeLetter(guess: Mark, spec: Spec): LetterResult {
  if (!spec.graded) return "fixed";
  if (sameMark(guess, spec.expected)) return "correct";
  if (spec.alsoAccept.some((m) => sameMark(guess, m))) return "correct";
  if (spec.emptyOk && isEmptyMark(guess)) return "correct";
  if (isPartial(guess, spec.expected)) return "partial";
  return "wrong";
}

/** A guess is a mark per letter, shaped like the puzzle's words. */
export type Guess = Mark[][];

export interface Variant {
  words: Word[];
  specs: Spec[][];
}

export interface GradeResult {
  letters: LetterResult[][];
  /** All graded letters correct. */
  solved: boolean;
  /** Index of the variant (0 = main text, 1.. = alts) the guess was graded against. */
  variant: number;
}

function score(r: LetterResult[][]): number {
  let s = 0;
  for (const w of r) for (const l of w) s += l === "correct" ? 2 : l === "partial" ? 1 : 0;
  return s;
}

/** Grades a guess against every accepted variant and keeps the best match. */
export function grade(guess: Guess, variants: Variant[]): GradeResult {
  let best: GradeResult | null = null;
  for (let vi = 0; vi < variants.length; vi++) {
    const v = variants[vi];
    const letters = v.specs.map((ws, w) =>
      ws.map((spec, i) => gradeLetter(guess[w]?.[i] ?? { shadda: false, vowel: null }, spec)),
    );
    const solved = letters.every((w) => w.every((l) => l === "correct" || l === "fixed"));
    const better =
      !best ||
      (solved && !best.solved) ||
      (solved === best.solved && score(letters) > score(best.letters));
    if (better) best = { letters, solved, variant: vi };
  }
  if (!best) throw new Error("grade: no variants");
  return best;
}

/** An empty guess shaped like the puzzle. */
export function emptyGuess(words: Word[]): Guess {
  return words.map((w) => w.letters.map(() => ({ shadda: false, vowel: null })));
}
