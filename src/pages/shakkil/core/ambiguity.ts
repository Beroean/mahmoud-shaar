/**
 * Finds letters whose vowel depends on who is speaking or being addressed, which the sentence alone
 * often doesn't say: the subject تاء (قَرَأْتُ / قَرَأْتَ / قَرَأْتِ, أَنْتَ / أَنْتِ) and the
 * second-person كاف (كِتَابُكَ / كِتَابُكِ). A puzzle should accept each reading (`vary` or `alts`)
 * or say which one it means (`context`).
 *
 * This is a heuristic for authors (`npm run puzzle:check`, the PR report), not a CI failure: a few
 * words end like this without a pronoun (تَرَكَ، بَيْتُ), and some are listed below. Words the
 * rest of the sentence pins down (ما زِلْتُ أَتَذَكَّرُ: أتذكّر is "I") go in the puzzle's `fixed`.
 */
import { DAGGER_ALIF, type Vowel, type Word, skeleton, wordToString } from "./arabic";
import type { Puzzle } from "./puzzle";

export interface Ambiguity {
  word: number;
  letter: number;
  kind: "speaker" | "addressee";
}

/** Object pronouns that can follow the subject تاء: قَرَأْتُهُ، رَأَيْتُكَ، سَمِعْتُنِي. */
const AFTER_TA = new Set(["", "ه", "ها", "هم", "هما", "هن", "ك", "كم", "كما", "ني", "نا"]);

/** Words that end like a pronoun suffix but aren't one. */
const NOT_PRONOUN = new Set([
  // ـتُ / ـتَ in nouns and particles
  "بيت", "وقت", "صمت", "بنت", "أخت", "زيت", "موت", "صوت", "سبت", "ليت", "تحت", "ثبت",
  // ـكَ that belongs to the word
  "ذلك", "تلك", "كذلك", "هنالك", "أولئك", "ذانك", "ترك", "ملك", "ضحك", "شارك", "بارك", "سلك",
  "هلك", "أدرك", "أمسك", "تحرك", "تدارك", "اشترك", "شك", "فك", "نبك", "يبك", "تبك",
]);

const PERSON_VOWELS = new Set<Vowel | null>(["a", "u", "i"]);

/** True if the word has the article (after an optional و/ف/ب/ك/ل): a pronoun suffix can't follow it. */
function hasArticle(word: Word): boolean {
  const s = word.letters.map((l) => l.char).join("");
  return /^([وفبكل]|وب|فب|ول|فل)?ال/.test(s) || /^لل/.test(s);
}

export function ambiguities(puzzle: Puzzle): Ambiguity[] {
  if (puzzle.source === "quran" || puzzle.context) return [];
  const out: Ambiguity[] = [];
  const pinned = new Set((puzzle.fixed ?? []).map((f) => f.trim()));
  puzzle.words.forEach((word, w) => {
    if (hasArticle(word)) return;
    const bare = skeleton([word]).replaceAll(DAGGER_ALIF, "");
    if (pinned.has(word.letters.map((l) => l.char).join(""))) return;
    if (NOT_PRONOUN.has(bare) || NOT_PRONOUN.has(bare.replace(/^[وف]/, ""))) return;
    const L = word.letters;
    const candidates: Ambiguity[] = [];
    L.forEach((l, i) => {
      if (l.mark.shadda || !PERSON_VOWELS.has(l.mark.vowel)) return;
      const rest = L.slice(i + 1).map((x) => x.char).join("");
      if (l.char === "ت" && i >= 2 && L[i - 1].mark.vowel === "o" && AFTER_TA.has(rest)) {
        candidates.push({ word: w, letter: i, kind: "speaker" });
      }
      if (l.char === "ك" && i === L.length - 1 && i >= 1 && l.mark.vowel !== "u") {
        candidates.push({ word: w, letter: i, kind: "addressee" });
      }
    });
    for (const c of candidates) {
      const vowels = new Set(puzzle.variants.map((v) => v.words[c.word].letters[c.letter].mark.vowel));
      if (vowels.size < 2) out.push(c);
    }
  });
  return out;
}

/** One bilingual line per ambiguity, for the check tool, the PR report and the review page. */
export function describeAmbiguity(puzzle: Puzzle, { word, kind }: Ambiguity): string {
  const w = wordToString(puzzle.words[word]);
  return kind === "speaker"
    ? `الكلمة ${word + 1} «${w}»: تاء الفاعل تحتمل الضم والفتح والكسر. أضف vary أو context أو fixed / word ${word + 1}: subject ت could be تُ, تَ or تِ; add vary, context or fixed`
    : `الكلمة ${word + 1} «${w}»: كاف الخطاب تحتمل الفتح والكسر. أضف vary أو context أو fixed / word ${word + 1}: addressee ك could be كَ or كِ; add vary, context or fixed`;
}
