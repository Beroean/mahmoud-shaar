import { describe, expect, it } from "vitest";
import { HEAVY, LIGHT, difficulty, levelsByScore } from "./difficulty";
import { type PuzzleSource, compilePuzzle } from "./puzzle";

const score = (src: Partial<PuzzleSource> & { text: string; irab: string[] }) =>
  difficulty(compilePuzzle({ number: 1, ...src }).puzzle!);

describe("difficulty", () => {
  it("counts the marks the player must enter", () => {
    // ذَ هَ بَ + الْ وَ لَ دُ: sukun on the lam and the article alif are free.
    expect(score({ text: "ذَهَبَ الْوَلَدُ", irab: ["فعل", "فاعل"] })).toMatchObject({ marks: 6, traps: [], score: 6 });
  });

  it("adds points for rules named in the i'rab, once per sentence", () => {
    const d = score({
      text: "صَلَّيْتُ فِي مَسَاجِدَ كَثِيرَةٍ",
      irab: ["فعل", "حرف", "اسم مجرور وعلامة جره الفتحة لأنه ممنوع من الصرف", "نعت مجرور"],
    });
    expect(d.traps).toEqual(["diptote"]);
    expect(d.score).toBe(d.marks + HEAVY);
    const kana = score({ text: "كَانَ الطَّقْسُ بَارِداً", irab: ["فعل ناقص", "اسم «كان» مرفوع", "خبر «كان» منصوب"] });
    expect(kana.traps).toEqual(["nawasikh"]);
    expect(kana.score).toBe(kana.marks + LIGHT);
  });

  it("takes points off for a case ending an alt also accepts, but not for person forms", () => {
    const irab = ["مفعول به لفعل محذوف تقديره قرأت", "فعل وفاعل"];
    const both = score({ text: "الْكِتَابَ قَرَأْتُهُ", irab, alts: ["الْكِتَابُ قَرَأْتُهُ"] });
    expect(both.defused).toBe(1);
    expect(both.score).toBe(both.marks);
    const person = score({ text: "سَأَزُورُكَ غَداً", irab: ["فعل", "ظرف"], alts: ["سَأَزُورُكِ غَداً"] });
    expect(person.defused).toBe(0);
  });
});

describe("levelsByScore", () => {
  it("splits into thirds, easiest first, ties by marks then ID", () => {
    const items = [9, 1, 5, 3, 7, 2].map((s, k) => ({ id: `p${k}`, score: s, marks: 0 }));
    const levels = levelsByScore(items);
    expect(["p1", "p5"].map((id) => levels.get(id))).toEqual([1, 1]);
    expect(["p3", "p2"].map((id) => levels.get(id))).toEqual([2, 2]);
    expect(["p4", "p0"].map((id) => levels.get(id))).toEqual([3, 3]);
  });
});
