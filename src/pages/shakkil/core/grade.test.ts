import { describe, expect, it } from "vitest";
import { type Mark, parseSentence } from "./arabic";
import { type Guess, emptyGuess, grade, gradeLetter } from "./grade";
import { compilePuzzle } from "./puzzle";
import { RULES, type Spec, specsFor } from "./rules";

const m = (vowel: Mark["vowel"], shadda = false): Mark => ({ shadda, vowel });
const E = m(null);

function specs(text: string): Spec[][] {
  return specsFor(parseSentence(text));
}

/** Guess = the marks of another diacritization of the same letters. */
function guessOf(text: string): Guess {
  return parseSentence(text).map((w) => w.letters.map((l) => l.mark));
}

function puzzle(text: string, alts: string[] = []) {
  const n = text.split(/\s+/).length;
  const { puzzle, errors } = compilePuzzle({ number: 1, text, alts, irab: Array(n).fill("x") });
  expect(errors).toEqual([]);
  return puzzle!;
}

describe("rules: which letters are graded", () => {
  it("does not grade bare alif, alif maqsura and madd letters", () => {
    const s = specs("إِلَى الْبَيْتِ قَالُوا شَيْئًا").flat();
    const fixed = s.filter((x) => !x.graded).map((x) => x.rule);
    // ى of إلى, ا of ال, ا of قا, و of لوا, ا after it, ا after tanween
    expect(fixed).toEqual(["fixed-alif", "fixed-alif", "fixed-alif", "fixed-madd", "fixed-alif", "fixed-alif"]);
  });

  it("does not grade a letter carrying a dagger alif", () => {
    const [w] = specs("هٰذَا كِتَابٌ");
    expect(w[0]).toEqual({ graded: false, rule: "fixed-dagger" });
    expect(w[1]).toMatchObject({ graded: true, rule: "before-madd" });
  });

  it("does not grade the silent lam of ال before a sun letter", () => {
    const [w] = specs("الشَّمْسُ مُشْرِقَةٌ");
    expect(w[1]).toEqual({ graded: false, rule: "fixed-lam-shamsiya" });
  });

  it("makes sukun optional", () => {
    const [, w] = specs("ذَهَبَ الْوَلَدُ");
    expect(w[1]).toMatchObject({ graded: true, emptyOk: true, rule: "sukun" });
  });

  it("still requires a word-final sukun (jazm / mabni)", () => {
    const [w1, w2] = specs("لَمْ يَذْهَبْ");
    expect(w1[1]).toMatchObject({ emptyOk: false, rule: "required" });
    expect(w2[1]).toMatchObject({ emptyOk: true, rule: "sukun" });
    expect(w2[3]).toMatchObject({ emptyOk: false, rule: "required" });
  });

  it("makes a vowel before its long-vowel letter optional", () => {
    const [w] = specs("كِتَابًا مُفِيدًا");
    expect(w[1]).toMatchObject({ emptyOk: true, rule: "before-madd" });
  });

  it("keeps a prefix vowel before the alif of ال required", () => {
    const [w1, w2, w3] = specs("كَالسَّيْفِ وَالْبَيْتِ قَالَ");
    expect(w1[0]).toMatchObject({ emptyOk: false, rule: "required" });
    expect(w2[0]).toMatchObject({ emptyOk: false, rule: "required" });
    expect(w3[0]).toMatchObject({ emptyOk: true, rule: "before-madd" }); // real long vowel
  });

  it("requires shadda and the case ending", () => {
    const [w1, w2] = specs("إِنَّ الْعِلْمَ");
    expect(w1[1]).toMatchObject({ emptyOk: false, rule: "required" });
    expect(w2[4]).toMatchObject({ emptyOk: false, rule: "required" });
  });

  it("rejects a reference that leaves a letter bare", () => {
    expect(() => specs("ذهب الْوَلَدُ")).toThrow(/no diacritic/);
    expect(() => specs("الْوَلَد")).toThrow(/no diacritic/);
  });

  it("can accept pausal sukun on the final letter when enabled", () => {
    RULES.pausalFinal = true;
    try {
      const s = specs("ذَهَبَ الْوَلَدُ");
      const last = s[1][4];
      expect(gradeLetter(m("o"), last)).toBe("correct");
      expect(gradeLetter(E, last)).toBe("correct");
      expect(gradeLetter(m("u"), last)).toBe("correct");
    } finally {
      RULES.pausalFinal = false;
    }
  });
});

