import { type ReactNode, useCallback, useEffect, useReducer, useState } from "react";
import { FlagIcon, HelpIcon, StatsIcon } from "../../components/icons";
import { SiteLayout } from "../../components/SiteLayout";
import { trackEvent } from "../../lib/analytics";
import { type DayStore, dayStore } from "../../lib/dayStore";
import { loadArchive, saveArchiveDay } from "../../lib/archive";
import { ArchiveModal } from "../../components/ArchiveModal";
import { markIntroSeen, shouldPlayIntro } from "../../lib/introOnce";
import { sentenceToString } from "./core/arabic";
import { LAUNCH_DATE, archiveNumber, devDay, isLaunched, puzzleNumber } from "./core/daily";
import type { Guess } from "./core/grade";
import { type Puzzle, type PuzzleSource, compilePuzzle } from "./core/puzzle";
import { GAME_NAME, toArabicDigits } from "./core/share";
import { type GameStatus, MAX_ATTEMPTS, type RoundRecord, load, recordResult, save } from "./core/storage";
import { canSubmit, initGame, reducer } from "./game";
import { Board } from "./ui/Board";
import { Keyboard } from "./ui/Keyboard";
import { LevelBadge } from "./ui/LevelBadge";
import { LEVEL_NAMES } from "./ui/styles";
import { DayResultModal, HelpModal, ResultModal, StatsModal } from "./ui/Modals";
import { ShakkilIntro } from "./ui/ShakkilIntro";
import { useKeyboard } from "./ui/useKeyboard";

/** daily: today's sentences, saved and counted. archive: a past day (?day=N), saved apart and never counted. */
type Mode = "daily" | "archive";

/** Key for past days in the archive (src/lib/archive.ts). */
const GAME = "shakkil";

const INTRO_KEY = "shakkil:intro";

/** "The medium/hard sentence" (feminine, agreeing with جملة). */
const NEXT_LABEL = ["", "السهلة", "المتوسطة", "الصعبة"];
type Dialog = "help" | "stats" | "result" | null;

interface Session {
  /** Unique per session so starting another day remounts the game. */
  id: number;
  mode: Mode;
  /** Day number. */
  number: number;
  /** The day's sentences: one, or easy/medium/hard on three-sentence days. */
  rounds: Puzzle[];
  /** Progress per sentence, restored from storage and saved as you play. */
  progress: RoundRecord[];
  /** Index of the sentence being played. */
  round: number;
}

let sessionIds = 0;

function compile(src: PuzzleSource): Puzzle {
  const { puzzle, errors } = compilePuzzle(src);
  if (!puzzle) throw new Error(`Puzzle ${src.number}: ${errors.join("; ")}`);
  return puzzle;
}

const freshRound = (p: Puzzle): RoundRecord => ({ id: p.id ?? "", attempts: [], status: "playing" });

const sameIds = (saved: RoundRecord[] | undefined, rounds: Puzzle[]) =>
  saved?.length === rounds.length && saved.every((r, i) => r.id === rounds[i].id);

/**
 * Day `number`'s sentences, or null if this build doesn't include them. The site only ships puzzles up
 * to tomorrow (rebuilt nightly), so for today this only happens if the nightly deploy is late.
 */
function daySession(mode: Mode, number: number, day: PuzzleSource[]): Session | null {
  const sources = day.filter((p) => p.number === number).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
  if (!sources.length) return null;
  const rounds = sources.map(compile);
  let progress = rounds.map(freshRound);
  const saved = load().daily;
  const archived = loadArchive<RoundRecord[]>(GAME)[number]?.progress;
  // Restore only the same puzzles (a schedule change drops the save).
  if (mode === "archive") {
    if (sameIds(archived, rounds)) progress = archived!;
  } else if (saved?.puzzle === number) {
    if (saved.rounds?.length === rounds.length && saved.rounds.every((r, i) => r.id === rounds[i].id)) {
      progress = saved.rounds;
    } else if (!saved.rounds && rounds.length === 1 && (!saved.id || saved.id === rounds[0].id)) {
      progress = [{ id: rounds[0].id ?? "", attempts: saved.attempts, status: saved.status }];
    }
  }
  const open = progress.findIndex((r) => r.status === "playing");
  return { id: ++sessionIds, mode, number, rounds, progress, round: open === -1 ? rounds.length - 1 : open };
}

