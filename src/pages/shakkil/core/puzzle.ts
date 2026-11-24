import { ArabicParseError, type Word, letterToString, parseSentence, skeleton } from "./arabic";
import type { Variant } from "./grade";
import { MOVED_SUKUN_FROM_DAY, movedSukunWords, specsFor } from "./rules";

/** A puzzle as authored in content/shakkil/puzzles/NNNN.yaml (plus its number). */
export interface PuzzleSource {
  /** 1-based puzzle number = day in the schedule (content/shakkil/schedule.yaml). */
  number: number;
  /** Position within its day: 0 on single days; 0/1/2 = easy/medium/hard on three-sentence days. */
  slot?: number;
  /** Permanent ID (the puzzle's file name, e.g. "0042"). Stays the same when the schedule changes. */
  id?: string;
  /** Fully diacritized reference sentence. */
  text: string;
  /** One short i'rab note per word, same order as the words. */
  irab: string[];
  /** Other fully valid diacritizations of the same sentence. */
  alts?: string[];
  /**
   * Interchangeable forms of one word, or of a run of consecutive words that change together, when
   * the sentence alone doesn't say who is speaking or being addressed: ["قَرَأْتُ", "قَرَأْتَ",
   * "قَرَأْتِ"]. One form must appear in `text` exactly. Every combination of the groups is
   * accepted, on `text` and on each alt.
   */
  vary?: string[][];
  /**
   * Shown above the sentence while playing, to pin down a reading the words leave open, e.g.
   * «المتكلّمة أنثى» or «الخطاب لجماعة الذكور».
   */
  context?: string;
  /**
   * Words whose pronoun suffix the rest of the sentence already settles (ما زِلْتُ أَتَذَكَّرُ, اقْرَأْ
   * كِتَابَكَ), written without diacritics: silences the ambiguity check for them.
   */
  fixed?: string[];
  author?: string;
  source?: string;
  /** Difficulty: 1 easy (default), 2 medium, 3 hard. Drives the badge and `npm run schedule -- mix`. */
  level?: number;
  /** Citation shown with the answer, e.g. "سورة الشرح، الآية ٦" or "المتنبي". */
  ref?: string;
}

/** A puzzle ready to play: parsed and with grading specs for every accepted variant. */
export interface Puzzle extends PuzzleSource {
  words: Word[];
  variants: Variant[];
}

export const LIMITS = { minWords: 2, maxWords: 12 };
/**
 * quran = verbatim from the Tanzil text (tanzil.net); hadith = a hadith from the public-domain
 * hadith-api text (github.com/fawazahmed0/hadith-api), ref = collection and number; poetry /
 * literature = a credited line from a
 * poem or a prose work (author + ref).
 */
export const SOURCES = ["original", "tashkeela", "llm-reviewed", "quran", "hadith", "poetry", "literature"] as const;
export const LEVELS = [1, 2, 3] as const;

/** Most accepted variants a puzzle may expand to (`alts` × every `vary` combination). */
export const MAX_VARIANTS = 64;

function variantOf(text: string): Variant {
  const words = parseSentence(text);
  return { words, specs: specsFor(words) };
}

const lettersOf = (w: Word) => w.letters.map((l) => letterToString(l)).join("");

/** Start indices where `run` occurs in `words`, comparing letters only (marks ignored). */
function runsOf(words: Word[], run: Word[]): number[] {
  const key = skeleton(run);
  const out: number[] = [];
  for (let k = 0; k + run.length <= words.length; k++) {
    if (skeleton(words.slice(k, k + run.length)) === key) out.push(k);
  }
  return out;
}

/** `words` with the run at `at` re-marked as `form` (punctuation of `words` kept). */
function withForm(words: Word[], at: number, form: Word[]): Word[] {
  return words.map((w, k) => (k < at || k >= at + form.length ? w : { ...w, letters: form[k - at].letters }));
}

/**
 * Expands `bases` (main text first) by every `vary` group. Variant 0 stays the main text.
 * Reports problems through `err` and returns the bases unchanged for a broken group.
 */
