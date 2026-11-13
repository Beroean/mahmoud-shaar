import { useEffect, useReducer, useState } from "react";
import { SiteLayout } from "../../components/SiteLayout";
import { trackEvent } from "../../lib/analytics";
import { puzzleNumber, scheduledIndex } from "./core/daily";
import type { Guess } from "./core/grade";
import { type Puzzle, type PuzzleSource, compilePuzzle } from "./core/puzzle";
import { GAME_NAME, toArabicDigits } from "./core/share";
import { MAX_ATTEMPTS, load, recordResult, save } from "./core/storage";
import { canSubmit, initGame, reducer } from "./game";
import { Board } from "./ui/Board";
import { Keyboard } from "./ui/Keyboard";
import { useKeyboard } from "./ui/useKeyboard";
import { HelpModal, ResultModal, StatsModal } from "./ui/Modals";

type Mode = "daily" | "practice";
type Dialog = "help" | "stats" | "result" | null;

interface Session {
  /** Unique per session so starting a new practice puzzle remounts the game. */
  id: number;
  mode: Mode;
  /** Puzzle number shown to the player (schedule position). */
  number: number;
  puzzle: Puzzle;
  /** Restored attempts (daily only). */
  attempts: Guess[];
}

let sessionIds = 0;

function compile(src: PuzzleSource): Puzzle {
  const { puzzle, errors } = compilePuzzle(src);
  if (!puzzle) throw new Error(`Puzzle ${src.number}: ${errors.join("; ")}`);
  return puzzle;
}

function dailySession(all: PuzzleSource[]): Session {
  const number = puzzleNumber();
  const puzzle = compile(all[scheduledIndex(number, all.length)]);
  const saved = load().daily;
  return { id: ++sessionIds, mode: "daily", number, puzzle, attempts: saved?.puzzle === number ? saved.attempts : [] };
}

/** A random past puzzle (never today's or a future one, so practice can't spoil a daily). */
function practiceSession(all: PuzzleSource[], exclude?: number): Session {
  const today = puzzleNumber();
  let pool = all.filter((p) => p.number < today && p.number !== exclude);
  if (!pool.length) pool = all.filter((p) => p.number !== today && p.number !== exclude);
  if (!pool.length) pool = all;
  const src = pool[Math.floor(Math.random() * pool.length)];
  return { id: ++sessionIds, mode: "practice", number: src.number, puzzle: compile(src), attempts: [] };
}

