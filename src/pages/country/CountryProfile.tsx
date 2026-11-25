import { useEffect, useMemo, useState } from "react";
import { HomeLink, Overline, SiteLayout } from "../../components/SiteLayout";
import { ChevronIcon } from "../../components/icons";
import { Linked } from "../explore/IndicatorNotes";
import { DATASET_NAMES, GROUPS, MEASURES, type DatasetKey, type Measure, formatValue, worldBankUrl } from "./basket";
import {
  MIN_SPAN,
  RECENT_YEARS,
  STALE_AFTER,
  type Change,
  type Period,
  type Point,
  type Tally,
  type Verdict,
  flatRuleText,
  readChange,
  tally,
} from "./verdict";
import { Sparkline, TrendChart } from "./TrendChart";

// ─── Data (public/data/country, built by tools/wdi/country.ts) ────────────────

interface Country {
  id: string;
  name: string;
  region: string;
  income: string;
}
interface Index {
  countries: Country[];
  sources: Record<DatasetKey, { sourceDate: string }>;
}
/** The World Bank's own description of a series. */
interface WbNotes {
  name: string;
  unit: string;
  def: string;
  source: string;
  about: [string, string][];
  /** The latest year any country has a figure for. */
  newest: number;
}
type Series = Record<string, Point[]>;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`/data/country/${path}`);
  if (!res.ok) throw new Error(`Status ${res.status}`);
  return res.json() as Promise<T>;
}

const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

// ─── Readings ─────────────────────────────────────────────────────────────────

/** Better and worse use a validated colour pair, and always come with a shape and the word. */
const BETTER = "#199e70";
const WORSE = "#d95926";

const VERDICTS: Record<Verdict, { word: string; mark: string; color: string }> = {
  better: { word: "Better", mark: "●", color: BETTER },
  worse: { word: "Worse", mark: "◆", color: WORSE },
  flat: { word: "Little change", mark: "○", color: "rgba(232,228,220,0.55)" },
  context: { word: "Not read", mark: "–", color: "rgba(232,228,220,0.3)" },
  short: { word: "Not enough data", mark: "–", color: "rgba(232,228,220,0.3)" },
  stale: { word: "Latest figure too old", mark: "–", color: "rgba(232,228,220,0.3)" },
};

function VerdictTag({ verdict }: { verdict: Verdict }) {
  const v = VERDICTS[verdict];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-paper/80">
      <span style={{ color: v.color }} aria-hidden>
        {v.mark}
      </span>
      {v.word}
    </span>
  );
}

/** The change in the terms its little-change rule uses: units for "points" rules, else percent. */
function changeText(m: Measure, c: Change): string {
  if (c.diff === null) return "";
  const sign = c.diff > 0 ? "+" : c.diff < 0 ? "−" : "";
  if ("points" in m.flat || c.percent === null) {
    const n = Math.abs(c.diff).toLocaleString("en", { maximumFractionDigits: m.digits });
    return `${sign}${n}${m.suffix === "%" ? " pts" : (m.suffix ?? " pts")}`;
  }
  return `${sign}${Math.abs(c.percent).toLocaleString("en", { maximumFractionDigits: Math.abs(c.percent) < 10 ? 1 : 0 })}%`;
}

/** Why a measure has no reading, for this country. */
function noReadingText(c: Change, newest: number): string {
  if (!c.last) return "The World Bank has no figure for this country.";
  if (c.verdict === "stale")
    return `The latest figure is from ${c.last[0]}, more than ${STALE_AFTER} years before the newest year in the data (${newest}). It says how things were, not how they are, so it is not read.`;
  return c.first && c.first[0] !== c.last[0]
    ? `The figures here are only ${c.last[0] - c.first[0]} years apart. This page needs at least ${MIN_SPAN} years between them to read a change.`
    : `There is only one figure (${c.last[0]}), so there is no change to read.`;
}

// ─── One measure ──────────────────────────────────────────────────────────────

