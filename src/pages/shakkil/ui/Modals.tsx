import { type ReactNode, useEffect, useState } from "react";
import { type Word, sentenceToString, wordToString } from "../core/arabic";
import { msUntilNext } from "../core/daily";
import { shareText, toArabicDigits } from "../core/share";
import { MAX_ATTEMPTS, type Stats, currentStreak } from "../core/storage";
import type { GameState } from "../game";
import { RESULT_STYLE } from "./styles";

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-ink-1 border border-paper/15 rounded-t-2xl sm:rounded-2xl p-6 animate-fade-in"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="text-paper/50 hover:text-paper text-2xl leading-none px-2">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Swatch({ kind, label }: { kind: "correct" | "partial" | "wrong"; label: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className={`inline-block font-naskh text-2xl px-2 border-b-2 rounded-sm ${RESULT_STYLE[kind]}`}>بَ</span>
      <span>{label}</span>
    </li>
  );
}

export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="كيف تلعب" onClose={onClose}>
      <div className="space-y-4 text-paper/80 leading-loose">
        <p>
          كل يوم جملة قصيرة بلا تشكيل. ضع الحركات الصحيحة على حروفها، ولديك {toArabicDigits(MAX_ATTEMPTS)} محاولات.
        </p>
        <p>اضغط على حرف ثم اختر حركته من اللوحة. اضغط «تحقّق» عندما تنتهي.</p>
        <ul className="space-y-2">
          <Swatch kind="correct" label="صحيح، ويُثبَّت في المحاولات التالية" />
          <Swatch kind="partial" label="نصف صحيح: الحركة صحيحة والشدة لا (أو العكس)، أو تنوين بدل الحركة" />
          <Swatch kind="wrong" label="خطأ" />
        </ul>
        <p className="text-sm text-paper/60">
          لا داعي لتشكيل حروف المد ولا ألف «ال»، والسكون اختياري، وكذلك الحركة التي قبل حرف المد (مثل فتحة «كِتَاب»). أما
          الشدة وعلامات الإعراب فمطلوبة.
        </p>
        <p className="text-sm text-paper/60" dir="ltr">
          Keyboard: Arabic-layout harakat keys work directly, or use <kbd>a</kbd> <kbd>u</kbd> <kbd>i</kbd> <kbd>o</kbd> for
          fatha/damma/kasra/sukun, <kbd>A</kbd> <kbd>U</kbd> <kbd>I</kbd> for tanween, <kbd>w</kbd> for shadda, arrows to move,
          Backspace to clear, Enter to check.
        </p>
      </div>
    </Modal>
  );
}

export function StatsModal({ stats, today, onClose }: { stats: Stats; today: number; onClose: () => void }) {
  const winPct = stats.played ? Math.round((100 * stats.won) / stats.played) : 0;
  const maxDist = Math.max(1, ...stats.dist);
  const cells: [string, number][] = [
    ["لُعبت", stats.played],
    ["نسبة الفوز ٪", winPct],
    ["السلسلة", currentStreak(stats, today)],
    ["أطول سلسلة", stats.maxStreak],
  ];
  return (
    <Modal title="إحصاءاتك" onClose={onClose}>
      <div className="grid grid-cols-4 gap-2 text-center mb-6">
        {cells.map(([label, n]) => (
          <div key={label}>
            <div className="text-3xl font-bold">{toArabicDigits(n)}</div>
            <div className="text-xs text-paper/50">{label}</div>
          </div>
        ))}
      </div>
      <h3 className="text-sm text-paper/60 mb-2">عدد المحاولات للفوز</h3>
      <div className="space-y-1">
        {stats.dist.map((n, k) => (
          <div key={k} className="flex items-center gap-2 text-sm">
            <span className="w-4 tabular-nums">{toArabicDigits(k + 1)}</span>
            <div className="flex-1">
              <div className="bg-gold/70 text-ink px-2 rounded-sm text-left min-w-[1.5rem]" style={{ width: `${(100 * n) / maxDist}%` }}>
                {toArabicDigits(n)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function Countdown() {
  const [ms, setMs] = useState(() => msUntilNext());
  useEffect(() => {
    const id = setInterval(() => setMs(msUntilNext()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.floor(ms / 1000);
  const hms = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
  return <span className="tabular-nums" dir="ltr">{toArabicDigits(hms)}</span>;
}

export function ResultModal({
  state,
  number,
  daily,
  onShare,
  onPractice,
  onClose,
}: {
  state: GameState;
  number: number;
  daily: boolean;
  onShare: (text: string) => void;
  onPractice: () => void;
  onClose: () => void;
}) {
  const { puzzle, results, status } = state;
  const won = status === "won";
  const variant = puzzle.variants[results[results.length - 1]?.variant ?? 0] ?? puzzle.variants[0];
  const text = shareText(number, results.map((r) => r.letters), won);
  return (
    <Modal title={won ? "أحسنت!" : "انتهت المحاولات"} onClose={onClose}>
      <p className="text-paper/70 mb-4">
        {won
          ? `شكّلتها في ${toArabicDigits(results.length)} من ${toArabicDigits(MAX_ATTEMPTS)}.`
          : "التشكيل الصحيح:"}
      </p>
      <Answer words={variant.words} />
      <h3 className="text-sm text-paper/60 mt-6 mb-2">الإعراب</h3>
      <dl className="space-y-2 mb-4">
        {puzzle.words.map((w, k) => (
          <div key={k} className="flex gap-3 items-baseline">
            <dt className="font-naskh text-xl text-gold shrink-0">
              {wordToString(w)}
            </dt>
            <dd className="text-sm text-paper/80 leading-relaxed">{puzzle.irab[k]}</dd>
          </div>
        ))}
      </dl>
      {puzzle.author && <p className="text-xs text-paper/40 mb-4">الجملة من: {puzzle.author}</p>}
      <div className="flex flex-wrap gap-3 items-center">
        {daily && (
          <button
            type="button"
            onClick={() => onShare(text)}
            className="px-5 py-3 rounded-md bg-gold text-ink font-bold hover:bg-gold/90"
          >
            شارك النتيجة
          </button>
        )}
        <button
          type="button"
          onClick={onPractice}
          className="px-5 py-3 rounded-md border border-paper/20 hover:border-paper/50"
        >
          جملة للتدريب
        </button>
      </div>
      {daily && (
        <p className="text-sm text-paper/50 mt-5">
          الجملة التالية بعد <Countdown />
        </p>
      )}
    </Modal>
  );
}

function Answer({ words }: { words: Word[] }) {
  return <p className="font-naskh text-4xl leading-[2] text-emerald-200">{sentenceToString(words)}</p>;
}
