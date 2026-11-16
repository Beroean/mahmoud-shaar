/** Shared shapes for حلبيّات (the daily game built from موسوعة حلب المقارنة). */

export type RoundKind = "origin" | "proverb" | "riddle" | "vendor" | "idiom" | "belief";

/** The blank in proverbs, vendor cries and beliefs. */
export const BLANK = "___";

/** One question, ready to play (choices already shuffled, answer among them). */
export interface Round {
  id: string;
  kind: RoundKind;
  /** The word (origin) or the text with BLANK in it (proverb, vendor, belief) or the riddle/idiom. */
  prompt: string;
  /** Shown under the prompt before answering (origin: the word's meaning). */
  hint?: string;
  answer: string;
  /** Four options in display order, the answer among them. */
  choices: string[];
  /** Shown after answering. */
  meaning?: string;
  note?: string;
  /** Encyclopedia headword the item comes from. */
  entry?: string;
}

/** A day: round 1 word origin, round 2 proverb, round 3 the wildcard. */
export interface Day {
  number: number;
  rounds: Round[];
}
