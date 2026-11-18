/**
 * A difficulty score for a puzzle, used to set its level (easy / medium / hard) and to check that
 * each three-sentence day gets harder. Higher is harder.
 *
 *   score = marks the player must get right
 *         + points for each grammar rule named in the i'rab notes (counted once per sentence):
 *           HEAVY for rules whose ending is hard to guess (ممنوع من الصرف, تمييز, جزم, شرط, …),
 *           LIGHT for common ones most players know (إنّ وأخواتها, جمع المذكر السالم, حال, …)
 *         − HEAVY for each case/mood ending an alt also accepts (the trap is defused:
 *           الْكِتَابَ / الْكِتَابُ قَرَأْتُهُ). Person/gender suffixes (قَرَأْتُ / قَرَأْتَ) don't count:
 *           accepting them removes an unfair guess, not a grammar point.
 *
 * The rules are read from the i'rab notes, so a note has to name its rule for it to count.
 */
import { suffixLetters } from "./ambiguity";
import { compilePuzzle, type Puzzle } from "./puzzle";

export const HEAVY = 6;
export const LIGHT = 2;

/** Grammar rules that make a word's marks hard to guess, matched in the i'rab notes. */
export const TRAPS: { id: string; ar: string; points: number; re: RegExp }[] = [
  // Endings that break the usual pattern.
  { id: "diptote", ar: "ممنوع من الصرف", points: HEAVY, re: /ممنوع من الصرف/ },
  { id: "five-nouns", ar: "الأسماء الخمسة", points: HEAVY, re: /الأسماء الخمسة/ },
  { id: "fem-plural-acc", ar: "جمع مؤنث منصوب بالكسرة", points: HEAVY, re: /نصبه الكسرة/ },
  { id: "jussive", ar: "جزم", points: HEAVY, re: /مجزوم/ },
  { id: "weak-jussive", ar: "حذف حرف العلة", points: HEAVY, re: /حذف حرف العلة/ },
  { id: "subjunctive-an", ar: "نصب بأن مضمرة", points: HEAVY, re: /بـ«أن» المضمرة|بأن مضمرة/ },
  { id: "passive", ar: "المبني للمجهول", points: HEAVY, re: /نائب فاعل|مبني للمجهول/ },
  // Constructions whose case has to be worked out.
  { id: "tamyiz", ar: "تمييز", points: HEAVY, re: /تمييز/ },
  { id: "number", ar: "العدد", points: HEAVY, re: /العدد|عدد مركب|مبني على فتح الجزأين/ },
  { id: "second-object", ar: "ظنّ وأعلم (مفعولان أو ثلاثة)", points: HEAVY, re: /مفعول به (ثانٍ|ثان|ثالث)/ },
  { id: "exception", ar: "استثناء", points: HEAVY, re: /مستثنى/ },
  { id: "la-nafiya-lil-jins", ar: "لا النافية للجنس", points: HEAVY, re: /للجنس/ },
  { id: "ma-hijaziya", ar: "ما الحجازية", points: HEAVY, re: /حجازية|عمل «ليس»/ },
  { id: "restriction", ar: "الحصر (إلا، إنما)", points: HEAVY, re: /أداة حصر|كافّة ومكفوفة|كافة ومكفوفة|كافة/ },
  { id: "maf-ul-maahu", ar: "مفعول معه", points: HEAVY, re: /مفعول معه/ },
  { id: "exclamation", ar: "تعجب", points: HEAVY, re: /تعجب/ },
  { id: "praise-blame", ar: "مدح أو ذم", points: HEAVY, re: /للمدح|للذم|فعل مدح|فعل ذم|لإنشاء (المدح|الذم)|المخصوص ب/ },
  { id: "warning", ar: "تحذير أو إغراء", points: HEAVY, re: /تحذير|إغراء/ },
  { id: "condition", ar: "شرط", points: HEAVY, re: /شرط/ },
  { id: "elided", ar: "عامل محذوف", points: HEAVY, re: /لفعل محذوف|محذوف تقديره/ },
  // Common rules most players know.
  { id: "sound-plural-dual", ar: "مثنى أو جمع سالم", points: LIGHT, re: /علامة (رفعه|نصبه|جره) (الألف|الواو|الياء)|حذف النون|ثبوت النون/ },
  { id: "nawasikh", ar: "إنّ وكان وأخواتهما", points: LIGHT, re: /(اسم|خبر) «[^»]+»/ },
  { id: "hal", ar: "حال", points: LIGHT, re: /(^|[\s،(])حال(ية)?($|[\s،)])/m },
  { id: "badal", ar: "بدل", points: LIGHT, re: /(^|[\s،])بدل /m },
  { id: "absolute-object", ar: "مفعول مطلق أو لأجله", points: LIGHT, re: /مفعول (مطلق|لأجله)/ },
  { id: "vocative", ar: "منادى", points: LIGHT, re: /منادى/ },
];

export interface Difficulty {
  score: number;
  /** Marks the player must enter (graded letters that may not be left bare). */
  marks: number;
  /** Rules found in the i'rab notes, once each. */
  traps: string[];
  /** Case/mood endings an alt also accepts. */
  defused: number;
}

export function difficulty(puzzle: Puzzle): Difficulty {
  let marks = 0;
  for (const ws of puzzle.variants[0].specs) for (const s of ws) if (s.graded && !s.emptyOk) marks++;

  const notes = puzzle.irab.join("\n");
  const found = TRAPS.filter((t) => t.re.test(notes));

  // Only `alts` defuse a trap: recompile without `vary`, and skip person/gender suffix letters.
  let defused = 0;
  if (puzzle.alts?.length) {
    const alts = compilePuzzle({ ...puzzle, vary: undefined }).puzzle;
    puzzle.words.forEach((word, w) => {
      const suffix = new Set(suffixLetters(word, w).map((s) => s.letter));
      word.letters.forEach((_, i) => {
        if (suffix.has(i) || !alts) return;
        if (new Set(alts.variants.map((v) => JSON.stringify(v.words[w].letters[i].mark))).size > 1) defused++;
      });
    });
  }

  const score = marks + found.reduce((s, t) => s + t.points, 0) - HEAVY * defused;
  return { score, marks, traps: found.map((t) => t.id), defused };
}

/**
 * Levels from scores: the easiest third is 1, the middle third 2, the hardest third 3, so every
 * easy puzzle scores at most every medium one and every medium at most every hard one. Ties are
 * broken by marks (longer is harder), then by ID.
 */
export function levelsByScore<T extends { id: string; score: number; marks: number }>(items: T[]): Map<string, 1 | 2 | 3> {
  const sorted = [...items].sort((a, b) => a.score - b.score || a.marks - b.marks || a.id.localeCompare(b.id));
  const n = sorted.length;
  return new Map(sorted.map((it, k) => [it.id, (k < n / 3 ? 1 : k < (2 * n) / 3 ? 2 : 3) as 1 | 2 | 3]));
}