/**
 * Saves a session's progress. Every day goes to the archive (so it shows as played there); a daily
 * day is also saved as today's game and counted in the stats once, when every sentence is finished.
 */
function persistDay(s: Session, progress: RoundRecord[]) {
  const done = progress.every((r) => r.status !== "playing");
  const solved = progress.filter((r) => r.status === "won").length;
  saveArchiveDay<RoundRecord[]>(GAME, s.number, {
    progress,
    ...(done && { score: { got: solved, of: progress.length } }),
  });
  if (s.mode === "archive") {
    if (done) trackEvent(`shakkil/archive-solved-${solved}`);
    return;
  }
  const data = load();
  const won = done && progress.every((r) => r.status === "won");
  const status: GameStatus = !done ? "playing" : won ? "won" : "lost";
  const already = data.daily?.puzzle === s.number && data.daily.status !== "playing";
  data.daily = { puzzle: s.number, id: s.rounds[0].id, attempts: progress[0].attempts, status, rounds: progress };
  if (done && !already) {
    if (s.rounds.length === 1) {
      const n = progress[0].attempts.length;
      data.stats = recordResult(data.stats, s.number, won, n);
      trackEvent(won ? `shakkil/solved-${n}` : "shakkil/failed");
    } else {
      const solved = progress.filter((r) => r.status === "won");
      data.stats = recordResult(data.stats, s.number, won, solved.map((r) => r.attempts.length));
      trackEvent(`shakkil/day-solved-${solved.length}`);
    }
  }
  save(data);
}

async function shareText(text: string): Promise<boolean> {
  trackEvent("shakkil/share");
  try {
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ text });
      return false;
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false; // share sheet dismissed
  }
}

