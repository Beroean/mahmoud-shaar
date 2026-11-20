/**
 * Builds static data files for the data explorer from the World Bank's bulk downloads, so the site
 * never calls api.worldbank.org at runtime (its uncached data endpoints routinely hang for 60s+).
 * One folder per dataset (DATASETS below); every dataset's zip has the same CSV layout.
 *
 *   npm run wdi                 build every dataset from .cache/<key>/ (downloading missing zips)
 *   npm run wdi -- --fresh      re-download the zips first
 *   npm run wdi -- --only wgi   build one dataset
 *
 * Output (gitignored, generated in CI before `vite build`), in public/data/<key>/:
 *   meta.json         source date, build date, counts
 *   indicators.json   [{ id, name, topic }]                 indicators with at least one value
 *   countries.json    [{ id, name, region, income, agg }]   agg = aggregate (region/income group)
 *   ind/<id>.json     { id, name, unit, def, source, rows: [[code, value, year], …] }
 *                     the most recent value per country/aggregate, sorted descending
 *   ts/<id>.json      { from, to, series: { <code>: [value | null, …] } }
 *                     every year from `from` to `to` (the indicator's span) per country/aggregate,
 *                     for the "over time" chart. ~100 MB in all, ~65 KB per indicator on average
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { pathToFileURL } from "node:url";
import { parse } from "csv-parse";
import yauzl from "yauzl";

const ROOT = resolve(import.meta.dirname, "../..");

export interface Dataset {
  /** Folder name under public/data/ and .cache/. */
  key: string;
  /** File prefix inside the zip: <prefix>CSV.csv, <prefix>Country.csv, <prefix>Series.csv. */
  prefix: string;
  url: string;
  /**
   * Whether rows without a region are aggregates (regions, income groups). WGI has none; its rows
   * without a region are territories such as Anguilla or Réunion.
   */
  hasAggregates: boolean;
  /** Indicators to publish (default: all). */
  keep?: (id: string) => boolean;
}

export const DATASETS: Dataset[] = [
  {
    key: "wdi",
    prefix: "WDI",
    url: "https://databank.worldbank.org/data/download/WDI_CSV.zip",
    hasAggregates: true,
  },
  {
    key: "wgi",
    prefix: "WGI",
    url: "https://databank.worldbank.org/data/download/WGI_CSV.zip",
    hasAggregates: false,
    // Each dimension's estimate (-2.5 to 2.5) and score (0-100). The standard errors, confidence
    // bounds and source counts are for checking a value, not for comparing countries.
    keep: (id) => /\.(EST|SC)$/.test(id),
  },
];

const zipPath = (ds: Dataset) => resolve(ROOT, `.cache/${ds.key}/${ds.prefix}_CSV.zip`);

type Row = Record<string, string>;

/**
 * Downloads a dataset's zip, plus a sidecar with the server's Last-Modified date so meta.json
 * reports the World Bank's data date.
 */
