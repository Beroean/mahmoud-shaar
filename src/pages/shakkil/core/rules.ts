/**
 * Leniency rules: for each letter of a reference (fully diacritized) sentence, decide whether the
 * player must mark it, may leave it bare, or never touches it.
 *
 * The rules are conventions of written Arabic. A fully diacritized text still leaves some letters
 * bare (long-vowel letters, alif of ال, …), and some marks are routinely omitted by careful writers
 * (sukun, the vowel before a long vowel letter). Everything that carries meaning, i.e. the vowels
 * of the word's pattern, shadda, and the case/mood ending, is required.
 */
import { ArabicParseError, type Letter, type Mark, type Word, isEmptyMark } from "./arabic";

/** Tunable rule switches. Changing one re-grades every puzzle consistently. */
export const RULES = {
  /**
   * Accept a bare letter / sukun on the last letter of the sentence (pausal form, الوقف).
   * Off: the full case ending is the point of the game.
   */
  pausalFinal: false,
  /**
   * Sukun inside a word may be left out (empty == sukun). A word-final sukun is still required:
   * there it is a grammatical sign (jussive لا تتأخرْ, or the fixed ending of مِنْ / لَمْ).
   */
  sukunOptional: true,
  /** A vowel right before its matching long vowel letter (fatha+ا/ى, damma+و, kasra+ي) may be left out. */
  vowelBeforeMaddOptional: true,
  /**
   * A word-final sukun that turns into a vowel before a hamzat wasl (لَمْ يَكُنِ الطُّلَّابُ، كَتَبَتِ
   * الْبِنْتُ، مِنَ الْبَيْتِ) may also be written as the sukun. The vowel is only there for the
   * pronunciation (التقاء الساكنين); the word's own ending is still the sukun. Applies to the words
   * whose i'rab note says so, from {@link MOVED_SUKUN_FROM_DAY} on.
   */
  movedSukun: true,
};

/**
 * First day graded with {@link RULES.movedSukun}. Days already played (and tomorrow, already on the
 * site) keep the grading they were played with.
 */
export const MOVED_SUKUN_FROM_DAY = 13;

/** An i'rab note saying the word's final sukun was moved: «وحُرّك بالكسر لالتقاء الساكنين». */
const MOVED_NOTE = /(?:حُر[ِّ]+كت?|كُسرت|ضُمّت)(?: ال[^\s،]+)?(?: بال(?:كسر|فتح|ضم))? لالتقاء الساكنين/;

/**
 * Indices of the words whose final vowel is a moved sukun, from the i'rab notes. The word must end
 * in a plain short vowel and the next word must start with a hamzat wasl, so a note about another
 * letter (يَوْمَئِذٍ، لَا يُغَرَّ) doesn't count.
 */
export function movedSukunWords(words: Word[], irab: string[]): Set<number> {
  const out = new Set<number>();
  words.forEach((word, w) => {
    const last = word.letters[word.letters.length - 1];
    const next = words[w + 1];
    if (
      MOVED_NOTE.test(irab[w] ?? "") &&
      next?.letters[0]?.char === "ا" &&
      !last.mark.shadda &&
      (last.mark.vowel === "a" || last.mark.vowel === "u" || last.mark.vowel === "i")
    ) {
      out.add(w);
    }
  });
  return out;
}

export type RuleId =
  | "required"
  | "sukun"
  | "before-madd"
  | "pausal"
  | "moved-sukun"
  | "fixed-alif"
  | "fixed-madd"
  | "fixed-dagger"
  | "fixed-lam-shamsiya";

export type Spec =
  | { graded: false; rule: RuleId }
  | {
      graded: true;
      /** The reference mark: what a perfect answer looks like. */
      expected: Mark;
      /** A bare letter is also accepted. */
      emptyOk: boolean;
      /** Additional accepted marks besides `expected` (e.g. sukun in pausal position). */
      alsoAccept: Mark[];
      rule: RuleId;
    };

/** Letters that are normally written bare even in fully diacritized text. */
const ALWAYS_BARE = new Set(["ا", "آ", "ى", "ٱ"]);

const MADD_FOR: Record<string, "a" | "u" | "i"> = { ا: "a", ى: "a", و: "u", ي: "i" };

function next(word: Word, i: number): Letter | undefined {
  return word.letters[i + 1];
}

/**
 * True if the alif at index k is a hamzat wasl after a one-letter prefix (the alif of ال, or of a
 * verb/noun like اعتقاد): it is not a long vowel, so the prefix's vowel stays required.
 */
