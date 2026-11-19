import { useEffect, useState } from "react";
import "./intro.css";
import type { Word } from "../core/arabic";
import { GAME_NAME } from "../core/share";
import { joins, withJoiners } from "./joining";

/**
 * Opening scene, about 3.3 s once the font is ready (timings in intro.css):
 * 1. a sentence appears bare, with no vowel marks, each letter on an empty underline like the board;
 * 2. right to left, each letter gets its marks and turns green, the way a correct letter does;
 * 3. the finished sentence lifts away and the page shows through.
 * Each letter sits in its own box with zero-width joiners (as on the board), holding a bare copy and
 * a voweled copy on top of each other; the marks are what appears when the voweled copy fades in.
 * Plays once per browser session; skipped for reduced motion; ?intro=1 forces it (introOnce.ts).
 */

/** "Arabic is the language of the ḍād": short, about the language, and never a puzzle. */
const SENTENCE = "الْعَرَبِيَّةُ لُغَةُ الضَّادِ";

const MARKS = /[ً-ْٰ]/;
/** When the first letter gets its marks, and how long until the last one has (s). */
const SOLVE_AT = 0.7;
const SOLVE_SPAN = 1.3;
/** From the start of the scene to its end (ms); keep in step with intro.css. */
const DURATION_MS = 3300;
/** Don't wait longer than this for Amiri; draw with what's there. */
const FONT_WAIT_MS = 1200;

interface Glyph {
  bare: string;
  voweled: string;
}

/** The sentence as words of letters, each letter with and without its marks, joiners included. */
function split(sentence: string): Glyph[][] {
  return sentence.split(" ").map((w) => {
    const letters: string[] = [];
    for (const ch of w) {
      if (MARKS.test(ch) && letters.length) letters[letters.length - 1] += ch;
      else letters.push(ch);
    }
    const word = { letters: letters.map((l) => ({ char: l[0] })) } as Word;
    const j = joins(word);
    return letters.map((l, i) => ({ bare: withJoiners(l[0], j[i]), voweled: withJoiners(l, j[i]) }));
  });
}

const WORDS = split(SENTENCE);
const COUNT = WORDS.reduce((n, w) => n + w.length, 0);

export function ShakkilIntro({ onDone }: { onDone: () => void }) {
  const [ready, setReady] = useState(false);

  // Start once Amiri is in, so letters don't swap fonts halfway through.
  useEffect(() => {
    let live = true;
    const go = () => live && setReady(true);
    const wait = setTimeout(go, FONT_WAIT_MS);
    if (document.fonts) document.fonts.load("48px Amiri", SENTENCE).then(go, go);
    else go();
    return () => {
      live = false;
      clearTimeout(wait);
    };
  }, []);

  useEffect(() => {
    // Capture, so the key that skips the scene isn't also typed into the board.
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      onDone();
    };
    window.addEventListener("keydown", onKey, true);
    const done = ready ? setTimeout(onDone, DURATION_MS) : undefined;
    return () => {
      clearTimeout(done);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [ready, onDone]);

  let n = 0;
  return (
    <div className={`sk-overlay ${ready ? "sk-go" : ""}`} onClick={onDone} role="presentation">
      <div className="sk-stage">
        <p className="sk-name font-naskh">{GAME_NAME}</p>
        <p className="sk-sentence font-naskh" aria-hidden>
          {WORDS.map((word, w) => (
            <span key={w} className="sk-word">
              {word.map((g, i) => {
                const delay = `${SOLVE_AT + (n++ / Math.max(COUNT - 1, 1)) * SOLVE_SPAN}s`;
                return (
                  <span key={i} className="sk-letter" style={{ ["--sk-at" as string]: delay }}>
                    <span className="sk-bare">{g.bare}</span>
                    <span className="sk-voweled">{g.voweled}</span>
                  </span>
                );
              })}
            </span>
          ))}
        </p>
      </div>
      <span className="sk-skip">اضغط للدخول</span>
    </div>
  );
}
