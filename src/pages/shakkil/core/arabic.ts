/**
 * Arabic text model for the game: parses diacritized text into words → letters → marks.
 *
 * A letter's diacritics are modelled as a structured {@link Mark} (shadda flag + one vowel)
 * rather than a raw codepoint sequence, so "shadda then fatha" and "fatha then shadda"
 * (Unicode canonical order puts the vowel first) are the same thing.
 */

export const FATHATAN = "ً";
export const DAMMATAN = "ٌ";
export const KASRATAN = "ٍ";
export const FATHA = "َ";
export const DAMMA = "ُ";
export const KASRA = "ِ";
export const SHADDA = "ّ";
export const SUKUN = "ْ";
/** Superscript ("dagger") alif, as in هٰذا. Part of the spelling, never graded. */
export const DAGGER_ALIF = "ٰ";
export const TATWEEL = "ـ";

/** a/u/i = fatha/damma/kasra, o = sukun, an/un/in = tanween. */
export type Vowel = "a" | "u" | "i" | "o" | "an" | "un" | "in";

export interface Mark {
  shadda: boolean;
  vowel: Vowel | null;
}

export interface Letter {
  /** The base letter (one codepoint, NFC). */
  char: string;
  mark: Mark;
  /** Carries a dagger alif. Displayed as part of the letter, never graded. */
  dagger: boolean;
}

export interface Word {
  letters: Letter[];
  /** Punctuation before / after the word (displayed, never graded). */
  prefix: string;
  suffix: string;
}

export const VOWEL_CHAR: Record<Vowel, string> = {
  a: FATHA,
  u: DAMMA,
  i: KASRA,
  o: SUKUN,
  an: FATHATAN,
  un: DAMMATAN,
  in: KASRATAN,
};

const CHAR_VOWEL: Record<string, Vowel> = Object.fromEntries(
  Object.entries(VOWEL_CHAR).map(([v, c]) => [c, v as Vowel]),
);

export const EMPTY_MARK: Mark = Object.freeze({ shadda: false, vowel: null }) as Mark;

export const VOWEL_NAMES_AR: Record<Vowel, string> = {
  a: "فتحة",
  u: "ضمة",
  i: "كسرة",
  o: "سكون",
  an: "تنوين فتح",
  un: "تنوين ضم",
  in: "تنوين كسر",
};

/** Arabic letters we accept as base letters: ء..غ, ف..ي, and alif wasla. */
export function isArabicLetter(ch: string): boolean {
  const c = ch.codePointAt(0)!;
  return (c >= 0x0621 && c <= 0x063a) || (c >= 0x0641 && c <= 0x064a) || c === 0x0671;
}

export function isHaraka(ch: string): boolean {
  const c = ch.codePointAt(0)!;
  return c >= 0x064b && c <= 0x0652;
}

/** Punctuation allowed around (not inside) words. */
const PUNCT = new Set([..."،؛؟.!:«»\"'()-…"]);

export class ArabicParseError extends Error {
  /** 0-based word index, if known. */
  readonly word?: number;

  constructor(message: string, word?: number) {
    super(message);
    this.name = "ArabicParseError";
    this.word = word;
  }
}

export function sameMark(a: Mark, b: Mark): boolean {
  return a.shadda === b.shadda && a.vowel === b.vowel;
}

export function isEmptyMark(m: Mark): boolean {
  return !m.shadda && m.vowel === null;
}

/** Renders a mark as combining characters (shadda first, which is what most fonts expect). */
export function markToString(m: Mark): string {
  return (m.shadda ? SHADDA : "") + (m.vowel ? VOWEL_CHAR[m.vowel] : "");
}

export function letterToString(l: Letter, mark: Mark = l.mark): string {
  return l.char + markToString(mark) + (l.dagger ? DAGGER_ALIF : "");
}

export function wordToString(w: Word, marks?: Mark[]): string {
  return w.prefix + letterTexts(w, marks).join("") + w.suffix;
}

export function sentenceToString(words: Word[]): string {
  return words.map((w) => wordToString(w)).join(" ");
}

/** The undiacritized skeleton of a word (base letters + dagger alif), used to compare variants. */
export function skeleton(words: Word[]): string {
  return words
    .map((w) => w.letters.map((l) => l.char + (l.dagger ? DAGGER_ALIF : "")).join(""))
    .join(" ");
}

