import { ArabicParseError, type Word, parseSentence, skeleton } from "./arabic";
import type { Variant } from "./grade";
import { specsFor } from "./rules";

/** A puzzle as authored in content/shakkil/puzzles/NNNN.yaml (plus its number). */
export interface PuzzleSource {
  /** 1-based puzzle number = position in the daily schedule (from the file name). */
  number: number;
  /** Fully diacritized reference sentence. */
  text: string;
  /** One short i'rab note per word, same order as the words. */
  irab: string[];
  /** Other fully valid diacritizations of the same sentence. */
  alts?: string[];
  author?: string;
  source?: string;
}

/** A puzzle ready to play: parsed and with grading specs for every accepted variant. */
export interface Puzzle extends PuzzleSource {
  words: Word[];
  variants: Variant[];
}

export const LIMITS = { minWords: 2, maxWords: 4 };
export const SOURCES = ["original", "tashkeela", "llm-reviewed"] as const;

function variantOf(text: string): Variant {
  const words = parseSentence(text);
  return { words, specs: specsFor(words) };
}

/** Parses and validates a puzzle. Returns the puzzle, or a list of bilingual error messages. */
export function compilePuzzle(src: PuzzleSource): { puzzle?: Puzzle; errors: string[] } {
  const errors: string[] = [];
  const err = (ar: string, en: string) => errors.push(`${ar} / ${en}`);

  if (typeof src.text !== "string" || !src.text.trim()) {
    err("الحقل text مفقود", "missing `text`");
    return { errors };
  }

  let main: Variant;
  try {
    main = variantOf(src.text);
  } catch (e) {
    if (e instanceof ArabicParseError) return { errors: [e.message] };
    throw e;
  }
  const n = main.words.length;
  if (n < LIMITS.minWords || n > LIMITS.maxWords) {
    err(
      `عدد الكلمات ${n}، والمسموح من ${LIMITS.minWords} إلى ${LIMITS.maxWords}`,
      `${n} words; must be ${LIMITS.minWords}–${LIMITS.maxWords}`,
    );
  }
  main.specs.forEach((ws, w) => {
    if (!ws.some((s) => s.graded)) {
      err(`الكلمة ${w + 1} لا تحتوي على حرف يُشكَّل`, `word ${w + 1} has nothing to diacritize`);
    }
  });

  if (!Array.isArray(src.irab) || src.irab.some((x) => typeof x !== "string" || !x.trim())) {
    err("الحقل irab يجب أن يكون قائمة نصوص", "`irab` must be a list of non-empty strings");
  } else if (src.irab.length !== n) {
    err(
      `عدد سطور الإعراب ${src.irab.length} لا يساوي عدد الكلمات ${n}`,
      `${src.irab.length} i'rab notes for ${n} words`,
    );
  }

  const variants: Variant[] = [main];
  for (const [k, alt] of (src.alts ?? []).entries()) {
    try {
      const v = variantOf(alt);
      if (skeleton(v.words) !== skeleton(main.words)) {
        err(
          `البديل ${k + 1} ليس نفس الجملة بتشكيل مختلف`,
          `alt ${k + 1} is not the same sentence (letters differ)`,
        );
      } else variants.push(v);
    } catch (e) {
      if (e instanceof ArabicParseError) errors.push(`alt ${k + 1}: ${e.message}`);
      else throw e;
    }
  }

  if (src.source !== undefined && !(SOURCES as readonly string[]).includes(src.source)) {
    err(`المصدر غير معروف «${src.source}»`, `unknown source; use one of: ${SOURCES.join(", ")}`);
  }

  if (errors.length) return { errors };
  return { puzzle: { ...src, words: main.words, variants }, errors };
}
