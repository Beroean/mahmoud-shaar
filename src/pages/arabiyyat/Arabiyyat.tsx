/**
 * عربيّات: three rounds a day from folklore books across the Arab world. Shares حلبيّات' daily loop
 * (one try per round, saved progress, streaks) but has its own rounds, wording and look: the place
 * appears as context above each question and is never what's asked.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DallahIcon, HelpIcon } from "../../components/icons";
import { SiteLayout } from "../../components/SiteLayout";
import { trackEvent } from "../../lib/analytics";
import { type DayStore, dayStore } from "../../lib/dayStore";
import { loadArchive } from "../../lib/archive";
import { ArchiveModal } from "../../components/ArchiveModal";
import { archivePicks, archivedPicks, dayMode, type DayMode } from "../halab/core/pastDays";
import { markIntroSeen, shouldPlayIntro } from "../../lib/introOnce";
import { type SaveData, currentStreak, load as loadSave, recordDay, save as writeSave } from "../halab/core/storage";
import { toArabicDigits } from "../shakkil/core/share";
import { Modal } from "../shakkil/ui/Modals";
import { LAUNCH_DATE, isLaunched, msUntilNext, previewNumber, todayNumber } from "./core/daily";
import { GAME_NAME, KIND_LABEL, KIND_QUESTION, STORAGE_KEY, placeLine, shareText } from "./core/share";
import { BLANK, type Day, type Round, type Source } from "./core/types";
import { MapIntro } from "./ui/MapIntro";
import { type MapPin, MiniMap } from "./ui/MiniMap";

const load = () => loadSave(undefined, STORAGE_KEY);
const save = (d: SaveData) => writeSave(d, undefined, STORAGE_KEY);
const INTRO_KEY = "arabiyyat:intro";

interface Session {
  day: Day;
  picks: (string | null)[];
  /** Round being shown (3 = the day's summary). */
  round: number;
  /** Past days (?day=N) are saved apart and never counted; preview days are never saved (pastDays.ts). */
  mode: DayMode;
}

const GAME = "arabiyyat";

async function startSession(store: DayStore<Day>): Promise<Session | null> {
  const requested = previewNumber(location.search, store.last, import.meta.env.DEV);
  const mode = dayMode(requested, todayNumber(), isLaunched());
  const number = requested ?? todayNumber();
  const day = (await store.day(number))[0] ?? (isLaunched() ? null : ((await store.day(1))[0] ?? null));
  if (!day) return null;
  let picks: (string | null)[] = day.rounds.map(() => null);
  if (mode === "daily") {
    const saved = load().daily;
    if (saved?.day === day.number && saved.ids.join() === day.rounds.map((r) => r.id).join()) picks = saved.picks;
  } else if (mode === "archive") {
    picks = archivedPicks(GAME, day) ?? picks;
  }
  const open = picks.findIndex((p) => p === null);
  return {
    day,
    picks,
    round: open === -1 ? day.rounds.length : open,
    mode,
  };
}

function persist(s: Session) {
  if (s.mode === "preview") return;
  // Past days go to the archive only; a daily day goes there too, so the archive shows it as played.
  archivePicks(GAME, s.day, s.picks);
  if (s.mode === "archive") return;
  const data: SaveData = load();
  const ids = s.day.rounds.map((r) => r.id);
  const done = s.picks.every((p) => p !== null);
  const counted = data.daily?.day === s.day.number && data.daily.picks.every((p) => p !== null);
  data.daily = { day: s.day.number, ids, picks: s.picks };
  if (done && !counted) {
    const score = s.day.rounds.filter((r, i) => s.picks[i] === r.answer).length;
    data.stats = recordDay(data.stats, s.day.number, score);
    trackEvent(`arabiyyat/day-score-${score}`);
  }
  save(data);
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  );
}