/** Parses one whitespace-free token into a Word. */
function parseWord(token: string, index: number): Word {
  const chars = [...token];
  let start = 0;
  let end = chars.length;
  while (start < end && PUNCT.has(chars[start])) start++;
  while (end > start && PUNCT.has(chars[end - 1])) end--;
  const prefix = chars.slice(0, start).join("");
  const suffix = chars.slice(end).join("");
  const letters: Letter[] = [];
  const where = `الكلمة ${index + 1} / word ${index + 1} ("${token}")`;

  for (const ch of chars.slice(start, end)) {
    if (ch === TATWEEL) continue;
    if (isArabicLetter(ch)) {
      letters.push({ char: ch, mark: { shadda: false, vowel: null }, dagger: false });
      continue;
    }
    const cur = letters[letters.length - 1];
    if (!cur) {
      throw new ArabicParseError(
        `${where}: علامة تشكيل قبل أي حرف / a diacritic appears before any letter`,
        index,
      );
    }
    if (ch === SHADDA) {
      if (cur.mark.shadda) {
        throw new ArabicParseError(`${where}: شدة مكررة على «${cur.char}» / duplicate shadda`, index);
      }
      cur.mark.shadda = true;
    } else if (ch === DAGGER_ALIF) {
      cur.dagger = true;
    } else if (CHAR_VOWEL[ch]) {
      if (cur.mark.vowel) {
        throw new ArabicParseError(
          `${where}: أكثر من حركة على «${cur.char}» / more than one vowel on one letter`,
          index,
        );
      }
      cur.mark.vowel = CHAR_VOWEL[ch];
    } else if (PUNCT.has(ch)) {
      throw new ArabicParseError(`${where}: علامة ترقيم داخل الكلمة / punctuation inside a word`, index);
    } else {
      const hex = ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0");
      throw new ArabicParseError(
        `${where}: رمز غير مدعوم «${ch}» (U+${hex}) / unsupported character`,
        index,
      );
    }
    if (cur.mark.shadda && cur.mark.vowel === "o") {
      throw new ArabicParseError(`${where}: شدة مع سكون على «${cur.char}» / shadda with sukun`, index);
    }
  }
  if (letters.length === 0) {
    throw new ArabicParseError(`${where}: لا توجد حروف / no letters`, index);
  }
  moveAlifTanweenToCarrier(letters, where, index);
  return { letters, prefix, suffix };
}

/**
 * Tanween fath before a final alif is written two ways: بَارِدًا (on the letter) and بَارِداً (on
 * the alif). Internally it always belongs to the letter before the alif, which is the letter that
 * carries the case ending, so both spellings parse identically.
 */
function moveAlifTanweenToCarrier(letters: Letter[], where: string, index: number) {
  const k = letters.length - 1;
  const alif = letters[k];
  if (k < 1 || alif.char !== "ا" || alif.mark.vowel !== "an" || alif.mark.shadda) return;
  const carrier = letters[k - 1];
  if (carrier.mark.vowel !== null) {
    throw new ArabicParseError(
      `${where}: تنوين الفتح على الألف والحرف قبلها مُشكَّل أيضًا / fathatan on the alif, but «${carrier.char}» already has a vowel`,
      index,
    );
  }
  carrier.mark.vowel = "an";
  alif.mark.vowel = null;
}

/**
 * Display convention for tanween fath before a final alif: true renders بارداً (mark on the alif),
 * false renders باردًا (mark on the letter). Only affects rendering; parsing accepts both.
 */
export const TANWEEN_FATH_ON_ALIF = true;

/** True if letter i is the bare final alif that displays the previous letter's tanween fath. */
function isTanweenAlif(word: Word, i: number): boolean {
  return (
    i === word.letters.length - 1 &&
    i > 0 &&
    word.letters[i].char === "ا" &&
    isEmptyMark(word.letters[i].mark)
  );
}

/**
 * The text to draw for each letter of a word given a set of marks (defaults to the word's own),
 * applying {@link TANWEEN_FATH_ON_ALIF}.
 */
export function letterTexts(word: Word, marks: Mark[] = word.letters.map((l) => l.mark)): string[] {
  const out = word.letters.map((l, i) => letterToString(l, marks[i]));
  const k = word.letters.length - 1;
  if (TANWEEN_FATH_ON_ALIF && isTanweenAlif(word, k) && marks[k - 1]?.vowel === "an") {
    out[k - 1] = letterToString(word.letters[k - 1], { ...marks[k - 1], vowel: null });
    out[k] = word.letters[k].char + VOWEL_CHAR.an;
  }
  return out;
}

/** For a bare final alif, the index of the letter whose tanween fath it can display; else null. */
export function tanweenCarrierOf(word: Word, i: number): number | null {
  return TANWEEN_FATH_ON_ALIF && isTanweenAlif(word, i) ? i - 1 : null;
}

/** Parses diacritized (or bare) Arabic text into words. Throws {@link ArabicParseError}. */
export function parseSentence(text: string): Word[] {
  const tokens = text.normalize("NFC").trim().split(/\s+/u).filter(Boolean);
  if (tokens.length === 0) throw new ArabicParseError("نص فارغ / empty text");
  return tokens.map(parseWord);
}