function Row({
  measure: m,
  notes,
  points,
  change: c,
  country,
}: {
  measure: Measure;
  notes: WbNotes | undefined;
  points: Point[];
  change: Change;
  country: Country;
}) {
  const [open, setOpen] = useState(false);
  const fmt = (v: number) => formatValue(m, v);
  return (
    <li className="border-b border-paper/10 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full text-left px-4 py-3.5 hover:bg-paper/[0.03] transition-colors duration-150"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="text-sm text-paper/90 leading-snug">{m.label}</span>
          <span className="flex items-center gap-2 pt-0.5">
            <VerdictTag verdict={c.verdict} />
            <ChevronIcon className={`w-3.5 h-3.5 text-paper/30 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </span>
        </span>
        <span className="mt-2 flex items-center gap-3">
          <Sparkline points={points} first={c.first} last={c.last} />
          <span className="text-xs text-paper/50 leading-relaxed tabular-nums">
            {c.first && c.last && c.first[0] !== c.last[0] ? (
              <>
                {fmt(c.first[1])} <span className="text-paper/30">({c.first[0]})</span> → <span className="text-paper/90">{fmt(c.last[1])}</span>{" "}
                <span className="text-paper/30">({c.last[0]})</span>
                <span className="block text-paper/40">{changeText(m, c)}</span>
              </>
            ) : c.last ? (
              <>
                <span className="text-paper/90">{fmt(c.last[1])}</span> <span className="text-paper/30">({c.last[0]})</span>
              </>
            ) : (
              <span className="text-paper/30">No figures from the World Bank</span>
            )}
          </span>
        </span>
      </button>

      {open && (
        <div className="px-4 pb-6 pt-1 space-y-5 text-xs text-paper/60 leading-relaxed">
          {points.length > 1 && <TrendChart points={points} first={c.first} last={c.last} format={fmt} label={m.label} />}

          <Block title="The World Bank's series">
            <p>
              {notes?.name ?? m.label} · <span className="text-gold/70">{m.id}</span> · {m.unit}
            </p>
            <p className="mt-1 text-paper/40">
              From the {DATASET_NAMES[m.dataset].name}. Every figure is shown as the World Bank published it.
            </p>
          </Block>

          {notes?.def && (
            <Block title="What it measures, in the World Bank's words">
              <p className="whitespace-pre-line">{notes.def}</p>
            </Block>
          )}

          <Block title="How this page reads it">
            {m.reading === "context" ? (
              <p>This measure is shown for context and is not read as better or worse. {m.basis}</p>
            ) : (
              <>
                <p>
                  A {m.reading === "higher" ? "higher" : "lower"} figure is read as better. {m.basis}
                </p>
                <p className="mt-2">
                  The latest figure is compared with the first one in the period. A difference of {flatRuleText(m)} counts
                  as little change. What happened in between does not affect the reading; the chart shows it.
                </p>
              </>
            )}
            <p className="mt-2 text-paper/80">
              {c.verdict === "short" || c.verdict === "stale" ? (
                noReadingText(c, notes?.newest ?? 0)
              ) : (
                <>
                  {country.name}: {fmt(c.first![1])} in {c.first![0]}, {fmt(c.last![1])} in {c.last![0]} ({changeText(m, c)}
                  ).{" "}
                  {c.verdict !== "context" && (
                    <>
                      Reading: <VerdictTag verdict={c.verdict} />.
                    </>
                  )}
                </>
              )}
            </p>
          </Block>

          {notes?.source && (
            <Block title="Where the World Bank gets the figures">
              <p className="whitespace-pre-line">
                <Linked text={notes.source} />
              </p>
            </Block>
          )}

          {notes && notes.about.length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs tracking-widest uppercase text-gold/60 hover:text-gold">
                The World Bank's notes and limitations
              </summary>
              <div className="mt-3 space-y-3">
                {notes.about.map(([heading, text]) => (
                  <section key={heading}>
                    <h4 className="text-paper/40 uppercase tracking-widest mb-1">{heading}</h4>
                    <p className="whitespace-pre-line">
                      <Linked text={text} />
                    </p>
                  </section>
                ))}
              </div>
            </details>
          )}

          {points.length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs tracking-widest uppercase text-gold/60 hover:text-gold">
                Every figure ({points.length})
              </summary>
              <table className="mt-3 tabular-nums">
                <thead>
                  <tr className="text-paper/30 uppercase tracking-widest">
                    <th className="text-left font-normal pr-8 pb-1">Year</th>
                    <th className="text-right font-normal pb-1">Figure</th>
                  </tr>
                </thead>
                <tbody>
                  {[...points].reverse().map(([year, value]) => (
                    <tr key={year}>
                      <td className="pr-8 text-paper/40">{year}</td>
                      <td className="text-right">{fmt(value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}

          <p className="flex flex-wrap gap-x-6 gap-y-2">
            <a href={worldBankUrl(m)} target="_blank" rel="noreferrer" className="text-gold/70 hover:text-gold underline">
              The World Bank's page for this series ↗
            </a>
            <a
              href={`/explore/?${new URLSearchParams({ dataset: m.dataset, indicator: m.id, view: "time", countries: country.id })}`}
              className="text-gold/70 hover:text-gold underline"
            >
              Compare with other countries in the Explorer →
            </a>
          </p>
        </div>
      )}
    </li>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs tracking-widest uppercase text-gold/60 mb-1">{title}</h3>
      {children}
    </section>
  );
}

// ─── The count ────────────────────────────────────────────────────────────────

const COUNTED: { key: keyof Tally | "none"; label: string; color: string; mark: string }[] = [
  { key: "better", label: "better", color: BETTER, mark: "●" },
  { key: "worse", label: "worse", color: WORSE, mark: "◆" },
  { key: "flat", label: "little change", color: "rgba(232,228,220,0.45)", mark: "○" },
  { key: "none", label: "no reading", color: "rgba(232,228,220,0.14)", mark: "–" },
];
const count = (t: Tally, key: keyof Tally | "none") => (key === "none" ? t.short + t.stale : t[key]);

function TallyBar({ t }: { t: Tally }) {
  const total = t.better + t.worse + t.flat + t.short + t.stale;
  return (
    <div>
      <div className="flex gap-[2px] h-3" role="img" aria-label={COUNTED.map((s) => `${count(t, s.key)} ${s.label}`).join(", ")}>
        {COUNTED.map(
          (s) =>
            count(t, s.key) > 0 && (
              <div key={s.key} className="rounded-sm" style={{ background: s.color, width: `${(count(t, s.key) / total) * 100}%` }} />
            ),
        )}
      </div>
      <ul className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 text-left">
        {COUNTED.map((s) => (
          <li key={s.key}>
            <span className="block font-serif text-3xl text-paper tabular-nums">{count(t, s.key)}</span>
            <span className="text-xs text-paper/50">
              <span style={{ color: s.key === "none" ? "rgba(232,228,220,0.4)" : s.color }} aria-hidden>
                {s.mark}
              </span>{" "}
              {s.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function groupSummary(t: Tally): string {
  return COUNTED.filter((s) => count(t, s.key) > 0)
    .map((s) => `${count(t, s.key)} ${s.label}`)
    .join(" · ");
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const SCORED = MEASURES.filter((m) => m.reading !== "context");

function params() {
  const p = new URLSearchParams(location.search);
  return { c: (p.get("c") ?? "").toUpperCase(), period: (p.get("period") === "recent" ? "recent" : "all") as Period };
}

export default function CountryProfile() {
  const [index, setIndex] = useState<Index | null>(null);
  const [notes, setNotes] = useState<Record<string, WbNotes>>({});
  const [code, setCode] = useState(() => params().c);
  const [period, setPeriod] = useState<Period>(() => params().period);
  const [loaded, setLoaded] = useState<{ id: string; series: Series } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson<Index>("index.json")
      .then(setIndex)
      .catch((e: Error) => setError(`Could not load the list of countries. ${e.message}`));
    getJson<Record<string, WbNotes>>("measures.json")
      .then(setNotes)
      .catch(() => {});
  }, []);

  const country = index?.countries.find((c) => c.id === code) ?? null;
  const countryId = country?.id;
  useEffect(() => {
    if (!countryId) return;
    let cancelled = false;
    getJson<Series>(`c/${countryId}.json`)
      .then((series) => {
        if (!cancelled) {
          setError(null);
          setLoaded({ id: countryId, series });
        }
      })
      .catch((e: Error) => !cancelled && setError(`Could not load this country's figures. ${e.message}`));
    return () => {
      cancelled = true;
    };
  }, [countryId]);

  // The choice lives in the URL, so a profile can be shared.
  useEffect(() => {
    const url = new URL(location.href);
    if (country) url.searchParams.set("c", country.id);
    if (period === "recent") url.searchParams.set("period", "recent");
    else url.searchParams.delete("period");
    history.replaceState(null, "", url);
    document.title = country ? `${country.name} · Country Profile · Mahmoud Shaar` : "Country Profiles · Mahmoud Shaar";
  }, [country, period]);

  const series = loaded && loaded.id === country?.id ? loaded.series : null;
  const changes = useMemo(() => {
    const map = new Map<string, Change>();
    if (series) for (const m of MEASURES) map.set(m.id, readChange(m, series[m.id] ?? [], period, notes[m.id]?.newest ?? -Infinity));
    return map;
  }, [series, period, notes]);
  const total = tally(SCORED.map((m) => changes.get(m.id)?.verdict ?? "short"));

  return (
    <SiteLayout
      headerStart={<HomeLink />}
      headerEnd={
        <a href="/explore/" className="text-xs tracking-[0.3em] uppercase text-paper/40 hover:text-gold transition-colors duration-300">
          Data Explorer →
        </a>
      }
    >
      <main className="relative z-10 mx-auto max-w-3xl px-4 sm:px-8 pt-14 pb-24">
        <div className="text-center">
          <div className="mb-6">
            <Overline center>Country Profile</Overline>
          </div>
          <h1 className="font-serif text-[clamp(2rem,5vw,3.5rem)] leading-[1.1] mb-3">
            {country ? (
              country.name
            ) : (
              <>
                Better or worse, <span className="italic text-gold">by the record</span>
              </>
            )}
          </h1>
          <p className="text-sm text-paper/40 mb-8 max-w-lg mx-auto leading-relaxed">
            {country
              ? [country.region, country.income].filter(Boolean).join(" · ")
              : `Pick a country to see ${SCORED.length} World Bank measures of how its people live, each compared from its first figure on record to its latest.`}
          </p>

          <div className="relative max-w-md mx-auto mb-8">
            <label htmlFor="country" className="sr-only">
              Country
            </label>
            <select
              id="country"
              value={country?.id ?? ""}
              onChange={(e) => setCode(e.target.value)}
              disabled={!index}
              className="w-full appearance-none border border-paper/20 hover:border-gold/50 transition-colors duration-200 cursor-pointer bg-ink-1 px-4 py-3 pr-12 text-sm text-paper outline-none"
            >
              <option value="">{index ? "Choose a country…" : "Loading countries…"}</option>
              {index?.countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-paper/40">
              <ChevronIcon className="w-4 h-4" />
            </span>
          </div>
        </div>

        {/* Whose figures these are: said before any reading is shown. */}
        <aside className="border-l-2 border-gold/50 bg-ink-1 px-4 py-4 mb-10 text-xs text-paper/60 leading-relaxed">
          <p>
            <strong className="text-paper/90 font-normal">Every figure on this page is the World Bank's, shown unchanged.</strong>{" "}
            This site collects no data and makes no estimates of its own. The only thing it adds is a reading of each
            measure as better, worse or little changed, made by a fixed rule from two of the World Bank's figures. The
            rule, the two figures and the source are shown with every measure: tap one to see them.
          </p>
          <p className="mt-2">
            It is a summary of published statistics, not a verdict on a country, and it gives no overall score.{" "}
            <a href="#method" className="text-gold/70 hover:text-gold underline">
              How it works and what it leaves out
            </a>
          </p>
        </aside>

        {error && <div className="border border-red-800/50 bg-red-900/10 px-6 py-4 text-sm text-red-400 mb-8">{error}</div>}

        {country && !series && !error && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
          </div>
        )}

        {country && series && (
          <div className="animate-fade-in">
            <section className="mb-12">
              <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
                <h2 className="font-serif text-xl text-paper">
                  {SCORED.length} measures, {period === "all" ? "first figure to latest" : `the last ${RECENT_YEARS} years`}
                </h2>
                <div className="flex border border-paper/10" role="group" aria-label="Period compared">
                  {(
                    [
                      ["all", "Whole record"],
                      ["recent", `Last ${RECENT_YEARS} years`],
                    ] as const
                  ).map(([key, label], i) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={period === key}
                      onClick={() => setPeriod(key)}
                      className={`text-xs px-3 py-2 tracking-widest uppercase transition-colors duration-150 ${i ? "border-l border-paper/10" : ""} ${
                        period === key ? "bg-gold/10 text-gold" : "text-paper/40 hover:text-paper"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <TallyBar t={total} />
              <p className="mt-5 text-xs text-paper/40 leading-relaxed">
                {period === "all"
                  ? `Each measure is compared from the first year the World Bank has a figure for ${country.name} to the latest. Records start in different years for different measures, so the periods differ; each row shows its own.`
                  : `Each measure is compared over the ${RECENT_YEARS} years up to its latest figure for ${country.name}. A long record can hide a recent turn; this view shows it.`}{" "}
                The count is a count: it does not weigh one measure against another, and it is not a score.
              </p>
            </section>

            {GROUPS.map((g) => {
              const rows = MEASURES.filter((m) => m.group === g.key);
              const t = tally(rows.map((m) => changes.get(m.id)!.verdict));
              return (
                <section key={g.key} className="mb-10">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3">
                    <h2 className="text-xs tracking-[0.3em] uppercase text-gold">{g.name}</h2>
                    <span className="text-xs text-paper/40">
                      {g.key === "context" ? "shown without a reading" : groupSummary(t)}
                    </span>
                  </div>
                  {g.key === "context" && (
                    <p className="text-xs text-paper/40 leading-relaxed mb-3">
                      Measures where a higher or lower figure cannot fairly be called better. They are not counted above.
                    </p>
                  )}
                  <ul className="border border-paper/10 bg-ink-1">
                    {rows.map((m) => (
                      <Row
                        key={`${country.id}:${m.id}`}
                        measure={m}
                        notes={notes[m.id]}
                        points={series[m.id] ?? []}
                        change={changes.get(m.id)!}
                        country={country}
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}

        <Method index={index} />
      </main>
    </SiteLayout>
  );
}

// ─── Method and sources ───────────────────────────────────────────────────────

function Method({ index }: { index: Index | null }) {
  return (
    <section id="method" className="mt-16 border-t border-paper/10 pt-10 text-sm text-paper/60 leading-relaxed scroll-mt-6">
      <h2 className="font-serif text-2xl text-paper mb-6">How this page works</h2>

      <div className="space-y-6">
        <Step n="1" title="The figures are the World Bank's">
          All figures come from two World Bank collections, downloaded whole and copied here without adjustment, gap filling
          or estimation (figures are kept to six significant digits): the{" "}
          {(Object.keys(DATASET_NAMES) as DatasetKey[]).map((k, i) => (
            <span key={k}>
              {i > 0 && " and the "}
              <a href={DATASET_NAMES[k].url} target="_blank" rel="noreferrer" className="text-gold/70 hover:text-gold underline">
                {DATASET_NAMES[k].name}
              </a>{" "}
              ({DATASET_NAMES[k].license}
              {index?.sources[k] && `, as published ${date(index.sources[k].sourceDate)}`})
            </span>
          ))}
          . The World Bank in turn compiles most of them from UN agencies and national statistics offices; each
          measure's details name its original source. The site refreshes its copy every night.
        </Step>

        <Step n="2" title="The measures were chosen by this site">
          Out of roughly 1,500 series, the page shows {MEASURES.length}. {SCORED.length} are read as better or worse:
          measures where one direction is widely agreed to be better, almost all of them tied to a UN Sustainable
          Development Goal target or defined that way by the World Bank itself. The choice is a judgement, and a
          different list would give different counts. The full list:
          <ul className="mt-3 space-y-1 text-xs">
            {GROUPS.map((g) => (
              <li key={g.key}>
                <span className="text-paper/40">{g.name}:</span>{" "}
                {MEASURES.filter((m) => m.group === g.key)
                  .map((m) => `${m.label} (${m.reading === "context" ? "not read" : m.reading === "higher" ? "higher is better" : "lower is better"})`)
                  .join("; ")}
                .
              </li>
            ))}
          </ul>
        </Step>

        <Step n="3" title="The reading compares two figures">
          For each measure, the country's latest figure is compared with its first: the first on record, or the first
          within the last {RECENT_YEARS} years if you choose that view. If the difference is on the better side it is
          read as better, on the other side as worse, and inside a small margin as little change (under 1 percentage
          point for shares of a population, under 1 year for life expectancy, under 3 points for governance scores, and
          under 5% of the first figure for everything else). Nothing else enters the reading: no trend line, no
          comparison with other countries, no weighting.
        </Step>

        <Step n="4" title="When there is no reading">
          A measure is left unread when the first and latest figures are less than {MIN_SPAN} years apart, or when the
          latest figure is more than {STALE_AFTER} years older than the newest year the World Bank has for that measure
          anywhere. Missing data is common where it matters most, in countries at war or in crisis, so "no reading" is
          counted and shown rather than hidden.
        </Step>

        <Step n="5" title="What this cannot tell you">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              Whether a country is "doing well". The counts are not weighted: a gain in internet use and a fall in life
              expectancy each count as one.
            </li>
            <li>
              What happened in between. A country can be better than in 1960 and far below its own peak. Use the last{" "}
              {RECENT_YEARS} years view and open each chart.
            </li>
            <li>
              How it compares with others. Most of the world improved on most of these measures, so "better" does not
              mean "keeping up". The Explorer shows countries side by side.
            </li>
            <li>
              Anything about differences inside a country. National averages hide regions, minorities, and the gap
              between rich and poor.
            </li>
            <li>
              More than the data can. Many figures are modelled estimates or come from infrequent surveys, and
              governance scores measure perceptions. The World Bank's own notes on limitations are under each measure.
            </li>
          </ul>
        </Step>
      </div>
    </section>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="font-serif text-xl text-gold/60 w-5 shrink-0">{n}</span>
      <div className="min-w-0">
        <h3 className="text-paper/90 mb-1">{title}</h3>
        <div>{children}</div>
      </div>
    </div>
  );
}