function expandVary(
  bases: Word[][],
  vary: unknown,
  err: (ar: string, en: string) => void,
): Word[][] {
  if (vary === undefined) return bases;
  if (!Array.isArray(vary)) {
    err("الحقل vary يجب أن يكون قائمة مجموعات", "`vary` must be a list of groups");
    return bases;
  }
  const main = bases[0];
  const taken = new Set<number>();
  let out = bases;
  vary.forEach((group: unknown, g) => {
    const label = `vary ${g + 1}`;
    if (!Array.isArray(group) || group.length < 2 || group.some((x) => typeof x !== "string" || !x.trim())) {
      err(`المجموعة ${g + 1} في vary تحتاج شكلين على الأقل`, `${label}: needs a list of at least two forms`);
      return;
    }
    let forms: Word[][];
    try {
      forms = group.map((s: string) => parseSentence(s));
      for (const f of forms) specsFor(f);
    } catch (e) {
      if (e instanceof ArabicParseError) err(`المجموعة ${g + 1} في vary: ${e.message}`, label);
      else throw e;
      return;
    }
    if (forms.some((f) => skeleton(f) !== skeleton(forms[0]))) {
      err(`أشكال المجموعة ${g + 1} في vary ليست نفس الحروف`, `${label}: forms must have the same letters`);
      return;
    }
    const at = runsOf(main, forms[0]);
    if (at.length !== 1) {
      err(
        at.length ? `المجموعة ${g + 1} في vary تتكرر في الجملة` : `المجموعة ${g + 1} في vary ليست في الجملة`,
        at.length ? `${label}: these words occur more than once in the text` : `${label}: these words are not in the text`,
      );
      return;
    }
    const k = at[0];
    const span = forms[0].map((_, j) => k + j);
    if (span.some((j) => taken.has(j))) {
      err(`المجموعة ${g + 1} في vary تتداخل مع مجموعة أخرى`, `${label}: overlaps another group`);
      return;
    }
    const inText = main.slice(k, k + forms[0].length).map(lettersOf).join(" ");
    if (!forms.some((f) => f.map(lettersOf).join(" ") === inText)) {
      err(`لا شكل في المجموعة ${g + 1} يطابق تشكيل الجملة`, `${label}: one form must match the text's diacritics exactly`);
      return;
    }
    span.forEach((j) => taken.add(j));
    out = out.flatMap((base) => [base, ...forms.map((f) => withForm(base, k, f))]);
  });
  // Drop duplicates (each base reappears as the form it already had), keeping the first.
  const seen = new Set<string>();
  return out.filter((words) => {
    const key = words.map(lettersOf).join(" ");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

  const bases: Word[][] = [main.words];
  for (const [k, alt] of (src.alts ?? []).entries()) {
    try {
      const v = variantOf(alt);
      if (skeleton(v.words) !== skeleton(main.words)) {
        err(
          `البديل ${k + 1} ليس نفس الجملة بتشكيل مختلف`,
          `alt ${k + 1} is not the same sentence (letters differ)`,
        );
      } else bases.push(v.words);
    } catch (e) {
      if (e instanceof ArabicParseError) errors.push(`alt ${k + 1}: ${e.message}`);
      else throw e;
    }
  }
  const expanded = expandVary(bases, src.vary, err);
  if (expanded.length > MAX_VARIANTS) {
    err(
      `التشكيلات المقبولة ${expanded.length}، والحد ${MAX_VARIANTS}`,
      `${expanded.length} accepted variants; at most ${MAX_VARIANTS}`,
    );
  }
  // Sukun accepted for a moved final vowel (لَمْ يَكُنِ / يَكُنْ), on upcoming days only.
  const moved = (words: Word[]) =>
    src.number >= MOVED_SUKUN_FROM_DAY && Array.isArray(src.irab) ? movedSukunWords(words, src.irab) : new Set<number>();
  const variants: Variant[] = expanded.map((words) => ({ words, specs: specsFor(words, moved(words)) }));
  if (src.context !== undefined && (typeof src.context !== "string" || !src.context.trim())) {
    err("الحقل context يجب أن يكون نصًا", "`context` must be a non-empty string");
  }
  if (src.fixed !== undefined) {
    const inText = new Set(main.words.map((w) => w.letters.map((l) => l.char).join("")));
    if (!Array.isArray(src.fixed) || src.fixed.some((f) => typeof f !== "string" || !inText.has(f.trim()))) {
      err(
        "الحقل fixed قائمة كلمات من الجملة بلا تشكيل",
        "`fixed` must list words of the text, written without diacritics",
      );
    }
  }

  if (src.level !== undefined && !(LEVELS as readonly number[]).includes(src.level)) {
    err(`المستوى يجب أن يكون ١ أو ٢ أو ٣`, `level must be 1, 2 or 3`);
  }
  if (src.source === "hadith" && !src.ref?.trim()) {
    err("الأحاديث تحتاج إلى ref (الكتاب ورقم الحديث)", "hadith puzzles need a ref (collection and number)");
  }
  if (src.source === "quran" && !src.ref?.trim()) {
    err("آيات القرآن تحتاج إلى ref (السورة والآية)", "Quran puzzles need a ref (sura and aya)");
  }
  if (src.source !== undefined && !(SOURCES as readonly string[]).includes(src.source)) {
    err(`المصدر غير معروف «${src.source}»`, `unknown source; use one of: ${SOURCES.join(", ")}`);
  }

  if (errors.length) return { errors };
  // Quran text is displayed exactly as written in the source (no tanween moved onto the alif).
  if (src.source === "quran") for (const v of variants) for (const w of v.words) w.tanweenOnLetter = true;
  return { puzzle: { ...src, words: main.words, variants }, errors };
}
