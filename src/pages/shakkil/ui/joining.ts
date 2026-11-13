/**
 * Arabic letters change shape depending on their neighbours. We draw every letter in its own box
 * (so each is a tap target and can be coloured), which would normally break the joins. Putting a
 * zero-width joiner on the joined side(s) of each box keeps the correct contextual form.
 */
import type { Word } from "../core/arabic";

const ZWJ = "‍";
/** Letters that connect to the previous letter only, never to the next. */
const RIGHT_JOINING = new Set([..."اأإآٱدذرزوؤة"]);
const NON_JOINING = new Set(["ء"]);

function joinsNext(ch: string): boolean {
  return !RIGHT_JOINING.has(ch) && !NON_JOINING.has(ch);
}

/** For each letter: whether it connects to the letter before / after it. */
export function joins(word: Word): { prev: boolean; next: boolean }[] {
  const ls = word.letters;
  return ls.map((l, i) => ({
    prev: i > 0 && joinsNext(ls[i - 1].char) && !NON_JOINING.has(l.char),
    next: i < ls.length - 1 && joinsNext(l.char) && !NON_JOINING.has(ls[i + 1].char),
  }));
}

export function withJoiners(text: string, j: { prev: boolean; next: boolean }): string {
  return (j.prev ? ZWJ : "") + text + (j.next ? ZWJ : "");
}

const TATWEEL = "ـ";

/**
 * Like {@link withJoiners}, but draws a short kashida (tatweel) on each joined side, so letters in
 * separate, spaced-out tap targets still visibly connect into a word.
 */
export function withKashida(text: string, j: { prev: boolean; next: boolean }): string {
  return (j.prev ? TATWEEL : "") + text + (j.next ? TATWEEL : "");
}