async function download(ds: Dataset): Promise<void> {
  const zip = zipPath(ds);
  mkdirSync(dirname(zip), { recursive: true });
  console.log(`downloading ${ds.url} …`);
  const res = await fetch(ds.url);
  if (!res.ok || !res.body) throw new Error(`download failed: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(zip));
  const modified = res.headers.get("last-modified");
  if (modified) writeFileSync(`${zip}.date`, new Date(modified).toISOString());
}

function openZip(path: string): Promise<yauzl.ZipFile> {
  return new Promise((ok, fail) =>
    yauzl.open(path, { lazyEntries: true, autoClose: false }, (e, z) => (e ? fail(e) : ok(z!))),
  );
}

/** Streams every CSV row of each named zip entry to `onRow`, keyed by entry name. */
async function readEntries(path: string, handlers: Record<string, (row: Row) => void>): Promise<string[]> {
  const zip = await openZip(path);
  const seen: string[] = [];
  await new Promise<void>((done, fail) => {
    zip.on("error", fail);
    zip.on("end", done);
    zip.on("entry", (entry: yauzl.Entry) => {
      seen.push(entry.fileName);
      const handler = handlers[entry.fileName];
      if (!handler) return zip.readEntry();
      zip.openReadStream(entry, (err, stream) => {
        if (err || !stream) return fail(err);
        const parser = parse({ columns: true, bom: true, relax_column_count: true, skip_empty_lines: true });
        parser.on("data", handler);
        parser.on("error", fail);
        parser.on("end", () => zip.readEntry());
        stream.pipe(parser);
      });
    });
    zip.readEntry();
  });
  zip.close();
  return seen;
}

/** 6 significant digits keeps files small without visible loss in a chart or table. */
const round = (v: number) => Number(v.toPrecision(6));

/** One dense array per country over the indicator's whole span, null where a year is missing. */
export function timeSeries(byCountry: Map<string, [number, number][]>) {
  let from = Infinity;
  let to = -Infinity;
  for (const points of byCountry.values()) {
    from = Math.min(from, points[0][0]);
    to = Math.max(to, points[points.length - 1][0]);
  }
  const series: Record<string, (number | null)[]> = {};
  for (const [code, points] of byCountry) {
    const row: (number | null)[] = new Array(to - from + 1).fill(null);
    for (const [year, value] of points) row[year - from] = value;
    series[code] = row;
  }
  return { from, to, series };
}

export async function build(ds: Dataset, { fresh = false } = {}) {
  const zip = zipPath(ds);
  const out = resolve(ROOT, "public/data", ds.key);
  const { prefix } = ds;
  if (fresh || !existsSync(zip)) await download(ds);
  const zipDate = existsSync(`${zip}.date`)
    ? readFileSync(`${zip}.date`, "utf8").trim()
    : statSync(zip).mtime.toISOString();

  const countries: { id: string; name: string; region: string; income: string; agg: boolean }[] = [];
  const series = new Map<string, { topic: string; unit: string; def: string; source: string }>();
  const latest = new Map<string, { name: string; rows: [string, number, number][] }>();
  /** Per indicator: each country's [year, value] pairs, oldest first. */
  const history = new Map<string, Map<string, [number, number][]>>();

  const entries = await readEntries(zip, {
    [`${prefix}Country.csv`]: (r) =>
      countries.push({
        id: r["Country Code"],
        name: r["Short Name"] || r["Table Name"],
        region: r["Region"] ?? "",
        income: r["Income Group"] ?? "",
        agg: ds.hasAggregates && !r["Region"],
      }),
    [`${prefix}Series.csv`]: (r) =>
      series.set(r["Series Code"], {
        topic: r["Topic"] ?? "",
        unit: r["Unit of measure"] ?? "",
        def: r["Short definition"] || r["Long definition"] || "",
        source: r["Source"] ?? "",
      }),
    [`${prefix}CSV.csv`]: (r) => {
      const id = r["Indicator Code"];
      if (ds.keep && !ds.keep(id)) return;
      // Year columns are "1960", "1961", …; keep every non-empty one (the latest also goes to ind/).
      const points: [number, number][] = [];
      for (const k in r) {
        if (!/^\d{4}$/.test(k) || r[k] === "") continue;
        const v = Number(r[k]);
        if (Number.isFinite(v)) points.push([Number(k), round(v)]);
      }
      if (!points.length) return;
      points.sort((a, b) => a[0] - b[0]);
      const [year, value] = points[points.length - 1];
      let ind = latest.get(id);
      if (!ind) latest.set(id, (ind = { name: r["Indicator Name"], rows: [] }));
      ind.rows.push([r["Country Code"], value, year]);
      let h = history.get(id);
      if (!h) history.set(id, (h = new Map()));
      h.set(r["Country Code"], points);
    },
  });
  for (const need of [`${prefix}CSV.csv`, `${prefix}Country.csv`, `${prefix}Series.csv`]) {
    if (!entries.includes(need)) throw new Error(`${need} not found in zip (entries: ${entries.join(", ")})`);
  }

  rmSync(out, { recursive: true, force: true });
  mkdirSync(resolve(out, "ind"), { recursive: true });
  mkdirSync(resolve(out, "ts"), { recursive: true });

  const indicators = [...latest.entries()]
    .map(([id, ind]) => ({ id, name: ind.name, topic: series.get(id)?.topic ?? "" }))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const [id, ind] of latest) {
    const s = series.get(id);
    ind.rows.sort((a, b) => b[1] - a[1]);
    const doc = { id, name: ind.name, unit: s?.unit ?? "", def: s?.def ?? "", source: s?.source ?? "", rows: ind.rows };
    writeFileSync(resolve(out, "ind", `${id}.json`), JSON.stringify(doc));
    writeFileSync(resolve(out, "ts", `${id}.json`), JSON.stringify(timeSeries(history.get(id)!)));
  }
  writeFileSync(resolve(out, "indicators.json"), JSON.stringify(indicators));
  writeFileSync(resolve(out, "countries.json"), JSON.stringify(countries));
  const meta = {
    source: ds.url,
    sourceDate: zipDate,
    builtAt: new Date().toISOString(),
    indicators: indicators.length,
    countries: countries.filter((c) => !c.agg).length,
    aggregates: countries.filter((c) => c.agg).length,
  };
  writeFileSync(resolve(out, "meta.json"), JSON.stringify(meta, null, 2));
  console.log(`wrote public/data/${ds.key}: ${meta.indicators} indicators, ${meta.countries} countries, ${meta.aggregates} aggregates`);
  return meta;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv;
  const fresh = args.includes("--fresh");
  const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
  const chosen = only ? DATASETS.filter((d) => d.key === only) : DATASETS;
  (async () => {
    if (!chosen.length) throw new Error(`unknown dataset ${only}; known: ${DATASETS.map((d) => d.key).join(", ")}`);
    for (const ds of chosen) await build(ds, { fresh });
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
