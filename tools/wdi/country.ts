/**
 * Builds the country profile's data (src/pages/country) from the explorer's files, which must be
 * built first (build.ts runs this after them). It only copies: each country's figures for the
 * profile's measures (src/pages/country/basket.ts), exactly as the World Bank published them, and
 * the World Bank's own description of each measure. Nothing is computed here; the page reads the
 * figures as better or worse itself (src/pages/country/verdict.ts).
 *
 * Output (gitignored), in public/data/country/:
 *   index.json        { countries: [{ id, name, region, income }], sources: { wdi, wgi: { sourceDate } } }
 *   measures.json     { <series id>: { name, unit, def, source, about, newest } }   the World Bank's
 *                     name and notes; `newest` = the latest year any country has a figure for
 *   c/<ISO3>.json     { <series id>: [[year, value], …] }   missing years left out; ~10 KB
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { MEASURES } from "../../src/pages/country/basket";
import type { Point } from "../../src/pages/country/verdict";

const ROOT = resolve(import.meta.dirname, "../..");

/** A dense yearly row (ts/<id>.json) as [year, value] pairs, without the missing years. */
export function toPoints(from: number, row: (number | null)[] | undefined): Point[] {
  const points: Point[] = [];
  row?.forEach((v, i) => {
    if (v !== null) points.push([from + i, v]);
  });
  return points;
}

export function buildCountries(data = resolve(ROOT, "public/data")) {
  const read = <T>(path: string) => JSON.parse(readFileSync(resolve(data, path), "utf8")) as T;
  const out = resolve(data, "country");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(resolve(out, "c"), { recursive: true });

  // The WDI's list of countries (no regional or income aggregates) is the profile's list.
  const countries = read<{ id: string; name: string; region: string; income: string; agg: boolean }[]>(
    "wdi/countries.json",
  )
    .filter((c) => !c.agg)
    .map(({ id, name, region, income }) => ({ id, name, region, income }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const series = new Map(countries.map((c) => [c.id, {} as Record<string, Point[]>]));
  const measures: Record<string, unknown> = {};
  for (const m of MEASURES) {
    const ind = `${m.dataset}/ind/${m.id}.json`;
    // A series the World Bank has renamed or dropped must fail the build, not vanish from the page.
    if (!existsSync(resolve(data, ind))) throw new Error(`country profile: ${m.id} is not in the ${m.dataset} data`);
    const doc = read<{ name: string; unit: string; def: string; source: string; about: [string, string][] }>(ind);
    const ts = read<{ from: number; to: number; series: Record<string, (number | null)[]> }>(
      `${m.dataset}/ts/${m.id}.json`,
    );
    let newest = -Infinity;
    for (const c of countries) {
      const points = toPoints(ts.from, ts.series[c.id]);
      series.get(c.id)![m.id] = points;
      if (points.length) newest = Math.max(newest, points[points.length - 1][0]);
    }
    measures[m.id] = { name: doc.name, unit: doc.unit, def: doc.def, source: doc.source, about: doc.about, newest };
  }

  for (const [id, s] of series) writeFileSync(resolve(out, "c", `${id}.json`), JSON.stringify(s));
  const sources = Object.fromEntries(
    [...new Set(MEASURES.map((m) => m.dataset))].map((ds) => [
      ds,
      { sourceDate: read<{ sourceDate: string }>(`${ds}/meta.json`).sourceDate },
    ]),
  );
  writeFileSync(resolve(out, "index.json"), JSON.stringify({ countries, sources }));
  writeFileSync(resolve(out, "measures.json"), JSON.stringify(measures));
  console.log(`wrote public/data/country: ${countries.length} countries, ${MEASURES.length} measures`);
}
