import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
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

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// ─── Types ────────────────────────────────────────────────────────────────────

interface Indicator {
  id: string;
  name: string;
}

// Shape returned by api.worldbank.org/v2
interface WBDataPoint {
  countryiso3code: string;
  country: { id: string; value: string };
  date: string;
  value: number | null;
  indicator: { id: string; value: string };
}

type ViewMode = "bar" | "table";

// ─── Constants ────────────────────────────────────────────────────────────────

// api.worldbank.org/v2 has CORS headers enabled natively — no proxy needed
const WB_API = "https://api.worldbank.org/v2";

// ─── API helpers ──────────────────────────────────────────────────────────────

// source=2 is the WDI dataset. Paginates through all pages.
async function fetchIndicators(): Promise<Indicator[]> {
  const all: Indicator[] = [];
  let page = 1;
  let totalPages = Infinity;
  while (page <= totalPages) {
    const res = await fetch(
      `${WB_API}/indicator?source=2&format=json&per_page=1000&page=${page}`
    );
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    const meta = json[0];
    const data: Array<{ id: string; name: string }> = json[1] ?? [];
    totalPages = meta.pages;
    all.push(...data.map((i) => ({ id: i.id, name: i.name })));
    page++;
  }
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

// mrv=1 returns the single most-recent value per country.
// Filters to real ISO3 country codes to drop aggregates/regions.
async function fetchIndicatorData(indicatorId: string): Promise<WBDataPoint[]> {
  const all: WBDataPoint[] = [];
  let page = 1;
  let totalPages = Infinity;
  while (page <= totalPages) {
    const res = await fetch(
      `${WB_API}/country/all/indicator/${indicatorId}?format=json&mrv=1&per_page=1000&page=${page}`
    );
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    const meta = json[0];
    const data: WBDataPoint[] = json[1] ?? [];
    totalPages = meta?.pages ?? 1;
    all.push(...data);
    page++;
    if (data.length < 1000) break;
  }
  return all
    .filter((d) => d.value !== null && /^[A-Z]{3}$/.test(d.countryiso3code))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex flex-col items-center gap-4 py-24">
      <div className="w-8 h-8 border-2 border-[#c9a96e]/30 border-t-[#c9a96e] rounded-full animate-spin" />
      <span className="text-xs tracking-widest uppercase text-[#e8e4dc]/30">
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
  const [selectedIndicator, setSelectedIndicator] = useState<Indicator | null>(null);
  const [rawData, setRawData] = useState<WBDataPoint[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("bar");
  const [topN, setTopN] = useState(30);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load indicator list on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchIndicators();
        if (!cancelled) setIndicators(data);
      } catch (e) {
        if (!cancelled) setError("Failed to load indicators. " + (e as Error).message);
      } finally {
        if (!cancelled) setLoadingIndicators(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Close dropdown on outside click — use pointerdown so it doesn't race with
  // the item's onClick (which fires on pointerup/click, after this handler)
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
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
        if (!cancelled) setError("Failed to fetch data. " + (e as Error).message);
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedIndicator]);

  const filtered = useMemo(
    () =>
      indicators.filter(
        (i) =>
          i.name.toLowerCase().includes(search.toLowerCase()) ||
          i.id.toLowerCase().includes(search.toLowerCase())
      ),
    [indicators, search]
  );

  const chartData = useMemo(() => rawData.slice(0, topN), [rawData, topN]);
  const indicatorLabel = rawData[0]?.indicator?.value || selectedIndicator?.name || "";
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
    [chartData, indicatorLabel]
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
    []
  );

  const chartHeight = Math.max(400, chartData.length * 28);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e8e4dc] font-['IBM_Plex_Mono',monospace] overflow-x-hidden">

      {/* Grid background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(#e8e4dc 1px, transparent 1px), linear-gradient(90deg, #e8e4dc 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
        }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6 border-b border-[#e8e4dc]/10">
        <Link
          to="/"
          className="text-xs tracking-[0.3em] uppercase text-[#e8e4dc]/40 hover:text-[#c9a96e] transition-colors duration-300"
        >
          ← Home
        </Link>
        <span className="text-xs tracking-[0.3em] uppercase text-[#e8e4dc]/20">
          World Bank · WDI Explorer
        </span>
      </header>

      <main className="relative z-10 px-8 pt-16 pb-24">

        {/* Page title */}
        <div className="flex items-center gap-4 mb-6">
          <div className="h-px w-12 bg-[#c9a96e]" />
          <span className="text-xs tracking-[0.4em] uppercase text-[#c9a96e]">
            Data Explorer
          </span>
        </div>
        <h1 className="font-['DM_Serif_Display',serif] text-[clamp(2rem,5vw,4rem)] leading-[1.1] text-[#e8e4dc] mb-3">
          World Development
          <br />
          <span className="italic text-[#c9a96e]">Indicators</span>
        </h1>
        <p className="text-sm text-[#e8e4dc]/40 mb-12 max-w-lg leading-relaxed">
          Select any indicator from the World Bank WDI dataset to visualize a
          cross-country comparison using the most recent available data.
        </p>

        {/* ── Indicator Selector ─────────────────────────────────────────── */}
        <div className="mb-10 max-w-2xl" ref={dropdownRef}>
          <label className="block text-xs tracking-widest uppercase text-[#e8e4dc]/40 mb-3">
            Select Indicator
          </label>

          {loadingIndicators ? (
            <div className="flex items-center gap-3 border border-[#e8e4dc]/10 px-4 py-3 bg-[#0d0d0d]">
              <div className="w-4 h-4 border border-[#c9a96e]/40 border-t-[#c9a96e] rounded-full animate-spin" />
              <span className="text-xs text-[#e8e4dc]/30 tracking-widest">
                Loading{indicators.length > 0 ? ` ${indicators.length.toLocaleString()}` : ""} indicators…
              </span>
            </div>
          ) : (
            <div className="relative">
              <div
                className="flex items-center border border-[#e8e4dc]/20 hover:border-[#c9a96e]/50 transition-colors duration-200 cursor-pointer bg-[#0d0d0d]"
                onClick={() => setDropdownOpen((o) => !o)}
              >
                <input
                  type="text"
                  className="flex-1 bg-transparent px-4 py-3 text-sm text-[#e8e4dc] placeholder-[#e8e4dc]/20 outline-none"
                  placeholder={selectedIndicator ? selectedIndicator.name : "Search indicators…"}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setDropdownOpen(true); }}
                  onFocus={() => setDropdownOpen(true)}
                />
                <span className="px-4 text-[#e8e4dc]/20 text-xs select-none">
                  {dropdownOpen ? "▲" : "▼"}
                </span>
              </div>

              {dropdownOpen && (
                <div className="absolute z-50 w-full border border-[#e8e4dc]/10 border-t-0 bg-[#0d0d0d] max-h-72 overflow-y-auto shadow-2xl">
                  {filtered.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-[#e8e4dc]/30">
                      No results for "{search}"
                    </div>
                  ) : (
                    filtered.slice(0, 200).map((ind) => (
                      <div
                        key={ind.id}
                        className={`px-4 py-3 text-xs cursor-pointer border-b border-[#e8e4dc]/5 transition-colors duration-150 ${
                          selectedIndicator?.id === ind.id
                            ? "bg-[#c9a96e]/10 text-[#c9a96e]"
                            : "text-[#e8e4dc]/70 hover:bg-[#e8e4dc]/5 hover:text-[#e8e4dc]"
                        }`}
                        onClick={() => {
                          setSelectedIndicator(ind);
                          setSearch("");
                          setDropdownOpen(false);
                          setTopN(30);
                        }}
                      >
                        <span className="text-[#c9a96e]/50 mr-3">{ind.id}</span>
                        <span className="text-[#e8e4dc]/60">{ind.name}</span>
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
                <h2 className="font-['DM_Serif_Display',serif] text-xl text-[#e8e4dc] mb-1">
                  {indicatorLabel}
                </h2>
                <p className="text-xs text-[#e8e4dc]/30 tracking-wider">
                  {rawData.length} countries · Most recent value (
                  <span className="text-[#c9a96e]">{latestYear}</span>) ·{" "}
                  {selectedIndicator?.id}
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 border border-[#e8e4dc]/10 px-3 py-2">
                  <span className="text-xs text-[#e8e4dc]/30 tracking-widest uppercase">Top</span>
                  {[20, 30, 50, 100].map((n) => (
                    <button
                      key={n}
                      onClick={() => setTopN(n)}
                      className={`text-xs px-2 py-1 transition-colors duration-150 ${
                        topN === n ? "bg-[#c9a96e] text-[#0a0a0a]" : "text-[#e8e4dc]/40 hover:text-[#e8e4dc]"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                <div className="flex border border-[#e8e4dc]/10">
                  <button
                    onClick={() => setViewMode("bar")}
                    className={`text-xs px-4 py-2 tracking-widest uppercase transition-colors duration-150 ${
                      viewMode === "bar" ? "bg-[#c9a96e]/10 text-[#c9a96e]" : "text-[#e8e4dc]/30 hover:text-[#e8e4dc]"
                    }`}
                  >
                    Chart
                  </button>
                  <button
                    onClick={() => setViewMode("table")}
                    className={`text-xs px-4 py-2 tracking-widest uppercase transition-colors duration-150 border-l border-[#e8e4dc]/10 ${
                      viewMode === "table" ? "bg-[#c9a96e]/10 text-[#c9a96e]" : "text-[#e8e4dc]/30 hover:text-[#e8e4dc]"
                    }`}
                  >
                    Table
                  </button>
                </div>
              </div>
            </div>

            {viewMode === "bar" && (
              <div
                className="border border-[#e8e4dc]/10 bg-[#0d0d0d] p-6"
                style={{ height: `${chartHeight}px` }}
              >
                <Bar data={chartJsData} options={chartOptions} />
              </div>
            )}

            {viewMode === "table" && (
              <div className="border border-[#e8e4dc]/10 overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#e8e4dc]/10 bg-[#0d0d0d]">
                      <th className="text-left px-5 py-3 text-[#e8e4dc]/30 tracking-widest uppercase font-normal w-8">#</th>
                      <th className="text-left px-5 py-3 text-[#e8e4dc]/30 tracking-widest uppercase font-normal">Country</th>
                      <th className="text-left px-5 py-3 text-[#e8e4dc]/30 tracking-widest uppercase font-normal">ISO3</th>
                      <th className="text-right px-5 py-3 text-[#e8e4dc]/30 tracking-widest uppercase font-normal">Value</th>
                      <th className="text-right px-5 py-3 text-[#e8e4dc]/30 tracking-widest uppercase font-normal">Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map((d, i) => (
                      <tr
                        key={d.countryiso3code}
                        className="border-b border-[#e8e4dc]/5 hover:bg-[#e8e4dc]/[0.02] transition-colors"
                      >
                        <td className="px-5 py-3 text-[#e8e4dc]/20">{i + 1}</td>
                        <td className="px-5 py-3 text-[#e8e4dc]/80">{d.country.value}</td>
                        <td className="px-5 py-3 text-[#c9a96e]">{d.countryiso3code}</td>
                        <td className="px-5 py-3 text-right text-[#e8e4dc]/80 tabular-nums">
                          {(d.value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 })}
                        </td>
                        <td className="px-5 py-3 text-right text-[#e8e4dc]/30">{d.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-xs text-[#e8e4dc]/20 mt-4">
              Source: World Bank World Development Indicators · api.worldbank.org/v2 · CC BY 4.0
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loadingData && !loadingIndicators && !selectedIndicator && !error && (
          <div className="border border-[#e8e4dc]/5 bg-[#0d0d0d] px-10 py-16 text-center max-w-lg">
            <div className="font-['DM_Serif_Display',serif] text-2xl text-[#e8e4dc]/20 mb-3 italic">
              Pick an indicator above
            </div>
            <p className="text-xs text-[#e8e4dc]/20 leading-relaxed">
              Choose from {indicators.length.toLocaleString()} indicators in the
              World Bank World Development Indicators dataset.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
