import { describe, expect, it } from "vitest";
import { ambiguities } from "./ambiguity";
import { parseSentence, sentenceToString } from "./arabic";
import { grade } from "./grade";
import { MAX_VARIANTS, type PuzzleSource, compilePuzzle } from "./puzzle";

function compile(src: Partial<PuzzleSource> & { text: string }) {
  const n = src.text.trim().split(/\s+/).length;
  return compilePuzzle({ number: 1, irab: Array(n).fill("x"), ...src });
}

const guessOf = (text: string) => parseSentence(text).map((w) => w.letters.map((l) => l.mark));
const solves = (src: Partial<PuzzleSource> & { text: string }, guess: string) => {
  const { puzzle, errors } = compile(src);
  expect(errors).toEqual([]);
  return grade(guessOf(guess), puzzle!.variants).solved;
};

describe("vary", () => {
  const src = {
    text: "سَلَّمْتُ عَلَى أَخِيكَ",
    vary: [["سَلَّمْتُ", "سَلَّمْتَ", "سَلَّمْتِ"], ["أَخِيكَ", "أَخِيكِ"]],
  };

  it("accepts every combination of the groups", () => {
    const { puzzle } = compile(src);
    expect(puzzle!.variants.map((v) => sentenceToString(v.words))).toHaveLength(6);
    expect(solves(src, "سَلَّمْتِ عَلَى أَخِيكِ")).toBe(true);
    expect(solves(src, "سَلَّمْتَ عَلَى أَخِيكَ")).toBe(true);
    expect(solves(src, "سَلَّمْتَ عَلَى أَخِيكُ")).toBe(false);
  });

  it("keeps the main text as variant 0 and the text's punctuation", () => {
    const { puzzle } = compile({ text: "كَمْ كِتَابٍ قَرَأْتُ!", vary: [["قَرَأْتُ", "قَرَأْتَ"]] });
    expect(sentenceToString(puzzle!.variants[0].words)).toBe("كَمْ كِتَابٍ قَرَأْتُ!");
    expect(sentenceToString(puzzle!.variants[1].words)).toBe("كَمْ كِتَابٍ قَرَأْتَ!");
  });

  it("combines with alts", () => {
    const s = { text: "الْكِتَابَ قَرَأْتُهُ", alts: ["الْكِتَابُ قَرَأْتُهُ"], vary: [["قَرَأْتُهُ", "قَرَأْتَهُ"]] };
    expect(compile(s).puzzle!.variants).toHaveLength(4);
    expect(solves(s, "الْكِتَابُ قَرَأْتَهُ")).toBe(true);
  });

  it("varies a run of words together", () => {
    const s = { text: "لَوْ دَرَسْتَ لَنَجَحْتَ", vary: [["دَرَسْتَ لَنَجَحْتَ", "دَرَسْتِ لَنَجَحْتِ"]] };
    expect(solves(s, "لَوْ دَرَسْتِ لَنَجَحْتِ")).toBe(true);
    expect(solves(s, "لَوْ دَرَسْتِ لَنَجَحْتَ")).toBe(false);
  });

  it("rejects bad groups", () => {
    const err = (vary: unknown) => compile({ text: "سَلَّمْتُ عَلَى أَخِيكَ", vary: vary as string[][] }).errors;
    expect(err([["سَلَّمْتُ"]])).not.toEqual([]); // one form
    expect(err([["كَتَبْتُ", "كَتَبْتَ"]])).not.toEqual([]); // not in the text
    expect(err([["سَلَّمْتَ", "سَلَّمْتِ"]])).not.toEqual([]); // no form matches the text
    expect(err([["سَلَّمْتُ", "سلمت"]])).not.toEqual([]); // undiacritized form
    expect(err([["سَلَّمْتُ", "سَلَّمْتَ"], ["سَلَّمْتُ عَلَى", "سَلَّمْتَ عَلَى"]])).not.toEqual([]); // overlap
  });

  it("caps the number of variants", () => {
    // 3 × 3 × 3 × 3 = 81 readings.
    const verbs = ["رَأَيْتُ", "وَسَمِعْتُ", "وَقَرَأْتُ", "وَكَتَبْتُ"];
    const ta = (w: string) => ["ُ", "َ", "ِ"].map((v) => w.slice(0, -1) + v);
    const { errors } = compile({ text: verbs.join(" "), vary: verbs.map(ta) });
    expect(errors.join()).toContain(`at most ${MAX_VARIANTS}`);
  });
});

describe("ambiguities", () => {
  const flagged = (src: Partial<PuzzleSource> & { text: string }) => ambiguities(compile(src).puzzle!);

  it("flags subject تاء and addressee كاف with a single reading", () => {
    expect(flagged({ text: "قَرَأْتُ كِتَاباً مُفِيداً" })).toEqual([{ word: 0, letter: 3, kind: "speaker" }]);
    expect(flagged({ text: "سَأَزُورُكَ غَداً" })).toMatchObject([{ word: 0, kind: "addressee" }]);
    expect(flagged({ text: "إِذَا أَنْتَ أَكْرَمْتَ الْكَرِيمَ" })).toHaveLength(2);
  });

  it("is satisfied by vary, alts, context or fixed", () => {
    expect(flagged({ text: "قَرَأْتُ كِتَاباً", vary: [["قَرَأْتُ", "قَرَأْتَ"]] })).toEqual([]);
    expect(flagged({ text: "سَأَزُورُكَ غَداً", alts: ["سَأَزُورُكِ غَداً"] })).toEqual([]);
    expect(flagged({ text: "سَأَزُورُكَ غَداً", context: "الخطاب لمذكّر" })).toEqual([]);
    expect(flagged({ text: "مَا زِلْتُ أَتَذَكَّرُ", fixed: ["زلت"] })).toEqual([]);
  });

  it("skips words that only look like a suffix, and the Quran", () => {
    expect(flagged({ text: "الْبَيْتُ قَرِيبٌ" })).toEqual([]);
    expect(flagged({ text: "تَرَكَ ذٰلِكَ الْعَمَلَ" })).toEqual([]);
    expect(flagged({ text: "لَيْتَ الشَّبَابَ يَعُودُ" })).toEqual([]);
    expect(flagged({ text: "قُلْتُ لَهُمْ", source: "quran", ref: "x" })).toEqual([]);
  });

  it("rejects fixed words that are not in the text", () => {
    expect(compile({ text: "قَرَأْتُ كِتَاباً", fixed: ["كتبت"] }).errors).not.toEqual([]);
  });
});
