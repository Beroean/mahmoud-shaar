import type { LetterResult } from "./grade";
import { MAX_ATTEMPTS } from "./storage";

export const GAME_NAME = "شَكِّل";
export const GAME_URL = "https://mahmoudshaar.com/shakkil/";

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export function toArabicDigits(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]);
}

/** 🟩 every graded letter right, 🟥 nothing right, 🟨 in between. */
export function wordSquare(letters: LetterResult[]): string {
  const graded = letters.filter((l) => l !== "fixed");
  if (graded.every((l) => l === "correct")) return "🟩";
  if (graded.every((l) => l === "wrong")) return "🟥";
  return "🟨";
}

/** Share text: header, then one row per attempt with one square per word, in reading order. */
export function shareText(puzzle: number, attempts: LetterResult[][][], won: boolean): string {
  const score = won ? toArabicDigits(attempts.length) : "X";
  const header = `${GAME_NAME} #${toArabicDigits(puzzle)} ${score}/${toArabicDigits(MAX_ATTEMPTS)}`;
  const rows = attempts.map((a) => a.map(wordSquare).join(""));
  return [header, "", ...rows, "", GAME_URL].join("\n");
}
