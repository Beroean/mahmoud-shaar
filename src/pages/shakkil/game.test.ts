import { describe, expect, it } from "vitest";
import { compilePuzzle } from "./core/puzzle";
import { MAX_ATTEMPTS } from "./core/storage";
import { type Action, type GameState, applyOp, canSubmit, initGame, isEditable, reducer } from "./game";

function puzzle(text: string) {
  const n = text.split(/\s+/).length;
  return compilePuzzle({ number: 1, text, irab: Array(n).fill("x") }).puzzle!;
}

const run = (s: GameState, ...actions: Action[]) => actions.reduce(reducer, s);
const vowel = (v: "a" | "u" | "i" | "o" | "an" | "un" | "in"): Action => ({ type: "mark", op: { type: "vowel", vowel: v } });

describe("applyOp", () => {
  it("toggles a vowel off when chosen twice and keeps shadda", () => {
    const m = applyOp({ shadda: true, vowel: null }, { type: "vowel", vowel: "a" });
    expect(m).toEqual({ shadda: true, vowel: "a" });
    expect(applyOp(m, { type: "vowel", vowel: "a" })).toEqual({ shadda: true, vowel: null });
  });

  it("never combines shadda with sukun", () => {
    expect(applyOp({ shadda: true, vowel: "a" }, { type: "vowel", vowel: "o" })).toEqual({ shadda: false, vowel: "o" });
    expect(applyOp({ shadda: false, vowel: "o" }, { type: "shadda" })).toEqual({ shadda: true, vowel: null });
  });
});

describe("reducer", () => {
  // ذَهَبَ الْوَلَدُ: graded letters are ذ ه ب, then ل (optional sukun) و ل د
  const p = puzzle("ذَهَبَ الْوَلَدُ");

  it("starts on the first gradable letter and skips ungraded ones", () => {
    let s = initGame(p);
    expect(s.cursor).toEqual({ w: 0, i: 0 });
    s = run(s, { type: "move", delta: 1 }, { type: "move", delta: 1 }, { type: "move", delta: 1 });
    expect(s.cursor).toEqual({ w: 1, i: 1 }); // skipped the alif of ال
    s = run(s, { type: "move", delta: -1 });
    expect(s.cursor).toEqual({ w: 0, i: 2 });
  });

  it("advances after a vowel but not after shadda", () => {
    let s = run(initGame(p), vowel("a"));
    expect(s.current[0][0]).toEqual({ shadda: false, vowel: "a" });
    expect(s.cursor).toEqual({ w: 0, i: 1 });
    s = run(s, { type: "mark", op: { type: "shadda" } });
    expect(s.cursor).toEqual({ w: 0, i: 1 });
  });

  it("auto-advance stops at the last letter instead of wrapping", () => {
    let s = run(initGame(p), { type: "select", pos: { w: 1, i: 4 } }, vowel("u"));
    expect(s.cursor).toEqual({ w: 1, i: 4 });
    s = run(s, { type: "move", delta: 1 });
    expect(s.cursor).toEqual({ w: 0, i: 0 }); // manual move wraps
  });

  it("wins with the right answer and locks greens after a wrong one", () => {
    let s = run(initGame(p), vowel("a"), vowel("a"), vowel("a"), { type: "move", delta: 1 }, vowel("a"), vowel("a"), vowel("a"));
    s = run(s, { type: "submit" });
    expect(s.status).toBe("playing");
    expect(s.results[0].letters[1][4]).toBe("wrong");
    expect(isEditable(s, { w: 0, i: 0 })).toBe(false); // locked green
    expect(s.cursor).toEqual({ w: 1, i: 4 }); // first non-green letter
    expect(canSubmit(s)).toBe(false); // unchanged guess
    s = run(s, vowel("u"), { type: "submit" });
    expect(s.status).toBe("won");
    expect(s.cursor).toBeNull();
    expect(run(s, vowel("a"))).toBe(s); // finished games ignore input
  });

  it(`loses after ${MAX_ATTEMPTS} wrong attempts`, () => {
    let s = initGame(p);
    const vs = ["a", "u", "i", "an", "un", "in"] as const;
    for (const v of vs) s = run(s, { type: "select", pos: { w: 0, i: 0 } }, vowel(v), { type: "submit" });
    expect(s.attempts).toHaveLength(MAX_ATTEMPTS);
    expect(s.status).toBe("lost");
  });

  it("restores a saved game", () => {
    const won = run(initGame(p), vowel("a"), vowel("a"), vowel("a"), { type: "move", delta: 1 }, vowel("a"), vowel("a"), vowel("u"), { type: "submit" });
    expect(won.status).toBe("won");
    const restored = initGame(p, won.attempts);
    expect(restored.status).toBe("won");
    expect(restored.results).toEqual(won.results);
  });
});