/** The prompt with its blank: dotted before answering, the answer once chosen. */
function PromptText({ round, picked }: { round: Round; picked: string | null }) {
  if (round.kind === "custom") return <>{round.prompt}</>;
  if (!round.prompt.includes(BLANK)) return <>«{round.prompt}»</>;
  const [before, after = ""] = round.prompt.split(BLANK);
  const correct = picked === round.answer;
  return (
    <>
      «{before}
      {picked === null ? (
        <span className="inline-block min-w-[3.5em] border-b-2 border-dotted border-sky-300/70 mx-1 align-baseline">&nbsp;</span>
      ) : (
        <span className={`mx-1 border-b-2 ${correct ? "text-emerald-200 border-emerald-400/70" : "text-sky-200 border-sky-300/60"}`}>
          {round.answer}
        </span>
      )}
      {after}»
    </>
  );
}

/** Same size and weight as Shakkil's credit line: small grey print was easy to miss. */
function SourceLine({ round }: { round: Round }) {
  const { source, page, volume } = round;
  return (
    <p className="text-base font-bold text-paper/80 leading-relaxed">
      من{" "}
      <a href={source.url} target="_blank" rel="noreferrer" className="underline hover:text-sky-200">
        «{source.title}»
      </a>
      ، {source.author}
      {volume && <>، {volume}</>}
      {page && <>، ص {toArabicDigits(page)}</>}
    </p>
  );
}

