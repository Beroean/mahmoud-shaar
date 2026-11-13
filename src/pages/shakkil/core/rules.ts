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
};

export type RuleId =
  | "required"
  | "sukun"
  | "before-madd"
  | "pausal"
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
 * True if the alif at index k is the alif of ال after a one-letter prefix (وَالْ، فَالْ، كَالْ،
 * بِالْ): it is not a long vowel, so the prefix's vowel stays required. Told apart from a real madd
 * (قَالَ) by the lam after it, which is bare or carries sukun.
 */
function isArticleAlif(word: Word, k: number): boolean {
  const lam = word.letters[k + 1];
  return k === 1 && word.letters[k].char === "ا" && lam?.char === "ل" && (lam.mark.vowel === null || lam.mark.vowel === "o") && !lam.mark.shadda;
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
 * Throws {@link ArabicParseError} when the reference is not fully diacritized.
 */
export function specsFor(words: Word[]): Spec[][] {
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
  "fixed-alif": { ar: "ألف (لا يُشكَّل)", en: "alif (not graded)" },
  "fixed-madd": { ar: "حرف مد (لا يُشكَّل)", en: "long vowel (not graded)" },
  "fixed-dagger": { ar: "ألف خنجرية (لا تُشكَّل)", en: "dagger alif (not graded)" },
  "fixed-lam-shamsiya": { ar: "لام شمسية (لا تُشكَّل)", en: "sun-letter lam (not graded)" },
};