/** One sentence: board, keyboard, header. On three-sentence days the parent moves between them. */
function Game({
  session,
  onUpdate,
  onNext,
  onDayResult,
  onArchive,
  onToast,
}: {
  session: Session;
  onUpdate: (attempts: Guess[], status: GameStatus) => void;
  onNext: () => void;
  onDayResult: () => void;
  onArchive: () => void;
  onToast: (text: string) => void;
}) {
  const { mode, number, rounds, round } = session;
  const puzzle = rounds[round];
  const daily = mode === "daily";
  const multi = rounds.length > 1;
  const isLast = round === rounds.length - 1;
  const [state, dispatch] = useReducer(reducer, null, () => initGame(puzzle, session.progress[round]?.attempts ?? []));
  const finished = state.status !== "playing";
  const [dialog, setDialog] = useState<Dialog>(() => {
    if (finished) return multi ? null : "result";
    if (daily && round === 0 && !load().stats.played && !state.attempts.length) return "help";
    return null;
  });

  useKeyboard(dispatch, state.status === "playing" && dialog === null);

  useEffect(() => {
    if (state.attempts.length) onUpdate(state.attempts, state.status);
    // onUpdate is recreated by the parent each render; attempts/status are what matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.attempts, state.status]);

  useEffect(() => {
    if (state.attempts.length === 1 && round === 0) trackEvent(daily ? "shakkil/start" : "shakkil/archive");
  }, [daily, round, state.attempts.length]);

  // When the game finishes, open the result after the last row has been painted. On a
  // three-sentence day only the last sentence opens the day's summary; earlier ones show "next".
  useEffect(() => {
    if (!finished || (multi && !isLast)) return;
    const id = setTimeout(() => (multi ? onDayResult() : setDialog((d) => d ?? "result")), 900);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, multi, isLast]);

  const mark = state.cursor ? state.current[state.cursor.w][state.cursor.i] : null;
  const remaining = MAX_ATTEMPTS - state.attempts.length;
  const answer = puzzle.variants[state.results[state.results.length - 1]?.variant ?? 0]?.words ?? puzzle.words;

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-naskh text-4xl text-gold leading-tight">{GAME_NAME}</h1>
          <p className="text-sm text-paper/50">
            {daily ? `${isLaunched() ? "جملة اليوم" : "معاينة · جملة"} #${toArabicDigits(number)}` : `يوم سابق #${toArabicDigits(number)}`}
            {state.status === "playing" && ` · بقي ${toArabicDigits(remaining)} من ${toArabicDigits(MAX_ATTEMPTS)}`}
            <LevelBadge level={puzzle.level} />
          </p>
        </div>
        <nav className="flex items-center gap-1">
          <IconButton label="كيف تلعب" onClick={() => setDialog("help")}>
            <HelpIcon className="w-5 h-5" />
          </IconButton>
          <IconButton label="الإحصاءات" onClick={() => setDialog("stats")}>
            <StatsIcon className="w-5 h-5" />
          </IconButton>
          {finished && (!multi || isLast) && (
            <IconButton label="النتيجة" onClick={() => (multi ? onDayResult() : setDialog("result"))}>
              <FlagIcon className="w-5 h-5 rtl:-scale-x-100" />
            </IconButton>
          )}
          {daily ? (
            isLaunched() && (
              <button
                type="button"
                onClick={onArchive}
                className="ms-2 px-3 py-2 rounded-md border border-paper/15 text-sm hover:border-paper/40"
              >
                الأرشيف
              </button>
            )
          ) : (
            <a href="./" className="ms-2 px-3 py-2 rounded-md border border-paper/15 text-sm hover:border-paper/40">
              جملة اليوم
            </a>
          )}
        </nav>
      </div>

      {multi && <RoundSteps session={session} current={state.status} />}

      {puzzle.context && (
        <p className="mb-4 text-center text-paper/70" dir="rtl">
          <span className="text-paper/40">السياق: </span>
          {puzzle.context}
        </p>
      )}

      <Board state={state} onSelect={(pos) => dispatch({ type: "select", pos })} />

      {finished && multi && !isLast && (
        <div className="mt-8 text-center space-y-4">
          <p className="text-paper/70">{state.status === "won" ? "أحسنت!" : "انتهت المحاولات. التشكيل الصحيح:"}</p>
          {state.status !== "won" && (
            <p className="font-naskh text-3xl leading-[2] text-emerald-200">{sentenceToString(answer)}</p>
          )}
          <button
            type="button"
            onClick={onNext}
            className="px-5 py-3 rounded-md bg-gold text-ink font-bold hover:bg-gold/90"
          >
            التالي: الجملة {NEXT_LABEL[rounds[round + 1].level ?? round + 2]} ←
          </button>
        </div>
      )}

      {finished && (!multi || isLast) && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => (multi ? onDayResult() : setDialog("result"))}
            className="px-5 py-3 rounded-md bg-gold text-ink font-bold hover:bg-gold/90"
          >
            {multi ? "عرض نتيجة اليوم" : state.status === "won" ? "أحسنت! عرض النتيجة" : "عرض الإجابة"}
          </button>
        </div>
      )}

      {state.status === "playing" && (
        <div className="sticky bottom-0 mt-10 -mx-4 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-ink/95 backdrop-blur border-t border-paper/10">
          <Keyboard mark={mark} dispatch={dispatch} canSubmit={canSubmit(state)} hasCursor={!!state.cursor} />
        </div>
      )}

      {dialog === "help" && <HelpModal onClose={() => setDialog(null)} />}
      {dialog === "stats" && <StatsModal stats={load().stats} today={puzzleNumber()} onClose={() => setDialog(null)} />}
      {dialog === "result" && finished && !multi && (
        <ResultModal
          state={state}
          number={number}
          daily={daily}
          onShare={async (text) => {
            if (await shareText(text)) onToast("نُسخت النتيجة");
          }}
          onArchive={() => {
            setDialog(null);
            onArchive();
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

const STEP_TONE: Record<GameStatus, string> = {
  won: "border-emerald-400/60 bg-emerald-500/15 text-emerald-200",
  lost: "border-rose-400/60 bg-rose-500/15 text-rose-200",
  playing: "border-paper/20 text-paper/50",
};

/** Progress across the day's three sentences: easy · medium · hard. */
function RoundSteps({ session, current }: { session: Session; current: GameStatus }) {
  return (
    <ol className="flex items-center justify-center gap-2 mb-6" aria-label="جمل اليوم">
      {session.rounds.map((p, i) => {
        const status = i === session.round ? current : (session.progress[i]?.status ?? "playing");
        const active = i === session.round;
        return (
          <li
            key={i}
            aria-current={active ? "step" : undefined}
            className={`rounded-full border px-3 py-1 text-xs ${STEP_TONE[status]} ${active ? "ring-1 ring-paper/60" : ""}`}
          >
            {toArabicDigits(i + 1)} · {LEVEL_NAMES[p.level ?? i + 1]}
            {status === "won" ? " ✓" : status === "lost" ? " ✗" : ""}
          </li>
        );
      })}
    </ol>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="w-10 h-10 grid place-items-center rounded-md border border-paper/15 text-paper/70 hover:text-gold hover:border-gold/50 transition-colors"
    >
      {children}
    </button>
  );
}

export default function Shakkil() {
  const [store, setStore] = useState<DayStore<PuzzleSource> | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Today's puzzle isn't in this build yet (nightly deploy pending). */
  const [waiting, setWaiting] = useState(false);
  const [dayResult, setDayResult] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const closeArchive = useCallback(() => setArchiveOpen(false), []);
  const [intro, setIntro] = useState(() => shouldPlayIntro(INTRO_KEY, "intro"));
  const closeIntro = useCallback(() => setIntro(false), []);
  useEffect(() => {
    if (intro) markIntroSeen(INTRO_KEY);
  }, [intro]);

  /** Today's game, or the past day in ?day=N. */
  async function show(days: DayStore<PuzzleSource>) {
    const past = archiveNumber(location.search, puzzleNumber());
    const number = past ?? puzzleNumber();
    const s = daySession(past === null ? "daily" : "archive", number, await days.day(number));
    setStore(days);
    setSession(s);
    setWaiting(!s);
    setDayResult(false);
  }

  useEffect(() => {
    import("virtual:shakkil-days")
      .then((m) => show(dayStore(m)))
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  function update(attempts: Guess[], status: GameStatus) {
    setSession((s) => {
      if (!s) return s;
      const progress = s.progress.map((r, i) => (i === s.round ? { ...r, attempts, status } : r));
      persistDay(s, progress);
      return { ...s, progress };
    });
  }

  const openArchive = () => {
    setDayResult(false);
    setArchiveOpen(true);
  };

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
          {devDay() !== null && (
            <p dir="ltr" className="mb-4 rounded-md border border-gold/40 px-3 py-2 text-center text-xs text-gold/80">
              Dev preview: day {devDay()} (remove ?today= to go back to today)
            </p>
          )}
          {error && <p className="text-rose-300">تعذّر تحميل اللعبة: {error}</p>}
          {!session && !error && !waiting && <p className="text-paper/40 py-24 text-center">جارٍ التحميل…</p>}
          {waiting && !session && store && (
            <div className="py-24 text-center space-y-6">
              <p className="text-paper/70">جملة اليوم في الطريق. حدّث الصفحة بعد قليل.</p>
              <button
                type="button"
                onClick={openArchive}
                className="px-5 py-3 rounded-md border border-paper/20 hover:border-paper/50"
              >
                الأيام السابقة
              </button>
            </div>
          )}
          {session && store && (
            <Game
              key={`${session.id}-${session.round}`}
              session={session}
              onUpdate={update}
              onNext={() => setSession((s) => (s ? { ...s, round: Math.min(s.round + 1, s.rounds.length - 1) } : s))}
              onDayResult={() => setDayResult(true)}
              onArchive={openArchive}
              onToast={setToast}
            />
          )}
          {dayResult && session && session.rounds.length > 1 && (
            <DayResultModal
              rounds={session.rounds}
              progress={session.progress}
              number={session.number}
              daily={session.mode === "daily"}
              onShare={async (text) => {
                if (await shareText(text)) setToast("نُسخت النتيجة");
              }}
              onArchive={openArchive}
              onClose={() => setDayResult(false)}
            />
          )}
          {archiveOpen && (
            <ArchiveModal today={puzzleNumber()} launchDate={LAUNCH_DATE} archive={loadArchive(GAME)} accent="gold" onClose={closeArchive} />
          )}
          {intro && <ShakkilIntro onDone={closeIntro} />}
          {toast && (
            <div role="status" className="fixed top-6 inset-x-0 mx-auto w-fit z-50 px-4 py-2 rounded-md bg-paper text-ink text-sm">
              {toast}
            </div>
          )}
        </main>
      </SiteLayout>
    </div>
  );
}