function Game({
  session,
  onPractice,
  onDaily,
}: {
  session: Session;
  onPractice: () => void;
  onDaily: () => void;
}) {
  const { mode, number } = session;
  const [state, dispatch] = useReducer(reducer, session, (s) => initGame(s.puzzle, s.attempts));
  const [dialog, setDialog] = useState<Dialog>(() => {
    if (state.status !== "playing") return "result";
    if (mode === "daily" && !load().stats.played && !state.attempts.length) return "help";
    return null;
  });
  const [toast, setToast] = useState<string | null>(null);
  const daily = mode === "daily";

  useKeyboard(dispatch, state.status === "playing" && dialog === null);

  // Persist daily progress, and count the result exactly once when the game ends.
  useEffect(() => {
    if (!daily || !state.attempts.length) return;
    const data = load();
    const already = data.daily?.puzzle === number && data.daily.status !== "playing";
    data.daily = { puzzle: number, attempts: state.attempts, status: state.status };
    if (state.status !== "playing" && !already) {
      data.stats = recordResult(data.stats, number, state.status === "won", state.attempts.length);
      trackEvent(state.status === "won" ? `shakkil/solved-${state.attempts.length}` : "shakkil/failed");
    }
    save(data);
  }, [daily, number, state.attempts, state.status]);

  useEffect(() => {
    if (state.attempts.length === 1) trackEvent(daily ? "shakkil/start" : "shakkil/practice");
  }, [daily, state.attempts.length]);

  // Open the result once the game finishes (after the last row has been painted).
  const finished = state.status !== "playing";
  useEffect(() => {
    if (!finished) return;
    const id = setTimeout(() => setDialog((d) => d ?? "result"), 900);
    return () => clearTimeout(id);
  }, [finished]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  async function share(text: string) {
    trackEvent("shakkil/share");
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setToast("نُسخت النتيجة");
    } catch {
      /* share sheet dismissed */
    }
  }

  const mark = state.cursor ? state.current[state.cursor.w][state.cursor.i] : null;
  const remaining = MAX_ATTEMPTS - state.attempts.length;

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-8">
        <div>
          <h1 className="font-naskh text-4xl text-gold leading-tight">{GAME_NAME}</h1>
          <p className="text-sm text-paper/50">
            {daily ? `جملة اليوم #${toArabicDigits(number)}` : "تدريب"}
            {state.status === "playing" && ` · بقي ${toArabicDigits(remaining)} من ${toArabicDigits(MAX_ATTEMPTS)}`}
          </p>
        </div>
        <nav className="flex items-center gap-1">
          <IconButton label="كيف تلعب" onClick={() => setDialog("help")}>؟</IconButton>
          <IconButton label="الإحصاءات" onClick={() => setDialog("stats")}>📊</IconButton>
          {finished && <IconButton label="النتيجة" onClick={() => setDialog("result")}>🏁</IconButton>}
          <button
            type="button"
            onClick={daily ? onPractice : onDaily}
            className="ms-2 px-3 py-2 rounded-md border border-paper/15 text-sm hover:border-paper/40"
          >
            {daily ? "تدريب" : "جملة اليوم"}
          </button>
        </nav>
      </div>

      <Board state={state} onSelect={(pos) => dispatch({ type: "select", pos })} />

      {finished && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setDialog("result")}
            className="px-5 py-3 rounded-md bg-gold text-ink font-bold hover:bg-gold/90"
          >
            {state.status === "won" ? "أحسنت! عرض النتيجة" : "عرض الإجابة"}
          </button>
        </div>
      )}

      {state.status === "playing" && (
        <div className="sticky bottom-0 mt-10 -mx-4 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-ink/95 backdrop-blur border-t border-paper/10">
          <Keyboard mark={mark} dispatch={dispatch} canSubmit={canSubmit(state)} hasCursor={!!state.cursor} />
        </div>
      )}

      {toast && (
        <div role="status" className="fixed top-6 inset-x-0 mx-auto w-fit z-50 px-4 py-2 rounded-md bg-paper text-ink text-sm">
          {toast}
        </div>
      )}

      {dialog === "help" && <HelpModal onClose={() => setDialog(null)} />}
      {dialog === "stats" && <StatsModal stats={load().stats} today={puzzleNumber()} onClose={() => setDialog(null)} />}
      {dialog === "result" && finished && (
        <ResultModal
          state={state}
          number={number}
          daily={daily}
          onShare={share}
          onPractice={() => {
            setDialog(null);
            onPractice();
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="w-10 h-10 rounded-md border border-paper/15 hover:border-paper/40 text-lg"
    >
      {children}
    </button>
  );
}

export default function Shakkil() {
  const [all, setAll] = useState<PuzzleSource[] | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    import("virtual:shakkil-puzzles")
      .then((m) => {
        setAll(m.default);
        setSession(dailySession(m.default));
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="font-[system-ui,'Segoe_UI',Tahoma,sans-serif]">
      <SiteLayout
        headerStart={
          <a href="/" className="text-sm text-paper/40 hover:text-gold transition-colors">
            → الرئيسية
          </a>
        }
        headerEnd={<span className="text-xs text-paper/25">لعبة التشكيل اليومية</span>}
      >
        <main className="relative z-10 mx-auto max-w-2xl px-4 pt-8 pb-4">
          {error && <p className="text-rose-300">تعذّر تحميل اللعبة: {error}</p>}
          {!session && !error && <p className="text-paper/40 py-24 text-center">جارٍ التحميل…</p>}
          {session && all && (
            <Game
              key={session.id}
              session={session}
              onPractice={() => setSession(practiceSession(all, session.mode === "practice" ? session.number : undefined))}
              onDaily={() => setSession(dailySession(all))}
            />
          )}
        </main>
      </SiteLayout>
    </div>
  );
}
