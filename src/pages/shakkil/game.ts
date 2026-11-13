/**
 * Game state machine for one puzzle. Pure (no React, no storage) so it can be unit-tested; the UI
 * drives it with useReducer.
 */
import { type Mark, type Vowel, EMPTY_MARK } from "./core/arabic";
import { type GradeResult, type Guess, emptyGuess, grade } from "./core/grade";
import type { Puzzle } from "./core/puzzle";
import { type GameStatus, MAX_ATTEMPTS } from "./core/storage";

export interface Pos {
  w: number;
  i: number;
}

export interface GameState {
  puzzle: Puzzle;
  attempts: Guess[];
  results: GradeResult[];
  /** The guess being edited. Prefilled from the previous attempt. */
  current: Guess;
  cursor: Pos | null;
  status: GameStatus;
}

export type MarkOp =
  | { type: "vowel"; vowel: Vowel }
  | { type: "shadda" }
  | { type: "clear" };

export type Action =
  | { type: "select"; pos: Pos }
  | { type: "move"; delta: 1 | -1 }
  | { type: "mark"; op: MarkOp }
  | { type: "submit" };

/** Letters the player can edit: graded in the reference and not already locked green. */
export function isEditable(state: Pick<GameState, "puzzle" | "results">, { w, i }: Pos): boolean {
  if (!state.puzzle.variants[0].specs[w][i].graded) return false;
  const last = state.results[state.results.length - 1];
  return !last || last.letters[w][i] !== "correct";
}

function positions(puzzle: Puzzle): Pos[] {
  return puzzle.words.flatMap((word, w) => word.letters.map((_, i) => ({ w, i })));
}

function firstEditable(state: Pick<GameState, "puzzle" | "results">): Pos | null {
  return positions(state.puzzle).find((p) => isEditable(state, p)) ?? null;
}

/** Next editable letter in a direction. Manual moves wrap around; auto-advance stops at the end. */
function step(state: GameState, from: Pos, delta: 1 | -1, wrap = true): Pos | null {
  const all = positions(state.puzzle);
  let k = all.findIndex((p) => p.w === from.w && p.i === from.i);
  for (let n = 0; n < all.length; n++) {
    k += delta;
    if (k < 0 || k >= all.length) {
      if (!wrap) return null;
      k = (k + all.length) % all.length;
    }
    if (isEditable(state, all[k])) return all[k];
  }
  return null;
}

export function applyOp(m: Mark, op: MarkOp): Mark {
  switch (op.type) {
    case "clear":
      return { ...EMPTY_MARK };
    case "shadda":
      // Shadda can't sit with sukun.
      return { shadda: !m.shadda, vowel: m.vowel === "o" ? null : m.vowel };
    case "vowel":
      if (m.vowel === op.vowel) return { ...m, vowel: null }; // tap again to remove
      return { shadda: op.vowel === "o" ? false : m.shadda, vowel: op.vowel };
  }
}

function setMark(guess: Guess, { w, i }: Pos, mark: Mark): Guess {
  return guess.map((word, wi) => (wi === w ? word.map((m, ii) => (ii === i ? mark : m)) : word));
}

/** A new attempt must differ from the previous one (no wasting tries by accident). */
export function canSubmit(state: GameState): boolean {
  if (state.status !== "playing") return false;
  const prev = state.attempts[state.attempts.length - 1];
  return !prev || JSON.stringify(prev) !== JSON.stringify(state.current);
}

export function initGame(puzzle: Puzzle, attempts: Guess[] = []): GameState {
  const results = attempts.map((g) => grade(g, puzzle.variants));
  const solved = results.some((r) => r.solved);
  const status: GameStatus = solved ? "won" : results.length >= MAX_ATTEMPTS ? "lost" : "playing";
  const current = attempts.length ? attempts[attempts.length - 1] : emptyGuess(puzzle.words);
  const base = { puzzle, results };
  return {
    puzzle,
    attempts,
    results,
    current,
    cursor: status === "playing" ? firstEditable(base) : null,
    status,
  };
}

export function reducer(state: GameState, action: Action): GameState {
  if (state.status !== "playing") return state;
  switch (action.type) {
    case "select":
      return isEditable(state, action.pos) ? { ...state, cursor: action.pos } : state;
    case "move":
      return state.cursor ? { ...state, cursor: step(state, state.cursor, action.delta) } : state;
    case "mark": {
      const { cursor } = state;
      if (!cursor) return state;
      const mark = applyOp(state.current[cursor.w][cursor.i], action.op);
      const current = setMark(state.current, cursor, mark);
      // Choosing a vowel finishes the letter, so move on; shadda usually needs a vowel next.
      const advance = action.op.type === "vowel" && mark.vowel !== null;
      return { ...state, current, cursor: advance ? (step(state, cursor, 1, false) ?? cursor) : cursor };
    }
    case "submit": {
      if (!canSubmit(state)) return state;
      const result = grade(state.current, state.puzzle.variants);
      const attempts = [...state.attempts, state.current];
      const results = [...state.results, result];
      const status: GameStatus = result.solved
        ? "won"
        : attempts.length >= MAX_ATTEMPTS
          ? "lost"
          : "playing";
      const next = { puzzle: state.puzzle, results };
      return {
        ...state,
        attempts,
        results,
        status,
        cursor: status === "playing" ? firstEditable(next) : null,
      };
    }
  }
}