function RoundCard({
  round,
  index,
  picked,
  onPick,
  onNext,
  onSummary,
  isLast,
}: {
  round: Round;
  index: number;
  picked: string | null;
  onPick: (choice: string) => void;
  onNext: () => void;
  /** Set when revisiting a finished day: jumps straight back to the results. */
  onSummary?: () => void;
  isLast: boolean;
}) {
  const answered = picked !== null;
  const correct = picked === round.answer;

  // 1–4 picks a choice, Enter moves on once answered.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = "1234".indexOf(e.key) + 1 || "١٢٣٤".indexOf(e.key) + 1;
      if (!answered && n && round.choices[n - 1]) onPick(round.choices[n - 1]);
      if (answered && e.key === "Enter") onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answered, round, onPick, onNext]);

  const size =
    round.kind === "origin" || round.kind === "root"
      ? "text-5xl sm:text-6xl"
      : round.kind === "custom" || round.kind === "riddle"
        ? "text-2xl sm:text-3xl"
        : "text-3xl sm:text-4xl";
  const question = KIND_QUESTION[round.kind];
  return (
    <section className="animate-fade-in" aria-label={`الجولة ${toArabicDigits(index + 1)}`}>
      <div className="flex flex-col items-center gap-3 mb-6">
        <span className="text-sm text-sky-200">{KIND_LABEL[round.kind]}</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1 text-xs text-sky-100/90">
          <PinIcon className="w-3.5 h-3.5" />
          {placeLine(round.kind, round.source.place)}
        </span>
      </div>

      <div className="text-center mb-8">
        <p className={`font-naskh text-paper leading-[1.9] ${size}`}>
          <PromptText round={round} picked={picked} />
        </p>
        {round.hint && <p className="mt-3 text-paper/55">({round.hint})</p>}
        {question && <p className="mt-5 text-paper/70">{question}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {round.choices.map((c, i) => {
          const isAnswer = c === round.answer;
          const isPicked = c === picked;
          const tone = !answered
            ? "border-paper/15 hover:border-sky-300/60 hover:bg-sky-400/5"
            : isAnswer
              ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-100"
              : isPicked
                ? "border-rose-400/70 bg-rose-500/15 text-rose-100"
                : "border-paper/10 text-paper/35";
          return (
            <button
              key={c}
              type="button"
              disabled={answered}
              onClick={() => onPick(c)}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-start font-naskh text-xl transition-colors ${tone}`}
            >
              <span className="text-xs font-mono text-paper/35 w-4 shrink-0">{toArabicDigits(i + 1)}</span>
              <span className="flex-1">{c}</span>
              {answered && isAnswer && <span aria-label="صحيح">✓</span>}
              {answered && isPicked && !isAnswer && <span aria-label="خطأ">✗</span>}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="mt-8 rounded-xl border border-paper/10 bg-ink-1/80 p-5 space-y-3 animate-fade-in">
          <p className={correct ? "text-emerald-200" : "text-rose-200"}>
            {correct ? (
              "إجابة صحيحة!"
            ) : (
              <>
                الإجابة: <span className="font-naskh text-xl text-paper">{round.answer}</span>
              </>
            )}
          </p>
          {round.note && <p className="text-paper/75 leading-loose">{round.note}</p>}
          <SourceLine round={round} />
          {round.note && (
            <p className="text-xs text-paper/45">الشرح من إعداد اللعبة بمساعدة الذكاء الاصطناعي، وقد يقع فيه خطأ.</p>
          )}
          <div className="pt-2 flex flex-wrap justify-end gap-3">
            {onSummary && !isLast && (
              <button
                type="button"
                onClick={onSummary}
                className="px-5 py-3 rounded-md border border-paper/20 text-paper/80 hover:border-sky-300/60 hover:text-sky-200"
              >
                النتيجة
              </button>
            )}
            <button
              type="button"
              onClick={onNext}
              autoFocus
              className="px-5 py-3 rounded-md bg-sky-200 text-ink font-bold hover:bg-sky-100"
            >
              {isLast ? "النتيجة ←" : "السؤال التالي ←"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Steps({ session, onOpen }: { session: Session; onOpen: (index: number) => void }) {
  return (
    <ol className="flex flex-wrap items-center justify-center gap-2 mb-10" aria-label="أسئلة اليوم">
      {session.day.rounds.map((r, i) => {
        const p = session.picks[i];
        const tone =
          p === null
            ? "border-paper/20 text-paper/50"
            : p === r.answer
              ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
              : "border-rose-400/60 bg-rose-500/15 text-rose-200";
        const label = (
          <>
            {toArabicDigits(i + 1)} · {KIND_LABEL[r.kind]}
            {p === null ? "" : p === r.answer ? " ✓" : " ✗"}
          </>
        );
        const canOpen = p !== null && i !== session.round;
        return (
          <li
            key={r.id}
            aria-current={i === session.round ? "step" : undefined}
            className={`rounded-full border text-xs ${tone} ${i === session.round ? "ring-1 ring-sky-200/60" : ""}`}
          >
            {canOpen ? (
              <button type="button" onClick={() => onOpen(i)} title="راجع السؤال" className="px-3 py-1 rounded-full hover:bg-paper/10">
                {label}
              </button>
            ) : (
              <span className="block px-3 py-1">{label}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function useCountdown(): string {
  const [ms, setMs] = useState(() => msUntilNext());
  useEffect(() => {
    const id = setInterval(() => setMs(msUntilNext()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.floor(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return toArabicDigits(`${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`);
}

function Summary({
  session,
  count,
  onShare,
  onReview,
  onArchive,
}: {
  session: Session;
  count: number;
  onShare: (text: string) => void;
  onReview: (index: number) => void;
  onArchive: () => void;
}) {
  const { day, picks, mode } = session;
  const results = day.rounds.map((r, i) => ({
    kind: r.kind,
    correct: picks[i] === r.answer,
  }));
  const score = results.filter((r) => r.correct).length;
  const countdown = useCountdown();
  const stats = load().stats;
  const verdict = ["لا بأس، غدًا أسئلة جديدة.", "بداية طيبة!", "أحسنت! كدت تكملها.", "ممتاز! العلامة الكاملة."][score];
  return (
    <section className="text-center space-y-8 animate-fade-in">
      <div>
        <p className="text-paper/50 text-sm">نتيجة اليوم #{toArabicDigits(day.number)}</p>
        <p className="font-naskh text-6xl text-sky-200 mt-2">
          {toArabicDigits(score)}/{toArabicDigits(results.length)}
        </p>
        <p className="mt-3 text-paper/80">{verdict}</p>
      </div>

      <ul className="space-y-2 max-w-sm mx-auto text-start">
        {day.rounds.map((r, i) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onReview(i)}
              title="راجع السؤال"
              className="w-full flex items-baseline gap-3 rounded-lg border border-paper/10 px-4 py-2 text-start hover:border-sky-300/50 hover:bg-sky-400/5 transition-colors"
            >
              <span className={results[i].correct ? "text-emerald-300" : "text-rose-300"}>{results[i].correct ? "✓" : "✗"}</span>
              <span className="text-xs text-paper/45 w-16 shrink-0">{r.source.place}</span>
              <span className="font-naskh text-lg truncate flex-1">
                {r.kind === "saying" ? r.prompt.replace(BLANK, r.answer) : r.kind === "custom" ? r.answer : r.prompt}
              </span>
              <span className="text-xs text-paper/40 shrink-0">راجع ←</span>
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => onShare(shareText(day.number, results))}
        className="px-6 py-3 rounded-md bg-sky-200 text-ink font-bold hover:bg-sky-100"
      >
        شارك النتيجة
      </button>

      {mode !== "daily" ? (
        <PreviewNav number={day.number} count={count} archive={mode === "archive"} />
      ) : (
        <div className="flex justify-center gap-10 text-sm text-paper/60">
          <div>
            <p className="font-mono text-paper text-lg">{countdown}</p>
            <p>للأسئلة الجديدة</p>
          </div>
          <div>
            <p className="font-mono text-paper text-lg">{toArabicDigits(currentStreak(stats, todayNumber()))}</p>
            <p>أيام متتالية</p>
          </div>
        </div>
      )}

      {mode !== "preview" && (
        <button type="button" onClick={onArchive} className="text-sm text-paper/60 underline underline-offset-4 hover:text-sky-200">
          العب الأيام السابقة
        </button>
      )}
    </section>
  );
}

/**
 * Step to the day before or after. Past days (`archive`) stop at today, whose link is the plain
 * page; previews (before launch, or dev) step through every day.
 */
function PreviewNav({ number, count, archive }: { number: number; count: number; archive: boolean }) {
  const link = (n: number) => (archive && n === todayNumber() ? "./" : `?day=${n}`);
  const last = archive ? todayNumber() : count;
  return (
    <nav className="flex items-center justify-center gap-4 text-sm text-paper/60" aria-label={archive ? "الأيام السابقة" : "معاينة الأيام"}>
      {number > 1 && (
        <a className="hover:text-sky-200" href={link(number - 1)}>
          → اليوم {toArabicDigits(number - 1)}
        </a>
      )}
      <span className="text-paper/35">
        {archive ? "يوم سابق" : "معاينة"} · {toArabicDigits(number)} من {toArabicDigits(last)}
      </span>
      {number < last && (
        <a className="hover:text-sky-200" href={link(number + 1)}>
          اليوم {toArabicDigits(number + 1)} ←
        </a>
      )}
    </nav>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="كيف تلعب" onClose={onClose}>
      <div className="space-y-4 text-paper/80 leading-loose">
        <p>كل يوم ثلاثة أسئلة من كتب جمعت أمثال الناس وكلامهم وعاداتهم في أنحاء العالم العربي. لكل سؤال أربعة خيارات ومحاولة واحدة:</p>
        <ol className="list-decimal ps-6 space-y-1">
          <li>
            <span className="text-sky-200">أكمل المثل</span>: اختر الكلمة الناقصة.
          </li>
          <li>
            <span className="text-sky-200">متى يُقال؟</span> أو <span className="text-sky-200">ما معناه؟</span>: في أيّ موقف يُضرب المثل، أو ما
            معنى التعبير.
          </li>
          <li>
            <span className="text-sky-200">سؤال متنوّع</span>: أصل كلمة، أو أصلها الفصيح، أو حزّورة، أو عادة من العادات القديمة.
          </li>
        </ol>
        <p>
          فوق كل سؤال تجد البلد الذي يقولونه فيه كما ذكره الكتاب، وكثير من الأمثال تقال في أكثر من بلد. وبعد كل إجابة تجد شرحًا قصيرًا واسم
          الكتاب. تتجدد الأسئلة كل يوم عند منتصف الليل بتوقيت مكة.
        </p>
        <p className="text-sm text-paper/50" dir="ltr">
          Keyboard: <kbd>1</kbd>–<kbd>4</kbd> to answer, <kbd>Enter</kbd> for the next question.
        </p>
      </div>
    </Modal>
  );
}

/** Credits: every book the game draws from, grouped by place. */
function Credits({ sources }: { sources: Source[] }) {
  const books = [...sources].sort((a, b) => a.place.localeCompare(b.place, "ar"));
  return (
    <aside className="mt-20 pt-10 border-t border-paper/10 space-y-4 text-sm text-paper/65 leading-loose" aria-label="عن اللعبة">
      <p>أسئلة «عربيّات» مأخوذة من هذه الكتب، وتذكر كل إجابة كتابها:</p>
      <ul className="space-y-1">
        {books.map((b) => (
          <li key={b.id}>
            <span className="text-paper/45">{b.place}:</span>{" "}
            <a href={b.url} target="_blank" rel="noreferrer" className="text-paper hover:text-sky-200">
              «{b.title}»
            </a>
            ، {b.author}
          </li>
        ))}
      </ul>
      <p className="text-paper/45">
        الأمثال والكلمات منقولة كما وردت في الكتب. الشروح القصيرة والخيارات من إعداد اللعبة بمساعدة الذكاء الاصطناعي، وقد روجعت الشروح على الكتب، لكن بعضها لم يمكن التحقق منه. إن وجدت خطأ فأخبرني.
      </p>
    </aside>
  );
}

async function share(text: string): Promise<boolean> {
  trackEvent("arabiyyat/share");
  try {
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ text });
      return false;
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function Arabiyyat() {
  const [store, setStore] = useState<DayStore<Day> | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const closeArchive = useCallback(() => setArchiveOpen(false), []);
  const [toast, setToast] = useState<string | null>(null);
  const closeHelp = useCallback(() => setHelp(false), []);
  const [intro, setIntro] = useState(() => shouldPlayIntro(INTRO_KEY, "intro"));
  const closeIntro = useCallback(() => setIntro(false), []);
  const miniMap = useRef<HTMLDivElement>(null);
  const findMiniMap = useCallback(() => miniMap.current?.querySelector("svg") ?? null, []);
  useEffect(() => {
    if (intro) markIntroSeen(INTRO_KEY);
  }, [intro]);

  useEffect(() => {
    import("virtual:arabiyyat-days")
      .then(async (m) => {
        const days = dayStore<Day>(m);
        const s = await startSession(days);
        setStore(days);
        setSources(m.sources);
        setSession(s);
        if (s?.mode === "daily" && !load().stats.played && s.picks.every((p) => p === null)) setHelp(true);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  const pick = (choice: string) =>
    setSession((s) => {
      if (!s || s.picks[s.round] !== null) return s;
      const next = {
        ...s,
        picks: s.picks.map((p, i) => (i === s.round ? choice : p)),
      };
      if (s.round === 0) trackEvent(s.mode === "daily" ? "arabiyyat/start" : `arabiyyat/${s.mode}`);
      persist(next);
      return next;
    });

  // Bring the question tracker back to the top when moving on (the answered card is taller).
  const playRef = useRef<HTMLDivElement>(null);
  const shownRound = session?.round;
  const lastRound = useRef(shownRound);
  useLayoutEffect(() => {
    const moved = lastRound.current !== undefined && lastRound.current !== shownRound;
    lastRound.current = shownRound;
    const el = playRef.current;
    if (moved && el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
  }, [shownRound]);
  const nextRound = () => setSession((s) => (s ? { ...s, round: Math.min(s.round + 1, s.day.rounds.length) } : s));
  const openRound = (i: number) =>
    setSession((s) => (s && (i < s.day.rounds.length ? s.picks[i] !== null : s.picks.every((p) => p !== null)) ? { ...s, round: i } : s));
  const dayDone = session?.picks.every((p) => p !== null) ?? false;

  const round = session && session.round < session.day.rounds.length ? session.day.rounds[session.round] : null;
  const pins: MapPin[] | null = !session
    ? null
    : round
      ? [{ lat: round.source.lat, lon: round.source.lon }]
      : session.day.rounds.map((r, i) => ({ lat: r.source.lat, lon: r.source.lon, label: i + 1 }));

  return (
    <div className="font-[system-ui,'Segoe_UI',Tahoma,sans-serif]">
      <SiteLayout
        headerStart={
          <a href="/" className="text-sm text-paper/40 hover:text-sky-200 transition-colors">
            → الرئيسية
          </a>
        }
        headerEnd={<span className="text-xs text-paper/25">أمثال وكلام من العالم العربي</span>}
      >
        <main className="relative z-10 mx-auto max-w-2xl px-4 pt-8 pb-4">
          <div className="flex items-start justify-between gap-3 mb-8">
            <div className="flex items-start gap-3">
              <DallahIcon className="w-11 h-11 text-sky-200/80 shrink-0 mt-1" />
              <div>
                <h1 className="font-naskh text-4xl text-sky-200 leading-tight">{GAME_NAME}</h1>
                <p className="text-sm text-paper/50">
                  ثلاثة أسئلة كل يوم من أمثال العرب وكلامهم
                  {session && (
                    <>
                      {/* Each piece stays on one line; a narrow screen wraps between them. */}{" "}
                      <span className="whitespace-nowrap">
                        · {session.mode === "daily" ? "اليوم" : session.mode === "archive" ? "يوم سابق" : "معاينة"} #
                        {toArabicDigits(session.day.number)}
                      </span>
                      {session.mode === "archive" && (
                        <>
                          {" "}
                          <span className="whitespace-nowrap">
                            ·{" "}
                            <a href="./" className="underline underline-offset-4 hover:text-paper">
                              العودة إلى اليوم
                            </a>
                          </span>
                        </>
                      )}
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isLaunched() && (
                <button
                  type="button"
                  onClick={() => setArchiveOpen(true)}
                  className="h-10 px-3 rounded-md border border-paper/15 text-sm text-paper/70 hover:text-sky-200 hover:border-sky-300/50 transition-colors"
                >
                  الأرشيف
                </button>
              )}
              <button
                type="button"
                onClick={() => setHelp(true)}
                title="كيف تلعب"
                aria-label="كيف تلعب"
                className="w-10 h-10 grid place-items-center rounded-md border border-paper/15 text-paper/70 hover:text-sky-200 hover:border-sky-300/50 transition-colors"
              >
                <HelpIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {error && <p className="text-rose-300">تعذّر تحميل اللعبة: {error}</p>}
          {!store && !error && <p className="text-paper/40 py-24 text-center">جارٍ التحميل…</p>}
          {store && !session && <p className="text-paper/70 py-24 text-center">أسئلة اليوم في الطريق. حدّث الصفحة بعد قليل.</p>}

          <div ref={playRef} className="scroll-mt-4" />
          {session && <Steps session={session} onOpen={openRound} />}
          {session && pins && (
            // Hidden, not removed, during the opening scene: it lands exactly here.
            <div ref={miniMap} className="-mt-4 mb-6" style={intro ? { visibility: "hidden" } : undefined}>
              <MiniMap
                pins={pins}
                title={`خريطة: ${round ? round.source.place : session.day.rounds.map((r) => r.source.place).join("، ")}`}
              />
            </div>
          )}
          {session && round && (
            <RoundCard
              key={round.id}
              round={round}
              index={session.round}
              picked={session.picks[session.round]}
              onPick={pick}
              onNext={nextRound}
              onSummary={dayDone ? () => openRound(session.day.rounds.length) : undefined}
              isLast={session.round === session.day.rounds.length - 1}
            />
          )}
          {session && store && !round && (
            <Summary
              session={session}
              count={store.last}
              onReview={openRound}
              onArchive={() => setArchiveOpen(true)}
              onShare={async (text) => {
                if (await share(text)) setToast("نُسخت النتيجة");
              }}
            />
          )}

          {sources.length > 0 && <Credits sources={sources} />}

          {help && !intro && <HelpModal onClose={closeHelp} />}
          {intro && <MapIntro books={sources} pins={pins} target={findMiniMap} onDone={closeIntro} />}
          {archiveOpen && LAUNCH_DATE && (
            <ArchiveModal today={todayNumber()} launchDate={LAUNCH_DATE} archive={loadArchive(GAME)} accent="sky" onClose={closeArchive} />
          )}
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