describe("gradeLetter", () => {
  const required: Spec = { graded: true, expected: m("a", true), emptyOk: false, alsoAccept: [], rule: "required" };
  const sukun: Spec = { graded: true, expected: m("o"), emptyOk: true, alsoAccept: [], rule: "sukun" };
  const tanween: Spec = { graded: true, expected: m("un"), emptyOk: false, alsoAccept: [], rule: "required" };

  it.each<[string, Mark, Spec, string]>([
    ["exact match", m("a", true), required, "correct"],
    ["bare on required", E, required, "wrong"],
    ["right vowel, missing shadda", m("a"), required, "partial"],
    ["shadda only", m(null, true), required, "partial"],
    ["shadda, wrong vowel", m("i", true), required, "partial"],
    ["wrong vowel, no shadda", m("u"), required, "wrong"],
    ["bare on optional sukun", E, sukun, "correct"],
    ["sukun on optional sukun", m("o"), sukun, "correct"],
    ["vowel on optional sukun", m("a"), sukun, "wrong"],
    ["plain vowel for tanween", m("u"), tanween, "partial"],
    ["other tanween", m("an"), tanween, "wrong"],
  ])("%s", (_, guess, spec, expected) => {
    expect(gradeLetter(guess, spec)).toBe(expected);
  });

  it("marks ungraded letters as fixed regardless of the guess", () => {
    expect(gradeLetter(m("a"), { graded: false, rule: "fixed-alif" })).toBe("fixed");
  });
});

describe("grade", () => {
  const text = "ذَهَبَ الْوَلَدُ إِلَى الْمَدْرَسَةِ";

  it("solves with the exact reference", () => {
    const p = puzzle(text);
    expect(grade(guessOf(text), p.variants).solved).toBe(true);
  });

  it("solves with optional marks left out", () => {
    const p = puzzle(text);
    expect(grade(guessOf("ذَهَبَ الوَلَدُ إِلى المَدرَسَةِ"), p.variants).solved).toBe(true);
  });

  it("does not solve an empty guess", () => {
    const p = puzzle(text);
    const r = grade(emptyGuess(p.words), p.variants);
    expect(r.solved).toBe(false);
    expect(r.letters[0]).toEqual(["wrong", "wrong", "wrong"]);
  });

  it("flags a wrong case ending", () => {
    const p = puzzle(text);
    const r = grade(guessOf("ذَهَبَ الْوَلَدَ إِلَى الْمَدْرَسَةِ"), p.variants);
    expect(r.solved).toBe(false);
    expect(r.letters[1][4]).toBe("wrong");
    expect(r.letters[1].slice(0, 4)).toEqual(["fixed", "correct", "correct", "correct"]);
  });

  it("accepts an alternative diacritization and reports which one matched", () => {
    const p = puzzle("قَرَأْتُ الْكِتَابَ", ["قَرَأْتَ الْكِتَابَ"]);
    const r = grade(guessOf("قَرَأْتَ الْكِتَابَ"), p.variants);
    expect(r).toMatchObject({ solved: true, variant: 1 });
  });

  it("picks the closest variant when none match", () => {
    const p = puzzle("قَرَأْتُ الْكِتَابَ", ["قَرَأْتَ الْكِتَابَ"]);
    const r = grade(guessOf("قَرَأْتَ الْكِتَابُ"), p.variants);
    expect(r.solved).toBe(false);
    expect(r.variant).toBe(1);
  });
});

describe("compilePuzzle", () => {
  it("checks word count, i'rab count and alts", () => {
    const one = compilePuzzle({ number: 1, text: "ذَهَبَ", irab: ["x"] });
    expect(one.errors.join()).toMatch(/1 words/);
    const irab = compilePuzzle({ number: 1, text: "ذَهَبَ الْوَلَدُ", irab: ["x"] });
    expect(irab.errors.join()).toMatch(/1 i'rab notes for 2 words/);
    const alt = compilePuzzle({ number: 1, text: "ذَهَبَ الْوَلَدُ", irab: ["x", "y"], alts: ["ذَهَبَ الْبِنْتُ"] });
    expect(alt.errors.join()).toMatch(/not the same sentence/);
  });

  it("rejects an unknown source", () => {
    const r = compilePuzzle({ number: 1, text: "ذَهَبَ الْوَلَدُ", irab: ["x", "y"], source: "web" });
    expect(r.errors.join()).toMatch(/unknown source/);
  });
});
