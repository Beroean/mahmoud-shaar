import { describe, expect, it } from "vitest";
import {
  ArabicParseError,
  DAMMA,
  FATHA,
  SHADDA,
  parseSentence,
  sentenceToString,
  skeleton,
} from "./arabic";

describe("parseSentence", () => {
  it("splits words and attaches marks to letters", () => {
    const [w1, w2] = parseSentence("ذَهَبَ الْوَلَدُ");
    expect(w1.letters.map((l) => l.char).join("")).toBe("ذهب");
    expect(w1.letters.map((l) => l.mark.vowel)).toEqual(["a", "a", "a"]);
    expect(w2.letters[0].mark).toEqual({ shadda: false, vowel: null });
    expect(w2.letters[1].mark.vowel).toBe("o");
    expect(w2.letters[4].mark.vowel).toBe("u");
  });

  it("treats shadda+vowel and vowel+shadda the same", () => {
    const a = parseSentence("ش" + SHADDA + FATHA)[0].letters[0].mark;
    const b = parseSentence("ش" + FATHA + SHADDA)[0].letters[0].mark;
    expect(a).toEqual({ shadda: true, vowel: "a" });
    expect(b).toEqual(a);
  });

  it("parses tanween", () => {
    const ls = parseSentence("كِتَابٌ كِتَابًا كِتَابٍ").map((w) => w.letters[3].mark.vowel);
    expect(ls).toEqual(["un", "an", "in"]);
  });

  it("keeps dagger alif as part of the letter", () => {
    const [w] = parseSentence("هٰذَا");
    expect(w.letters[0]).toMatchObject({ char: "ه", dagger: true, mark: { vowel: null } });
    expect(skeleton([w])).toBe("هٰذا");
  });

  it("ignores tatweel", () => {
    expect(parseSentence("كـتـب")[0].letters.map((l) => l.char).join("")).toBe("كتب");
  });

  it("normalizes decomposed hamza/madda (NFD input)", () => {
    const nfd = "آمَنَ"; // ا + madda + ...
    expect(parseSentence(nfd)[0].letters[0].char).toBe("آ");
  });

  it("splits punctuation off word edges", () => {
    const [w1, w2] = parseSentence("«نَعَمْ»، قَالَ.");
    expect(w1).toMatchObject({ prefix: "«", suffix: "»،" });
    expect(w2.suffix).toBe(".");
  });

  it("round-trips (up to canonical mark order)", () => {
    const s = "الشَّمْسُ مُشْرِقَةٌ";
    expect(sentenceToString(parseSentence(s)).normalize("NFC")).toBe(s.normalize("NFC"));
  });

  it.each([
    ["two vowels", "كَُ"],
    ["double shadda", "ش" + SHADDA + SHADDA],
    ["shadda with sukun", "شّْ"],
    ["mark before letter", FATHA + "ك"],
    ["latin letters", "abc كَ"],
    ["punctuation inside a word", "كَ،تَبَ"],
    ["empty", "   "],
  ])("rejects %s", (_, text) => {
    expect(() => parseSentence(text)).toThrow(ArabicParseError);
  });

  it("does not confuse damma with dammatan", () => {
    expect(parseSentence("ك" + DAMMA)[0].letters[0].mark.vowel).toBe("u");
  });
});
