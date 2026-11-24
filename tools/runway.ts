/**
 * How many new days each daily game has left before it wraps around and starts repeating
 * (src/lib/wrapDays.ts). Never fails: running out no longer breaks the site, it only means repeats.
 *
 *   npm run runway          # one line per game
 *   npm run runway -- --ci  # also a GitHub Actions warning for a game with under WARN_DAYS left
 */
import { pathToFileURL } from "node:url";
import { LAUNCH_DATE as ARABIYYAT_LAUNCH, todayNumber as arabiyyatToday } from "../src/pages/arabiyyat/core/daily";
import { LAUNCH_DATE as HALAB_LAUNCH, todayNumber as halabToday } from "../src/pages/halab/core/daily";
import { LAUNCH_DATE as SHAKKIL_LAUNCH, puzzleNumber } from "../src/pages/shakkil/core/daily";
import { loadDays as loadArabiyyat } from "./arabiyyat/content";
import { loadDays as loadHalab } from "./halab/content";
import { loadAll } from "./shakkil/content";

/** Warn this many days before a game starts repeating. */
export const WARN_DAYS = 60;

export interface Runway {
  game: string;
  /** Days in the content. */
  days: number;
  /** New days left after today (negative once it has wrapped). */
  left: number;
  /** Date of the last new day, or null before launch. */
  lastDate: string | null;
  /** What to do to add days. */
  hint: string;
}

function dateOf(launch: string | null, day: number): string | null {
  if (!launch) return null;
  const d = new Date(`${launch}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + day - 1);
  return d.toISOString().slice(0, 10);
}

export function runways(now = Date.now()): Runway[] {
  const shakkil = Math.max(0, ...loadAll().results.map((r) => r.number));
  const halab = loadHalab().days.length;
  const arabiyyat = loadArabiyyat().days.length;
  return [
    {
      game: "Shakkil",
      days: shakkil,
      left: shakkil - puzzleNumber(now),
      lastDate: dateOf(SHAKKIL_LAUNCH, shakkil),
      hint: "add puzzles and run npm run schedule -- plan",
    },
    {
      game: "حلبيّات",
      days: halab,
      left: halab - halabToday(now),
      lastDate: dateOf(HALAB_LAUNCH, halab),
      hint: "add items to content/halab",
    },
    {
      game: "عربيّات",
      days: arabiyyat,
      left: arabiyyat - arabiyyatToday(now),
      lastDate: dateOf(ARABIYYAT_LAUNCH, arabiyyat),
      hint: "move items from content/arabiyyat/spares.yaml into the lists",
    },
  ];
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const ci = process.argv.includes("--ci");
  for (const r of runways()) {
    const when = r.lastDate ? `, last new day ${r.lastDate}` : "";
    const state = r.left < 0 ? `repeating (wrapped ${-r.left} day(s) ago)` : `${r.left} new day(s) left`;
    console.log(`${r.game}: ${r.days} days, ${state}${when}`);
    if (ci && r.left < WARN_DAYS) {
      const msg = r.left < 0 ? `${r.game} is repeating old days` : `${r.game} starts repeating in ${r.left} day(s)`;
      console.log(`::warning title=${r.game} runway::${msg}${when}; ${r.hint}.`);
    }
  }
}