function isArticleAlif(word: Word, k: number): boolean {
  if (k !== 1 || word.letters[k].char !== "ا") return false;
  const next = word.letters[k + 1];
  if (!next) return false;
  // ال after a prefix: وَالْبيت، كَالسَّيف (lam bare or with sukun).
  if (next.char === "ل" && (next.mark.vowel === null || next.mark.vowel === "o") && !next.mark.shadda) return true;
  // Hamzat wasl before a vowelless or doubled letter: وَاعْتِقَادِي، فَاخْتَارِي، وَاتَّقُوا. A long
  // alif is always followed by a voweled letter (قَالَ), so this can't misfire on a real madd.
  return next.mark.vowel === "o" || next.mark.shadda;
}

/** Why a bare letter is allowed to be bare, or null if it must carry a mark. */
function bareReason(word: Word, i: number): RuleId | null {
  const l = word.letters[i];
  if (ALWAYS_BARE.has(l.char)) return "fixed-alif";
  // هٰذا، ذٰلك، لٰكن: the dagger alif is the vowel; the letter carries no other mark.
  if (l.dagger) return "fixed-dagger";
  const prev = word.letters[i - 1];
  if ((l.char === "و" || l.char === "ي") && prev && prev.mark.vowel === MADD_FOR[l.char]) {
    return "fixed-madd";
  }
  // لام شمسية: الشَّمس — the lam is silent; the following letter carries the shadda.
  if (l.char === "ل" && next(word, i)?.mark.shadda) return "fixed-lam-shamsiya";
  return null;
}

/**
 * Computes the grading spec for every letter of a reference sentence.
 * `movedSukun`: words (see {@link movedSukunWords}) whose final vowel may also be written as sukun.
 * Throws {@link ArabicParseError} when the reference is not fully diacritized.
 */
export function specsFor(words: Word[], movedSukun: ReadonlySet<number> = new Set()): Spec[][] {
  return words.map((word, w) => {
    const isLastWord = w === words.length - 1;
    return word.letters.map((l, i): Spec => {
      if (isEmptyMark(l.mark)) {
        const reason = bareReason(word, i);
        if (!reason) {
          throw new ArabicParseError(
            `الكلمة ${w + 1}: الحرف «${l.char}» (رقم ${i + 1}) بلا تشكيل / letter ${i + 1} of word ${w + 1} has no diacritic`,
            w,
          );
        }
        return { graded: false, rule: reason };
      }
      const isFinal = isLastWord && i === word.letters.length - 1;
      if (isFinal && RULES.pausalFinal) {
        return {
          graded: true,
          expected: l.mark,
          emptyOk: true,
          alsoAccept: [{ shadda: l.mark.shadda, vowel: "o" }],
          rule: "pausal",
        };
      }
      const isWordFinal = i === word.letters.length - 1;
      if (isWordFinal && RULES.movedSukun && movedSukun.has(w)) {
        return {
          graded: true,
          expected: l.mark,
          emptyOk: false,
          alsoAccept: [{ shadda: false, vowel: "o" }],
          rule: "moved-sukun",
        };
      }
      if (l.mark.vowel === "o" && !l.mark.shadda && RULES.sukunOptional && !isWordFinal) {
        return { graded: true, expected: l.mark, emptyOk: true, alsoAccept: [], rule: "sukun" };
      }
      const n = next(word, i);
      if (
        RULES.vowelBeforeMaddOptional &&
        !l.mark.shadda &&
        n &&
        isEmptyMark(n.mark) &&
        MADD_FOR[n.char] !== undefined &&
        MADD_FOR[n.char] === l.mark.vowel &&
        !isArticleAlif(word, i + 1)
      ) {
        return { graded: true, expected: l.mark, emptyOk: true, alsoAccept: [], rule: "before-madd" };
      }
      return { graded: true, expected: l.mark, emptyOk: false, alsoAccept: [], rule: "required" };
    });
  });
}

export const RULE_LABELS: Record<RuleId, { ar: string; en: string }> = {
  required: { ar: "مطلوب", en: "required" },
  sukun: { ar: "سكون (اختياري)", en: "sukun (optional)" },
  "before-madd": { ar: "قبل حرف مد (اختياري)", en: "before long vowel (optional)" },
  pausal: { ar: "وقف (يقبل السكون)", en: "pausal (sukun accepted)" },
  "moved-sukun": { ar: "التقاء الساكنين (يقبل السكون)", en: "moved sukun (sukun accepted)" },
  "fixed-alif": { ar: "ألف (لا يُشكَّل)", en: "alif (not graded)" },
  "fixed-madd": { ar: "حرف مد (لا يُشكَّل)", en: "long vowel (not graded)" },
  "fixed-dagger": { ar: "ألف خنجرية (لا تُشكَّل)", en: "dagger alif (not graded)" },
  "fixed-lam-shamsiya": { ar: "لام شمسية (لا تُشكَّل)", en: "sun-letter lam (not graded)" },
};
