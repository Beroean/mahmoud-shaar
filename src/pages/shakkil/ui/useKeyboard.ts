import { useEffect } from "react";
import { type Vowel, SHADDA, VOWEL_CHAR } from "../core/arabic";
import type { Action, MarkOp } from "../game";

/** Physical keyboard: harakat typed on an Arabic layout, plus Latin shortcuts. */
const KEY_OPS: Record<string, MarkOp> = {
  ...Object.fromEntries(
    (Object.entries(VOWEL_CHAR) as [Vowel, string][]).map(([v, ch]) => [ch, { type: "vowel", vowel: v }]),
  ),
  [SHADDA]: { type: "shadda" },
  a: { type: "vowel", vowel: "a" },
  u: { type: "vowel", vowel: "u" },
  i: { type: "vowel", vowel: "i" },
  o: { type: "vowel", vowel: "o" },
  s: { type: "vowel", vowel: "o" },
  A: { type: "vowel", vowel: "an" },
  U: { type: "vowel", vowel: "un" },
  I: { type: "vowel", vowel: "in" },
  w: { type: "shadda" },
  Backspace: { type: "clear" },
  Delete: { type: "clear" },
};

export function useKeyboard(dispatch: (a: Action) => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest("input, textarea, [role=dialog]")) return;
      let action: Action | null = null;
      const op = KEY_OPS[e.key];
      if (op) action = { type: "mark", op };
      // RTL: the next letter is to the left.
      else if (e.key === "ArrowLeft" || (e.key === "Tab" && !e.shiftKey)) action = { type: "move", delta: 1 };
      else if (e.key === "ArrowRight" || (e.key === "Tab" && e.shiftKey)) action = { type: "move", delta: -1 };
      else if (e.key === "Enter") action = { type: "submit" };
      if (action) {
        e.preventDefault();
        dispatch(action);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, enabled]);
}

