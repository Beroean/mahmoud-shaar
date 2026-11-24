import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { HelpIcon } from "../../components/icons";
import { SiteLayout } from "../../components/SiteLayout";
import { trackEvent } from "../../lib/analytics";
import { type DayStore, dayStore } from "../../lib/dayStore";
import { toArabicDigits } from "../shakkil/core/share";
import { Modal } from "../shakkil/ui/Modals";
import { isLaunched, msUntilNext, previewNumber, todayNumber } from "./core/daily";
import { GAME_NAME, KIND_LABEL, KIND_QUESTION, shareText } from "./core/share";
import { type SaveData, currentStreak, load, recordDay, save } from "./core/storage";
import { BLANK, type Day, type Round } from "./core/types";
import { Credits, Dedication } from "./ui/Credits";
import { GateIntro } from "./ui/GateIntro";
import { shouldShowGate } from "./ui/gateState";

interface Session {
  day: Day;
  picks: (string | null)[];
  /** Round being shown (3 = the day's summary). */
  round: number;
  /** Preview days (before launch, or ?day=N) are never saved or counted. */
  preview: boolean;
}

async function startSession(store: DayStore<Day>): Promise<Session | null> {
  const preview = previewNumber(location.search, store.last, import.meta.env.DEV);
  const number = preview ?? todayNumber();
  const day = (await store.day(number))[0] ?? (isLaunched() ? null : ((await store.day(1))[0] ?? null));
  if (!day) return null;
  const isPreview = preview !== null || !isLaunched();
  let picks: (string | null)[] = day.rounds.map(() => null);
  if (!isPreview) {
    const saved = load().daily;
    if (saved?.day === day.number && saved.ids.join() === day.rounds.map((r) => r.id).join()) picks = saved.picks;
  }
  const open = picks.findIndex((p) => p === null);
  return { day, picks, round: open === -1 ? day.rounds.length : open, preview: isPreview };
}

function persist(s: Session) {
  if (s.preview) return;
  const data: SaveData = load();
  const ids = s.day.rounds.map((r) => r.id);
  const done = s.picks.every((p) => p !== null);
  const counted = data.daily?.day === s.day.number && data.daily.picks.every((p) => p !== null);
  data.daily = { day: s.day.number, ids, picks: s.picks };
  if (done && !counted) {
    const score = s.day.rounds.filter((r, i) => s.picks[i] === r.answer).length;
    data.stats = recordDay(data.stats, s.day.number, score);
    trackEvent(`halab/day-score-${score}`);
  }
  save(data);
}

