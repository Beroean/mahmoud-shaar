import type { LetterResult } from "../core/grade";

/**
 * Colour + border style per result (the border style keeps results distinguishable without colour).
 * The selected letter uses a white ring (Board.tsx), never gold or yellow, so it can't be confused
 * with "partial".
 */
export const RESULT_STYLE: Record<LetterResult, string> = {
  correct: "bg-emerald-500/20 text-emerald-200 border-emerald-400/70 border-solid",
  partial: "bg-yellow-400/20 text-yellow-100 border-yellow-300/80 border-dashed",
  wrong: "bg-rose-500/20 text-rose-200 border-rose-400/70 border-dotted",
  fixed: "text-paper/45 border-transparent",
};
