import { describe, expect, it } from "vitest";
import {
  ArabicParseError,
  DAMMA,
  FATHA,
  SHADDA,
  parseSentence,
  letterTexts,
  sentenceToString,
  skeleton,
  tanweenCarrierOf,
  wordToString,
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

  it("accepts tanween fath on the letter or on the final alif", () => {
    const onLetter = parseSentence("بَارِدًا")[0];
    const onAlif = parseSentence("بَارِداً")[0];
    expect(onAlif).toEqual(onLetter);
    expect(onAlif.letters[3].mark.vowel).toBe("an");
    expect(onAlif.letters[4].mark).toEqual({ shadda: false, vowel: null });
    // with shadda on the carrier
    expect(parseSentence("حَقّاً")[0].letters[1].mark).toEqual({ shadda: true, vowel: "an" });
  });

  it("rejects fathatan on the alif when the letter before already has a vowel", () => {
    expect(() => parseSentence("بَارِدَاً")).toThrow(ArabicParseError);
  });

  it("displays tanween fath on the final alif", () => {
    const [w] = parseSentence("بَارِدًا");
    const texts = letterTexts(w);
    expect(texts[3]).toBe("د");
    expect(texts[4]).toBe("اً");
    expect(wordToString(w)).toBe("بَارِداً".normalize("NFC"));
    expect(tanweenCarrierOf(w, 4)).toBe(3);
    expect(tanweenCarrierOf(w, 1)).toBeNull();
    // a guess without tanween leaves the alif bare
    expect(letterTexts(w, w.letters.map(() => ({ shadda: false, vowel: "u" })))[4]).toBe("اُ");
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
