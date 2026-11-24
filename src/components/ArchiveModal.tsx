import { type Archive, dateOfDay, dayHref, randomPastDay } from "../lib/archive";
import { toArabicDigits } from "../pages/shakkil/core/share";
import { Modal } from "../pages/shakkil/ui/Modals";

/** Literal class names per game, so Tailwind sees them. */
const ACCENT = {
  gold: { hover: "hover:border-gold/60 hover:text-gold", button: "bg-gold" },
  sky: { hover: "hover:border-sky-200/60 hover:text-sky-200", button: "bg-sky-200" },
};

const MONTH = new Intl.DateTimeFormat("ar", { month: "long", year: "numeric", timeZone: "UTC", calendar: "gregory", numberingSystem: "arab" });
const DATE = new Intl.DateTimeFormat("ar", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC", calendar: "gregory", numberingSystem: "arab" });

/**
 * Every past day of a daily game, newest first and grouped by month, with how each one went.
 * Days open as `?day=N`; archive plays are saved apart from the daily stats (src/lib/archive.ts).
 */
export function ArchiveModal({
  today,
  launchDate,
  archive,
  accent,
  onClose,
}: {
  /** Today's day number; the archive lists the days before it. */
  today: number;
  launchDate: string;
  archive: Archive<unknown>;
  accent: keyof typeof ACCENT;
  onClose: () => void;
}) {
  const a = ACCENT[accent];
  const months: { label: string; days: number[] }[] = [];
  for (let n = today - 1; n >= 1; n--) {
    const label = MONTH.format(dateOfDay(launchDate, n));
    if (months[months.length - 1]?.label !== label) months.push({ label, days: [] });
    months[months.length - 1].days.push(n);
  }
  const played = Object.keys(archive).filter((k) => Number(k) < today && archive[Number(k)].score).length;
  const random = randomPastDay(today, archive);

  return (
    <Modal title="الأيام السابقة" onClose={onClose}>
      {months.length === 0 ? (
        <p className="text-paper/70">لا أيام سابقة بعد. عد غدًا!</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <p className="text-sm text-paper/60">
              أكملت {toArabicDigits(played)} من {toArabicDigits(today - 1)}. الأيام السابقة لا تُحسب في الإحصاءات.
            </p>
            {random !== null && (
              <a href={dayHref(random)} className={`px-4 py-2 rounded-md text-sm text-ink font-bold ${a.button} hover:opacity-90`}>
                يوم عشوائي
              </a>
            )}
          </div>
          <div className="space-y-6">
            {months.map((m) => (
              <section key={m.label}>
                <h3 className="text-sm text-paper/50 mb-2">{m.label}</h3>
                <ol className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                  {m.days.map((n) => (
                    <li key={n}>
                      <DayTile n={n} entry={archive[n]} date={DATE.format(dateOfDay(launchDate, n))} hover={a.hover} />
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

function DayTile({ n, entry, date, hover }: { n: number; entry?: Archive<unknown>[number]; date: string; hover: string }) {
  const score = entry?.score;
  const perfect = score && score.got === score.of;
  const tone = perfect
    ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-200"
    : score
      ? "border-amber-300/40 bg-amber-400/5 text-amber-100"
      : entry
        ? "border-dashed border-paper/40 text-paper/80"
        : "border-paper/15 text-paper/80";
  const status = perfect ? "✓" : score ? `${toArabicDigits(score.got)}/${toArabicDigits(score.of)}` : entry ? "…" : "";
  const label = `اليوم ${toArabicDigits(n)}، ${date}${score ? `، ${toArabicDigits(score.got)} من ${toArabicDigits(score.of)}` : entry ? "، لم يكتمل" : ""}`;
  return (
    <a
      href={dayHref(n)}
      title={label}
      aria-label={label}
      className={`flex flex-col items-center justify-center h-14 rounded-md border transition-colors ${tone} ${hover}`}
    >
      <span className="font-mono text-sm">{toArabicDigits(n)}</span>
      <span className="text-[11px] leading-none h-3">{status}</span>
    </a>
  );
}
