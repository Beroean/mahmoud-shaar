/** Shared shapes for عربيّات (the daily game of sayings and words from across the Arab world). */

export type RoundKind =
  // round 1: finish the saying
  | "saying"
  // round 2: when is it said, or what does it mean
  | "usage"
  | "meaning"
  // round 3: the wildcard
  | "origin"
  | "root"
  | "riddle"
  | "custom";

/** The blank in sayings. */
export const BLANK = "___";

/** The book an item comes from, shown under every answer. */
export interface Source {
  id: string;
  title: string;
  author: string;
  /** The place the book records, shown as context ("يقولون في …"), never asked. */
  place: string;
  /** Where the mini map's pin goes: the book's city, or a central point of its country. */
  lat: number;
  lon: number;
  url: string;
}

/** One question, ready to play (choices already shuffled, answer among them). */
export interface Round {
  id: string;
  kind: RoundKind;
  /** The saying (with BLANK for "saying"), the expression, the word, the riddle, or the question. */
  prompt: string;
  /** Shown under the prompt before answering (origin/root: the word's meaning). */
  hint?: string;
  answer: string;
  /** Four options in display order, the answer among them. */
  choices: string[];
  /** Shown after answering. */
  note?: string;
  source: Source;
  /** Printed page in the source edition (absent when the item is referenced by line, like the Aleppo book). */
  page?: number;
  /** Volume of a multi-volume book, as printed (e.g. «ج٥»). */
  volume?: string;
}

export interface Day {
  number: number;
  rounds: Round[];
}
