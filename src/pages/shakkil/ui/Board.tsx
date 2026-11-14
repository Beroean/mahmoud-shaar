import { type Mark, type Word, letterTexts, tanweenCarrierOf } from "../core/arabic";
import type { LetterResult } from "../core/grade";
import { type GameState, type Pos, isEditable } from "../game";
import { joins, withJoiners, withKashida } from "./joining";
import { RESULT_STYLE } from "./styles";

/** Compact, read-only rendering of a past attempt, coloured by result. */
function AttemptRow({ words, guess, results }: { words: Word[]; guess: Mark[][]; results: LetterResult[][] }) {
  return (
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 font-naskh text-3xl sm:text-4xl leading-[2.1]">
      {words.map((word, w) => {
        const j = joins(word);
        const texts = letterTexts(word, guess[w]);
        return (
          <span key={w} className="inline-flex">
            {word.letters.map((_, i) => {
              // A final alif showing the previous letter's tanween takes that letter's colour.
              const carrier = tanweenCarrierOf(word, i);
              const shown = carrier !== null && guess[w][carrier].vowel === "an" ? carrier : i;
              return (
                <span key={i} className={`inline-block border-b-2 rounded-sm ${RESULT_STYLE[results[w][shown]]}`}>
                  {withJoiners(texts[i], j[i])}
                </span>
              );
            })}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Letter size for the editable sentence. Short sentences stay big; long ones (5–6 words, or long
 * words like والمستشفيات) step down on phones so each word fits on a line and the sentence doesn't
 * fill the screen. Desktop has room, so it changes less.
 */
function editSize(words: Word[]): string {
  const longest = Math.max(...words.map((w) => w.letters.length));
  const total = words.reduce((n, w) => n + w.letters.length, 0);
  if (longest >= 10 || total >= 28) return "text-3xl sm:text-5xl";
  if (longest >= 7 || total >= 20) return "text-4xl sm:text-5xl";
  return "text-5xl sm:text-6xl";
}

function EditRow({
  state,
  onSelect,
}: {
  state: GameState;
  onSelect: (pos: Pos) => void;
}) {
  const { puzzle, current, cursor, results } = state;
  const last = results[results.length - 1];
  return (
    <div
      className={`flex flex-wrap justify-center gap-x-8 gap-y-3 font-naskh leading-[2.1] ${editSize(puzzle.words)}`}
      role="group"
      aria-label="الجملة"
    >
      {puzzle.words.map((word, w) => {
        const j = joins(word);
        const texts = letterTexts(word, current[w]);
        return (
          <span key={w} className="inline-flex">
            {word.letters.map((l, i) => {
              const pos = { w, i };
              const text = withKashida(texts[i], j[i]);
              if (!puzzle.variants[0].specs[w][i].graded) {
                // Tapping a final alif selects the letter before it, which carries tanween fath.
                const carrier = tanweenCarrierOf(word, i);
                const target = carrier !== null ? { w, i: carrier } : null;
                const tappable = target !== null && isEditable(state, target);
                const showsTanween = carrier !== null && current[w][carrier].vowel === "an";
                return (
                  <span
                    key={i}
                    aria-hidden
                    onClick={tappable ? () => onSelect(target) : undefined}
                    className={`inline-block ${showsTanween ? "text-paper" : "text-paper/40"} ${tappable ? "cursor-pointer hover:bg-paper/10 rounded-t-md" : ""}`}
                  >
                    {text}
                  </span>
                );
              }
              const editable = isEditable(state, pos);
              const active = cursor?.w === w && cursor.i === i;
              const prev = last?.letters[w][i];
              const tone = !editable
                ? RESULT_STYLE.correct
                : prev && prev !== "fixed"
                  ? RESULT_STYLE[prev]
                  : "border-paper/25 border-solid";
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!editable}
                  onClick={() => onSelect(pos)}
                  aria-label={`الحرف ${l.char}${editable ? "" : "، صحيح"}`}
                  aria-current={active ? "true" : undefined}
                  className={`inline-block min-w-[0.7em] border-b-[3px] rounded-t-md transition-colors ${tone} ${
                    active ? "ring-2 ring-paper ring-offset-2 ring-offset-ink" : ""
                  } ${editable ? "hover:bg-paper/10 cursor-pointer" : "cursor-default"}`}
                >
                  {text}
                </button>
              );
            })}
          </span>
        );
      })}
    </div>
  );
}

export function Board({ state, onSelect }: { state: GameState; onSelect: (pos: Pos) => void }) {
  const { puzzle, attempts, results, status } = state;
  return (
    <div className="flex flex-col gap-4">
      {attempts.map((g, k) => (
        <div key={k} className="flex items-center gap-3">
          <span className="w-5 shrink-0 text-xs text-paper/30 tabular-nums">{k + 1}</span>
          <div className="flex-1">
            <AttemptRow words={puzzle.words} guess={g} results={results[k].letters} />
          </div>
        </div>
      ))}
      {status === "playing" && (
        <div className={attempts.length ? "mt-4 pt-6 border-t border-paper/10" : ""}>
          <EditRow state={state} onSelect={onSelect} />
        </div>
      )}
    </div>
  );
}