/** The prompt with its blank: dotted before answering, the answer once chosen. */
function PromptText({ round, picked }: { round: Round; picked: string | null }) {
  const [before, after = ""] = round.prompt.split(BLANK);
  if (!round.prompt.includes(BLANK)) return <>{round.prompt}</>;
  const correct = picked === round.answer;
  return (
    <>
      {before}
      {picked === null ? (
        <span className="inline-block min-w-[3.5em] border-b-2 border-dotted border-gold/70 mx-1 align-baseline">&nbsp;</span>
      ) : (
        <span className={`mx-1 border-b-2 ${correct ? "text-emerald-200 border-emerald-400/70" : "text-gold border-gold/60"}`}>
          {round.answer}
        </span>
      )}
      {after}
    </>
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

  const big = round.kind === "origin";
  return (
    <section className="animate-fade-in" aria-label={`الجولة ${toArabicDigits(index + 1)}`}>
      <div className="flex items-center justify-center gap-3 mb-6">
        <div className="h-px w-10 bg-gold/60" />
        <span className="text-sm text-gold">{KIND_LABEL[round.kind]}</span>
        <div className="h-px w-10 bg-gold/60" />
      </div>

      <div className="text-center mb-8">
        <p className={`font-naskh text-paper leading-[1.9] ${big ? "text-5xl sm:text-6xl" : "text-3xl sm:text-4xl"}`}>
          <PromptText round={round} picked={picked} />
        </p>
        {round.hint && <p className="mt-3 text-paper/55">({round.hint})</p>}
        <p className="mt-5 text-paper/70">{KIND_QUESTION[round.kind](round.prompt)}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {round.choices.map((c, i) => {
          const isAnswer = c === round.answer;
          const isPicked = c === picked;
          const tone = !answered
            ? "border-paper/15 hover:border-gold/60 hover:bg-gold/5"
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
              {answered && isAnswer && <span aria-label="صح">✓</span>}
              {answered && isPicked && !isAnswer && <span aria-label="غلط">✗</span>}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="mt-8 rounded-xl border border-paper/10 bg-ink-1/80 p-5 space-y-3 animate-fade-in">
          <p className={correct ? "text-emerald-200" : "text-rose-200"}>
            {correct ? "صح! أحسنت." : <>الجواب: <span className="font-naskh text-xl text-paper">{round.answer}</span></>}
          </p>
          {round.meaning && <p className="text-paper/80 leading-loose">{round.meaning}</p>}
          {round.note && <p className="text-paper/60 leading-loose">{round.note}</p>}
          <p className="text-xs text-paper/35">
            {round.entry ? <>من مادّة «{round.entry}» في موسوعة حلب المقارنة</> : <>من موسوعة حلب المقارنة</>}
          </p>
          <div className="pt-2 flex flex-wrap justify-end gap-3">
            {onSummary && !isLast && (
              <button
                type="button"
                onClick={onSummary}
                className="px-5 py-3 rounded-md border border-paper/20 text-paper/80 hover:border-gold/60 hover:text-gold"
              >
                نتيجة اليوم
              </button>
            )}
            <button
              type="button"
              onClick={onNext}
              autoFocus
              className="px-5 py-3 rounded-md bg-gold text-ink font-bold hover:bg-gold/90"
            >
              {isLast ? "نتيجة اليوم ←" : "الجولة التالية ←"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Steps({ session, onOpen }: { session: Session; onOpen: (index: number) => void }) {
  return (
    <ol className="flex flex-wrap items-center justify-center gap-2 mb-10" aria-label="جولات اليوم">
      {session.day.rounds.map((r, i) => {
        const p = session.picks[i];
        const tone =
          p === null ? "border-paper/20 text-paper/50" : p === r.answer ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200" : "border-rose-400/60 bg-rose-500/15 text-rose-200";
        const label = (
          <>
            {toArabicDigits(i + 1)} · {KIND_LABEL[r.kind]}
            {p === null ? "" : p === r.answer ? " ✓" : " ✗"}
          </>
        );
        // Answered rounds can be reopened to see the full question again.
        const canOpen = p !== null && i !== session.round;
        return (
          <li
            key={r.id}
            aria-current={i === session.round ? "step" : undefined}
            className={`rounded-full border text-xs ${tone} ${i === session.round ? "ring-1 ring-paper/60" : ""}`}
          >
            {canOpen ? (
              <button type="button" onClick={() => onOpen(i)} title="راجع الجولة" className="px-3 py-1 rounded-full hover:bg-paper/10">
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
}: {
  session: Session;
  count: number;
  onShare: (text: string) => void;
  onReview: (index: number) => void;
}) {
  const { day, picks, preview } = session;
  const results = day.rounds.map((r, i) => ({ kind: r.kind, correct: picks[i] === r.answer }));
  const score = results.filter((r) => r.correct).length;
  const countdown = useCountdown();
  const stats = load().stats;
  const verdict = ["ولا يهمّك، بكرا منعيد.", "منيحة! بكرا أحسن.", "برافو! قرّبت.", "يا عيني! حلبي أصيل."][score];
  return (
    <section className="text-center space-y-8 animate-fade-in">
      <div>
        <p className="text-paper/50 text-sm">نتيجة اليوم #{toArabicDigits(day.number)}</p>
        <p className="font-naskh text-6xl text-gold mt-2">
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
              title="راجع الجولة"
              className="w-full flex items-baseline gap-3 rounded-lg border border-paper/10 px-4 py-2 text-start hover:border-gold/50 hover:bg-gold/5 transition-colors"
            >
              <span className={results[i].correct ? "text-emerald-300" : "text-rose-300"}>{results[i].correct ? "✓" : "✗"}</span>
              <span className="text-xs text-paper/45 w-24 shrink-0">{KIND_LABEL[r.kind]}</span>
              <span className="font-naskh text-lg truncate flex-1">{r.kind === "origin" ? `${r.prompt}: ${r.answer}` : r.answer}</span>
              <span className="text-xs text-paper/40 shrink-0">راجع ←</span>
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => onShare(shareText(day.number, results))}
        className="px-6 py-3 rounded-md bg-gold text-ink font-bold hover:bg-gold/90"
      >
        شارك النتيجة
      </button>

      {preview ? (
        <PreviewNav number={day.number} count={count} />
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
    </section>
  );
}

/** Review aid: step through every day of the prototype. */
function PreviewNav({ number, count }: { number: number; count: number }) {
  const link = (n: number) => `?day=${n}`;
  return (
    <nav className="flex items-center justify-center gap-4 text-sm text-paper/60" aria-label="معاينة الأيام">
      {number > 1 && (
        <a className="hover:text-gold" href={link(number - 1)}>
          → اليوم {toArabicDigits(number - 1)}
        </a>
      )}
      <span className="text-paper/35">
        معاينة · {toArabicDigits(number)} من {toArabicDigits(count)}
      </span>
      {number < count && (
        <a className="hover:text-gold" href={link(number + 1)}>
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
        <p>كل يوم ثلاث جولات من «موسوعة حلب المقارنة»، ولكل جولة أربعة خيارات ومحاولة واحدة:</p>
        <ol className="list-decimal ps-6 space-y-1">
          <li>
            <span className="text-gold">أصل الكلمة</span>: من أيّ لغة وصلت الكلمة إلى حكي أهل حلب؟
          </li>
          <li>
            <span className="text-gold">كمّل المثل</span>: اختر الكلمة الناقصة من مثل حلبي، أو حكمة، أو تهكّم ظريف.
          </li>
          <li>
            <span className="text-gold">جولة مفاجئة</span>: حزّورة، أو نداء بيّاع، أو كناية، أو تشبيه، أو دعوة، أو غنّية، أو اعتقاد من اعتقادات أهل حلب.
          </li>
        </ol>
        <p>بعد كل جواب تقرأ ما قالته الموسوعة. وتتجدد الأسئلة كل يوم عند منتصف الليل بتوقيت مكة.</p>
        <p className="text-sm text-paper/50" dir="ltr">
          Keyboard: <kbd>1</kbd>–<kbd>4</kbd> to answer, <kbd>Enter</kbd> for the next round.
        </p>
      </div>
    </Modal>
  );
}

async function share(text: string): Promise<boolean> {
  trackEvent("halab/share");
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

export default function Halab() {
  const [store, setStore] = useState<DayStore<Day> | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [gate, setGate] = useState(shouldShowGate);
  const closeGate = useCallback(() => setGate(false), []);

  useEffect(() => {
    import("virtual:halab-days")
      .then(async (m) => {
        const days = dayStore<Day>(m);
        const s = await startSession(days);
        setStore(days);
        setSession(s);
        if (s && !s.preview && !load().stats.played && s.picks.every((p) => p === null)) setHelp(true);
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
      const next = { ...s, picks: s.picks.map((p, i) => (i === s.round ? choice : p)) };
      if (s.round === 0) trackEvent(s.preview ? "halab/preview" : "halab/start");
      persist(next);
      return next;
    });

  // The answered card is taller than the next one, so the old scroll position would open the next
  // round part-way down. Bring the round tracker back to the top instead.
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
  // Reopen an answered round (read-only, since it already has a pick), or the summary once all are answered.
  const openRound = (i: number) =>
    setSession((s) => (s && (i < s.day.rounds.length ? s.picks[i] !== null : s.picks.every((p) => p !== null)) ? { ...s, round: i } : s));
  const dayDone = session?.picks.every((p) => p !== null) ?? false;

  const round = session && session.round < session.day.rounds.length ? session.day.rounds[session.round] : null;

  return (
    <div className="font-[system-ui,'Segoe_UI',Tahoma,sans-serif]">
      <SiteLayout
        headerStart={
          <a href="/" className="text-sm text-paper/40 hover:text-gold transition-colors">
            → الرئيسية
          </a>
        }
        headerEnd={<span className="text-xs text-paper/25">من موسوعة حلب المقارنة</span>}
      >
        <main className="relative z-10 mx-auto max-w-2xl px-4 pt-8 pb-4">
          <div className="flex items-start justify-between gap-3 mb-8">
            <div>
              <h1 className="font-naskh text-4xl text-gold leading-tight">{GAME_NAME}</h1>
              <p className="text-sm text-paper/50">
                ثلاث جولات كل يوم
                {session && <> · {session.preview ? "معاينة" : "اليوم"} #{toArabicDigits(session.day.number)}</>}
              </p>
              <Dedication />
            </div>
            <button
              type="button"
              onClick={() => setHelp(true)}
              title="كيف تلعب"
              aria-label="كيف تلعب"
              className="w-10 h-10 grid place-items-center rounded-md border border-paper/15 text-paper/70 hover:text-gold hover:border-gold/50 transition-colors"
            >
              <HelpIcon className="w-5 h-5" />
            </button>
          </div>

          {error && <p className="text-rose-300">تعذّر تحميل اللعبة: {error}</p>}
          {!store && !error && <p className="text-paper/40 py-24 text-center">جارٍ التحميل…</p>}
          {store && !session && <p className="text-paper/70 py-24 text-center">أسئلة اليوم في الطريق. حدّث الصفحة بعد قليل.</p>}

          <div ref={playRef} className="scroll-mt-4" />
          {session && <Steps session={session} onOpen={openRound} />}
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
              onShare={async (text) => {
                if (await share(text)) setToast("نُسخت النتيجة");
              }}
            />
          )}

          <Credits />

          {help && !gate && <HelpModal onClose={() => setHelp(false)} />}
          {gate && <GateIntro onDone={closeGate} />}
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
