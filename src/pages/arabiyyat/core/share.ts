import { toArabicDigits } from "../../shakkil/core/share";
import type { RoundKind } from "./types";

export const GAME_NAME = "عربيّات";
export const GAME_URL = "https://mahmoudshaar.com/arabiyyat/";
export const STORAGE_KEY = "arabiyyat:v1";

/** Short label per round kind (the kicker above each question and the share line). */
export const KIND_LABEL: Record<RoundKind, string> = {
  saying: "أكمل المثل",
  usage: "متى يُقال؟",
  meaning: "ما معناه؟",
  origin: "أصل الكلمة",
  root: "الأصل الفصيح",
  riddle: "حزّورة",
  custom: "من عاداتهم",
};

/** The question under each prompt (custom questions are their own prompt). */
export const KIND_QUESTION: Record<RoundKind, string> = {
  saying: "ما الكلمة الناقصة؟",
  usage: "في أيّ موقف يُضرب هذا المثل؟",
  meaning: "ما معنى هذا التعبير؟",
  origin: "من أيّ لغة جاءت هذه الكلمة؟",
  root: "من أيّ كلمة فصيحة جاءت؟",
  riddle: "ما هي؟",
  custom: "",
};

/** The context line above the prompt: where they say it, never asked as a question. */
export function placeLine(kind: RoundKind, place: string): string {
  if (kind === "saying" || kind === "usage") return `من أمثال ${place}`;
  if (kind === "riddle" || kind === "custom") return `من ${place}`;
  return `يقولون في ${place}`;
}

/** «عربيّات #٣ ٢/٣», one square per round, then the link. */
export function shareText(day: number, results: { kind: RoundKind; correct: boolean }[]): string {
  const score = results.filter((r) => r.correct).length;
  const header = `${GAME_NAME} #${toArabicDigits(day)} ${toArabicDigits(score)}/${toArabicDigits(results.length)}`;
  const lines = results.map((r) => `${r.correct ? "🟩" : "🟥"} ${KIND_LABEL[r.kind]}`);
  return [header, "", ...lines, "", GAME_URL].join("\n");
}
