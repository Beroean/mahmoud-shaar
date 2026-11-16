import { toArabicDigits } from "../../shakkil/core/share";
import type { RoundKind } from "./types";

export const GAME_NAME = "حلبيّات";
export const GAME_URL = "https://mahmoudshaar.com/halab/";

/** Short label per round kind (the kicker above each question and the share line). */
export const KIND_LABEL: Record<RoundKind, string> = {
  origin: "أصل الكلمة",
  proverb: "كمّل المثل",
  riddle: "حزّورة",
  vendor: "نداء البيّاع",
  idiom: "كناية",
  belief: "من اعتقاداتهم",
};

/** The question under each prompt. */
export const KIND_QUESTION: Record<RoundKind, (prompt: string) => string> = {
  origin: (w) => `من أيّ لغة جاءت كلمة «${w}»؟`,
  proverb: () => "شو الكلمة الناقصة؟",
  riddle: () => "شو هيّ؟",
  vendor: () => "شو عم يبيع؟",
  idiom: () => "شو يعني؟",
  belief: () => "كمّل الاعتقاد",
};

/** «حلبيّات #٣ ٢/٣», one square per round, then the link. */
export function shareText(day: number, results: { kind: RoundKind; correct: boolean }[]): string {
  const score = results.filter((r) => r.correct).length;
  const header = `${GAME_NAME} #${toArabicDigits(day)} ${toArabicDigits(score)}/${toArabicDigits(results.length)}`;
  const lines = results.map((r) => `${r.correct ? "🟩" : "🟥"} ${KIND_LABEL[r.kind]}`);
  return [header, "", ...lines, "", GAME_URL].join("\n");
}
