import { useState, useEffect, useRef, useMemo } from "react";
import { HomeLink, Overline, SiteLayout } from "../../components/SiteLayout";
import { ChevronIcon, GlobeIcon, LayersIcon } from "../../components/icons";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  type ChartOptions,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface Indicator {
  id: string;
  name: string;
}

// One ranked row, in the shape the chart and table use.
interface WBDataPoint {
  countryiso3code: string;
  country: { id: string; value: string };
  date: string;
  value: number | null;
  indicator: { id: string; value: string };
}

type ViewMode = "bar" | "table";

/** public/data/wdi/meta.json */
interface WdiMeta {
  sourceDate: string;
  builtAt: string;
  indicators: number;
}

// ─── Data ─────────────────────────────────────────────────────────────────────
// Static files built from the World Bank's WDI bulk download (tools/wdi/build.ts, refreshed weekly
// in CI). The live API at api.worldbank.org often takes 60s+ or fails for uncached data requests,
// so the page never calls it.

const DATA = "/data/wdi";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${DATA}/${path}`);
  if (!res.ok) throw new Error(`Status ${res.status}`);
  return res.json() as Promise<T>;
}

type CountryRow = { id: string; name: string; agg: boolean };
let countriesPromise: Promise<CountryRow[]> | null = null;
const loadCountries = () => (countriesPromise ??= getJson<CountryRow[]>("countries.json"));

/** ISO3 codes of real countries (aggregates such as "World" or "High income" excluded). */
async function fetchCountryCodes(): Promise<Set<string>> {
  const countries = await loadCountries();
  return new Set(countries.filter((c) => !c.agg).map((c) => c.id));
}

async function fetchIndicators(): Promise<Indicator[]> {
  return getJson<Indicator[]>("indicators.json");
}

const fetchMeta = () => getJson<WdiMeta>("meta.json");

/** Most recent value per country/aggregate, sorted descending. */
async function fetchIndicatorData(indicatorId: string): Promise<WBDataPoint[]> {
  const [doc, countries] = await Promise.all([
    getJson<{ id: string; name: string; rows: [string, number, number][] }>(
      `ind/${encodeURIComponent(indicatorId)}.json`,
    ),
    loadCountries(),
  ]);
  const names = new Map(countries.map((c) => [c.id, c.name]));
  return doc.rows.map(([code, value, year]) => ({
    countryiso3code: code,
    country: { id: code, value: names.get(code) ?? code },
    date: String(year),
    value,
    indicator: { id: doc.id, value: doc.name },
  }));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex flex-col items-center gap-4 py-24">
      <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      <span className="text-xs tracking-widest uppercase text-paper/30">
        Fetching data…
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DataExplorer() {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [loadingIndicators, setLoadingIndicators] = useState(true);
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedIndicator, setSelectedIndicator] = useState<Indicator | null>(
    null,
  );
  const [rawData, setRawData] = useState<WBDataPoint[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("bar");
  const [topN, setTopN] = useState(30);
  const [sortAsc, setSortAsc] = useState(false);
  const [countriesOnly, setCountriesOnly] = useState(true);
  const [countryCodes, setCountryCodes] = useState<Set<string>>(new Set());
  const [meta, setMeta] = useState<WdiMeta | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load indicator list on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchIndicators();
        if (!cancelled) setIndicators(data);
      } catch (e) {
        if (!cancelled)
          setError("Failed to load indicators. " + (e as Error).message);
      } finally {
        if (!cancelled) setLoadingIndicators(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch real country codes and the data date once on mount
  useEffect(() => {
    fetchCountryCodes()
      .then(setCountryCodes)
      .catch(() => {});
    fetchMeta()
      .then(setMeta)
      .catch(() => {});
  }, []);

  // Close dropdown on outside click — use pointerdown so it doesn't race with
  // the item's onClick (which fires on pointerup/click, after this handler)
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, []);

  // Fetch data when indicator changes
  useEffect(() => {
    if (!selectedIndicator) return;
    let cancelled = false;
    async function load() {
      try {
        setRawData([]);
        setError(null);
        setLoadingData(true);
        const data = await fetchIndicatorData(selectedIndicator!.id);
        if (!cancelled) setRawData(data);
      } catch (e) {
        if (!cancelled)
          setError("Failed to fetch data. " + (e as Error).message);
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedIndicator]);

  const filtered = useMemo(
    () =>
      indicators.filter(
        (i) =>
          i.name.toLowerCase().includes(search.toLowerCase()) ||
          i.id.toLowerCase().includes(search.toLowerCase()),
      ),
    [indicators, search],
  );

  const chartData = useMemo(() => {
    const filtered =
      countriesOnly && countryCodes.size > 0
        ? rawData.filter((d) => countryCodes.has(d.countryiso3code))
        : rawData;
    const sorted = sortAsc ? [...filtered].reverse() : filtered;
    return sorted.slice(0, topN);
  }, [rawData, topN, sortAsc, countriesOnly, countryCodes]);
  const indicatorLabel =
    rawData[0]?.indicator?.value || selectedIndicator?.name || "";
  const latestYear = rawData[0]?.date ?? "";

  const chartJsData = useMemo(
    () => ({
      labels: chartData.map((d) => d.country.value),
      datasets: [
        {
          label: indicatorLabel,
          data: chartData.map((d) => d.value ?? 0),
          backgroundColor: chartData.map((_, i) => {
            const opacity = 0.9 - (i / chartData.length) * 0.45;
            return `rgba(201, 169, 110, ${opacity})`;
          }),
          borderColor: "rgba(201, 169, 110, 0.15)",
          borderWidth: 1,
          borderRadius: 2,
        },
      ],
    }),
    [chartData, indicatorLabel],
  );

  const chartOptions: ChartOptions<"bar"> = useMemo(
    () => ({
      indexAxis: "y" as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#111",
          borderColor: "rgba(201,169,110,0.3)",
          borderWidth: 1,
          titleColor: "#c9a96e",
          bodyColor: "#e8e4dc",
          titleFont: { family: "'IBM Plex Mono', monospace", size: 11 },
          bodyFont: { family: "'IBM Plex Mono', monospace", size: 12 },
          padding: 12,
          callbacks: {
            label: (item) => {
              const val = item.raw as number;
              return `  ${val.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(232,228,220,0.06)" },
          ticks: {
            color: "rgba(232,228,220,0.4)",
            font: { family: "'IBM Plex Mono', monospace", size: 10 },
          },
          border: { color: "rgba(232,228,220,0.1)" },
        },
        y: {
          grid: { display: false },
          ticks: {
            color: "rgba(232,228,220,0.7)",
            font: { family: "'IBM Plex Mono', monospace", size: 11 },
          },
          border: { color: "rgba(232,228,220,0.1)" },
        },
      },
    }),
    [],
  );

  const chartHeight = Math.max(400, chartData.length * 28);

  return (
    <SiteLayout
      headerStart={<HomeLink />}
      headerEnd={
        <span className="text-xs tracking-[0.3em] uppercase text-paper/20">
          World Bank · WDI Explorer
        </span>
      }
    >
      <main className="relative z-10 px-6 sm:px-8 pt-16 pb-24">
        {/* Page title */}
        <div className="mb-6">
          <Overline>Data Explorer</Overline>
        </div>
        <h1 className="font-serif text-[clamp(2rem,5vw,4rem)] leading-[1.1] mb-3">
          World Development
          <br />
          <span className="italic text-gold">Indicators</span>
        </h1>
        <p className="text-sm text-paper/40 mb-12 max-w-lg leading-relaxed">
          Select any indicator from the World Bank WDI dataset to visualize a
          cross-country comparison using the most recent available data for
          each country.
        </p>

        {/* ── Indicator Selector ─────────────────────────────────────────── */}
        <div className="mb-10 max-w-2xl" ref={dropdownRef}>
          <label className="block text-xs tracking-widest uppercase text-paper/40 mb-3">
            Select Indicator
          </label>

          {loadingIndicators ? (
            <div className="flex items-center gap-3 border border-paper/10 px-4 py-3 bg-ink-1">
              <div className="w-4 h-4 border border-gold/40 border-t-gold rounded-full animate-spin" />
              <span className="text-xs text-paper/30 tracking-widest">
                Loading
                {indicators.length > 0
                  ? ` ${indicators.length.toLocaleString()}`
                  : ""}{" "}
                indicators…
              </span>
            </div>
          ) : (
            <div className="relative">
              <div
                className="flex items-center border border-paper/20 hover:border-gold/50 transition-colors duration-200 cursor-pointer bg-ink-1"
                onClick={() => setDropdownOpen((o) => !o)}
              >
                <input
                  type="text"
                  className="flex-1 bg-transparent px-4 py-3 text-sm text-paper placeholder-paper/20 outline-none"
                  placeholder={
                    selectedIndicator
                      ? selectedIndicator.name
                      : "Search indicators…"
                  }
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setDropdownOpen(true);
                  }}
                  onFocus={() => setDropdownOpen(true)}
                />
                <span className="px-4 text-paper/40 select-none">
                  <ChevronIcon className={`w-4 h-4 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
                </span>
              </div>

              {dropdownOpen && (
                <div className="absolute z-50 w-full border border-paper/10 border-t-0 bg-ink-1 max-h-72 overflow-y-auto shadow-2xl">
                  {filtered.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-paper/30">
                      No results for "{search}"
                    </div>
                  ) : (
                    filtered.slice(0, 200).map((ind) => (
                      <div
                        key={ind.id}
                        className={`px-4 py-3 text-xs cursor-pointer border-b border-paper/5 transition-colors duration-150 ${
                          selectedIndicator?.id === ind.id
                            ? "bg-gold/10 text-gold"
                            : "text-paper/70 hover:bg-paper/5 hover:text-paper"
                        }`}
                        onClick={() => {
                          setSelectedIndicator(ind);
                          setSearch("");
                          setDropdownOpen(false);
                          setTopN(30);
                        }}
                      >
                        <span className="text-gold/50 mr-3">{ind.id}</span>
                        <span className="text-paper/60">{ind.name}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Error ──────────────────────────────────────────────────────── */}
        {error && (
          <div className="border border-red-800/50 bg-red-900/10 px-6 py-4 text-sm text-red-400 max-w-2xl mb-8">
            {error}
          </div>
        )}

        {/* ── Loading spinner ────────────────────────────────────────────── */}
        {loadingData && <Spinner />}

        {/* ── Chart / Table ──────────────────────────────────────────────── */}
        {!loadingData && chartData.length > 0 && (
          <div className="animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="font-serif text-xl text-paper mb-1">
                  {indicatorLabel}
                </h2>
                <p className="text-xs text-paper/30 tracking-wider">
                  {countriesOnly && countryCodes.size > 0
                    ? rawData.filter((d) => countryCodes.has(d.countryiso3code))
                        .length
                    : rawData.length}{" "}
                  {countriesOnly ? "countries" : "entries"} · Most recent value
                  (<span className="text-gold">{latestYear}</span>) ·{" "}
                  {selectedIndicator?.id}
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 border border-paper/10 px-3 py-2">
                  <span className="text-xs text-paper/30 tracking-widest uppercase">
                    Top
                  </span>
                  {[20, 30, 50, 100].map((n) => (
                    <button
                      key={n}
                      onClick={() => setTopN(n)}
                      className={`text-xs px-2 py-1 transition-colors duration-150 ${
                        topN === n
                          ? "bg-gold text-ink"
                          : "text-paper/40 hover:text-paper"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setSortAsc((a) => !a)}
                  className="flex items-center gap-2 border border-paper/10 px-3 py-2 text-xs text-paper/40 hover:text-paper hover:border-paper/30 transition-colors duration-150 tracking-widest uppercase"
                >
                  {sortAsc ? "↑ Asc" : "↓ Desc"}
                </button>

                <button
                  onClick={() => setCountriesOnly((v) => !v)}
                  className={`flex items-center gap-2 border px-3 py-2 text-xs tracking-widest uppercase transition-colors duration-150 ${
                    countriesOnly
                      ? "border-gold/50 text-gold bg-gold/5"
                      : "border-paper/10 text-paper/40 hover:text-paper hover:border-paper/30"
                  }`}
                >
                  {countriesOnly ? (
                    <>
                      <GlobeIcon className="w-4 h-4" /> Countries
                    </>
                  ) : (
                    <>
                      <LayersIcon className="w-4 h-4" /> All Entries
                    </>
                  )}
                </button>

                <div className="flex border border-paper/10">
                  <button
                    onClick={() => setViewMode("bar")}
                    className={`text-xs px-4 py-2 tracking-widest uppercase transition-colors duration-150 ${
                      viewMode === "bar"
                        ? "bg-gold/10 text-gold"
                        : "text-paper/30 hover:text-paper"
                    }`}
                  >
                    Chart
                  </button>
                  <button
                    onClick={() => setViewMode("table")}
                    className={`text-xs px-4 py-2 tracking-widest uppercase transition-colors duration-150 border-l border-paper/10 ${
                      viewMode === "table"
                        ? "bg-gold/10 text-gold"
                        : "text-paper/30 hover:text-paper"
                    }`}
                  >
                    Table
                  </button>
                </div>
              </div>
            </div>

            {viewMode === "bar" && (
              <div
                className="border border-paper/10 bg-ink-1 p-6"
                style={{ height: `${chartHeight}px` }}
              >
                <Bar data={chartJsData} options={chartOptions} />
              </div>
            )}

            {viewMode === "table" && (
              <div className="border border-paper/10 overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-paper/10 bg-ink-1">
                      <th className="text-left px-5 py-3 text-paper/30 tracking-widest uppercase font-normal w-8">
                        #
                      </th>
                      <th className="text-left px-5 py-3 text-paper/30 tracking-widest uppercase font-normal">
                        Country
                      </th>
                      <th className="text-left px-5 py-3 text-paper/30 tracking-widest uppercase font-normal">
                        ISO3
                      </th>
                      <th className="text-right px-5 py-3 text-paper/30 tracking-widest uppercase font-normal">
                        Value
                      </th>
                      <th className="text-right px-5 py-3 text-paper/30 tracking-widest uppercase font-normal">
                        Year
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map((d, i) => (
                      <tr
                        key={d.countryiso3code}
                        className="border-b border-paper/5 hover:bg-paper/[0.02] transition-colors"
                      >
                        <td className="px-5 py-3 text-paper/20">{i + 1}</td>
                        <td className="px-5 py-3 text-paper/80">
                          {d.country.value}
                        </td>
                        <td className="px-5 py-3 text-gold">
                          {d.countryiso3code}
                        </td>
                        <td className="px-5 py-3 text-right text-paper/80 tabular-nums">
                          {(d.value ?? 0).toLocaleString(undefined, {
                            maximumFractionDigits: 3,
                          })}
                        </td>
                        <td className="px-5 py-3 text-right text-paper/30">
                          {d.date}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-xs text-paper/20 mt-4">
              Source: World Bank, World Development Indicators (CC BY 4.0)
              {meta &&
                ` · data as of ${new Date(meta.sourceDate).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}`}
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loadingData && !loadingIndicators && !selectedIndicator && !error && (
          <div className="border border-paper/5 bg-ink-1 px-10 py-16 text-center max-w-lg">
            <div className="font-serif text-2xl text-paper/20 mb-3 italic">
              Pick an indicator above
            </div>
            <p className="text-xs text-paper/20 leading-relaxed">
              Choose from {indicators.length.toLocaleString()} indicators in the
              World Bank World Development Indicators dataset.
            </p>
          </div>
        )}
      </main>
    </SiteLayout>
  );
}
