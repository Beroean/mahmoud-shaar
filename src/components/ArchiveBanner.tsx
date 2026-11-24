import { formatDayDate } from "../lib/archive";
import { toArabicDigits } from "../pages/shakkil/core/share";
import { HistoryIcon } from "./icons";

/** Literal class names per game, so Tailwind sees them. */
const ACCENT = {
  gold: { box: "border-gold/40 bg-gold/10", icon: "text-gold", button: "bg-gold hover:bg-gold/90" },
  sky: { box: "border-sky-200/40 bg-sky-200/10", icon: "text-sky-200", button: "bg-sky-200 hover:bg-sky-200/90" },
};

/**
 * Shown above the game on a past day (`?day=N`), so it's clear this isn't today's game and the way
 * back is one big tap. Today is the plain page (`./`).
 */
export function ArchiveBanner({
  number,
  launchDate,
  accent,
  todayLabel,
}: {
  number: number;
  /** Day 1's date (YYYY-MM-DD); without it the date is left out. */
  launchDate: string | null;
  accent: keyof typeof ACCENT;
  /** Text of the button back to today, e.g. «أسئلة اليوم». */
  todayLabel: string;
}) {
  const a = ACCENT[accent];
  const date = launchDate ? formatDayDate(launchDate, number) : null;
  return (
    <div role="status" className={`mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border px-4 py-3 ${a.box}`}>
      <div className="flex flex-1 min-w-[14rem] items-center gap-3">
        <HistoryIcon className={`w-7 h-7 shrink-0 ${a.icon}`} />
        <div>
          <p className="font-bold text-paper">أنت تلعب يومًا سابقًا</p>
          {/* A comma, not «·», next to the digits: the dot reads like an Arabic zero (٠). */}
          <p className="text-sm text-paper/70">
            اليوم {toArabicDigits(number)}
            {date && `، ${date}`}
          </p>
          <p className="text-xs text-paper/50">لا يُحسب في الإحصاءات</p>
        </div>
      </div>
      <a
        href="./"
        className={`w-full sm:w-auto text-center px-4 py-2.5 rounded-md text-ink font-bold whitespace-nowrap transition-colors ${a.button}`}
      >
        {todayLabel} ←
      </a>
    </div>
  );
}
