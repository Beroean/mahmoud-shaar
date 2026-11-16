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
const LEVEL_NAMES = ["", "سهل", "متوسط", "صعب"];

/**
 * Share text for a three-sentence day: one line per sentence with its level, score and the squares
 * of its last attempt, e.g. «سهل ٢/٦ 🟩🟩🟩».
 */
export function shareTextDay(
  day: number,
  rounds: { level: number; attempts: LetterResult[][][]; won: boolean }[],
): string {
  const solved = rounds.filter((r) => r.won).length;
  const header = `${GAME_NAME} #${toArabicDigits(day)} ${toArabicDigits(solved)}/${toArabicDigits(rounds.length)}`;
  const lines = rounds.map((r) => {
    const score = r.won ? toArabicDigits(r.attempts.length) : "X";
    const last = r.attempts[r.attempts.length - 1] ?? [];
    return `${LEVEL_NAMES[r.level] ?? ""} ${score}/${toArabicDigits(MAX_ATTEMPTS)} ${last.map(wordSquare).join("")}`;
  });
  return [header, "", ...lines, "", GAME_URL].join("\n");
}

export function shareText(puzzle: number, attempts: LetterResult[][][], won: boolean): string {
  const score = won ? toArabicDigits(attempts.length) : "X";
  const header = `${GAME_NAME} #${toArabicDigits(puzzle)} ${score}/${toArabicDigits(MAX_ATTEMPTS)}`;
  const rows = attempts.map((a) => a.map(wordSquare).join(""));
  return [header, "", ...rows, "", GAME_URL].join("\n");
}
