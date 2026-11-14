/**
 * Shows and edits the puzzle schedule (content/shakkil/schedule.yaml).
 *
 *   npm run schedule                         list every day: date, ID, author, sentence
 *   npm run schedule -- next 0042 0057       run these puzzles next (right after today), in this order
 *   npm run schedule -- author "Name"        run every upcoming puzzle by this author next
 *   npm run schedule -- move 0042 15         put puzzle 0042 on day 15
 *   npm run schedule -- mix                  spread harder puzzles (level 2–3) evenly through the
 *                                            upcoming days, keeping each level's own order
 *
 * Days already played (today included, once launched) are locked and never move. Editing
 * schedule.yaml by hand works too: it is just the list of IDs in run order.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { LAUNCH_DATE, LAUNCH_DAY, dayIndex, puzzleNumber } from "../../src/pages/shakkil/core/daily";
import { SCHEDULE_FILE, loadAll, normalizeId } from "./content";

/** Number of days that are locked: every day up to and including today, once the game launched. */
export function lockedDays(now = Date.now()): number {
  return dayIndex(now) < LAUNCH_DAY ? 0 : puzzleNumber(now);
}

export function dateOfDay(day: number): string {
  const d = new Date(`${LAUNCH_DATE}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + day - 1);
  return d.toISOString().slice(0, 10);
}

/** Moves `ids` (in the given order) to start at day `at` (1-based), keeping locked days fixed. */
export function moveTo(order: string[], ids: string[], at: number, locked: number): string[] {
  const missing = ids.filter((id) => !order.includes(id));
  if (missing.length) throw new Error(`unknown puzzle(s): ${missing.join(", ")}`);
  const frozen = ids.filter((id) => order.indexOf(id) < locked);
  if (frozen.length) throw new Error(`already played, locked: ${frozen.join(", ")}`);
  if (at <= locked) throw new Error(`day ${at} is locked (days 1–${locked} have been played)`);
  const rest = order.filter((id) => !ids.includes(id));
  const k = Math.min(at - 1, rest.length);
  return [...rest.slice(0, k), ...ids, ...rest.slice(k)];
}

/** Round-robin across groups (keeping each group's order), so no single group runs in a block. */
export function roundRobin<T>(items: T[], groupOf: (item: T) => string): T[] {
  const groups = new Map<string, T[]>();
  for (const it of items) groups.set(groupOf(it), [...(groups.get(groupOf(it)) ?? []), it]);
  // Spread each group evenly over the whole list, the same way levels are spread.
  return [...groups.values()]
    .flatMap((list, g) => list.map((it, i) => ({ it, pos: (i + 0.5) / list.length, g })))
    .sort((a, b) => a.pos - b.pos || a.g - b.g)
    .map((x) => x.it);
}

/**
 * Interleaves puzzles by difficulty: each level's puzzles are placed at evenly spaced positions, so
 * hard days are spread out instead of clumped together. Within a level, puzzles are first spread by
 * `group` (e.g. author or source) so one poet or the Quran excerpts don't run back to back.
 */
export function mixByLevel<T extends { level?: number; group?: string }>(items: T[]): T[] {
  const byLevel = new Map<number, T[]>();
  for (const it of items) {
    const l = it.level ?? 1;
    byLevel.set(l, [...(byLevel.get(l) ?? []), it]);
  }
  for (const [l, list] of byLevel) byLevel.set(l, roundRobin(list, (it) => it.group ?? ""));
  return [...byLevel.entries()]
    .flatMap(([level, list]) => list.map((it, i) => ({ it, pos: (i + 0.5) / list.length, level })))
    .sort((a, b) => a.pos - b.pos || a.level - b.level)
    .map((x) => x.it);
}

function writeSchedule(order: string[]) {
  const text = readFileSync(SCHEDULE_FILE, "utf8");
  const header = text.split("\n").filter((l) => l.startsWith("#")).join("\n");
  writeFileSync(SCHEDULE_FILE, `${header}\n${order.map((id) => `- "${id}"`).join("\n")}\n`, "utf8");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, ...args] = process.argv.slice(2);
  const { results, setErrors } = loadAll();
  const order = results.map((r) => r.id);
  const locked = lockedDays();
  const today = locked; // 0 before launch

  try {
    let next: string[] | null = null;
    if (cmd === "next") next = moveTo(order, args.map(normalizeId), locked + 1, locked);
    else if (cmd === "author") {
      const name = args.join(" ").trim();
      const ids = results.filter((r, k) => k >= locked && r.source?.author?.trim() === name).map((r) => r.id);
      if (!ids.length) throw new Error(`no upcoming puzzles by "${name}"`);
      next = moveTo(order, ids, locked + 1, locked);
    } else if (cmd === "move") next = moveTo(order, [normalizeId(args[0])], Number(args[1]), locked);
    else if (cmd === "mix") {
      // Tomorrow's puzzle is already on the site (the rollover buffer), so it stays put too.
      const fixed = locked + 1;
      const upcoming = results.slice(fixed).map((r) => ({
        id: r.id,
        level: r.source?.level,
        group: r.source?.source === "quran" ? "quran" : (r.source?.author ?? r.source?.source ?? ""),
      }));
      next = [...order.slice(0, fixed), ...mixByLevel(upcoming).map((x) => x.id)];
    }
    else if (cmd) throw new Error(`unknown command "${cmd}"; use next, author, move or mix`);

    if (next) {
      writeSchedule(next);
      console.log("schedule.yaml updated.");
    }
    const shown = next ?? order;
    const byId = new Map(results.map((r) => [r.id, r]));
    for (const e of setErrors) console.log(`✗ ${e}`);
    shown.forEach((id, k) => {
      const r = byId.get(id)!;
      const day = k + 1;
      const tag = day < today ? "🔒" : day === today ? "▶ " : "  ";
      const lvl = ["", "·", "··", "···"][r.source?.level ?? 1];
      console.log(`${tag} ${String(day).padStart(3)}  ${dateOfDay(day)}  ${id} ${lvl.padEnd(3)} ${(r.source?.author ?? "").padEnd(16)} ${r.source?.text ?? ""}`);
    });
    console.log(locked ? `🔒 days 1–${locked - 1} played, ▶ today` : `pre-launch (${LAUNCH_DATE}): nothing locked yet`);
  } catch (e) {
    console.error(`✗ ${(e as Error).message}`);
    process.exit(1);
  }
}
