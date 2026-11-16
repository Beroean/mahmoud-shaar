/**
 * Shows and edits the puzzle schedule (content/shakkil/schedule.yaml).
 *
 *   npm run schedule                         list every day: date, ID, author, sentence
 *   npm run schedule -- next 0042 0057       run these puzzles next (right after today), in this order
 *   npm run schedule -- author "Name"        run every upcoming puzzle by this author next
 *   npm run schedule -- move 0042 15         put puzzle 0042 on day 15
 *   npm run schedule -- mix                  spread harder puzzles (level 2–3) evenly through the
 *                                            upcoming days (single-sentence schedules only)
 *   npm run schedule -- plan [--days N] [--first 0042,0057] [--author "Name"]
 *                                            three-sentence days (easy, medium, hard) after tomorrow,
 *                                            from every unplayed puzzle; leftovers stay in the pool
 *
 * Days already played (today included, once launched) and tomorrow are locked and never move.
 * schedule.yaml has one entry per day: "0042" (a single-sentence day) or ["0011", "0042", "0103"]
 * (easy, medium, hard). next/author/move/mix work on single-sentence days; plan builds triples.
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

/**
 * Builds three-sentence days (easy, medium, hard) from candidate puzzles. Each level is spread by
 * group (author/source) first; `first` IDs jump to the front of their level. Returns the new days and
 * the puzzles left over (they stay in the unscheduled pool).
 */
export function planTriples<T extends { id: string; level?: number; group?: string }>(
  candidates: T[],
  opts: { days?: number; first?: string[] } = {},
): { days: string[][]; leftover: string[] } {
  const first = opts.first ?? [];
  const byLevel = (l: number) => {
    const list = roundRobin(
      candidates.filter((c) => (c.level ?? 1) === l),
      (c) => c.group ?? "",
    );
    const pinned = first.map((id) => list.find((c) => c.id === id)).filter((c): c is T => !!c);
    return [...pinned, ...list.filter((c) => !first.includes(c.id))];
  };
  const [easy, medium, hard] = [byLevel(1), byLevel(2), byLevel(3)];
  const n = Math.min(easy.length, medium.length, hard.length, opts.days ?? Infinity);
  const days = Array.from({ length: n }, (_, i) => [easy[i].id, medium[i].id, hard[i].id]);
  const used = new Set(days.flat());
  return { days, leftover: candidates.filter((c) => !used.has(c.id)).map((c) => c.id) };
}

function writeSchedule(days: string[][]) {
  const text = readFileSync(SCHEDULE_FILE, "utf8").replace(/\r\n/g, "\n");
  const header = text.split("\n").filter((l) => l.startsWith("#")).join("\n");
  const line = (d: string[]) => (d.length === 1 ? `- "${d[0]}"` : `- [${d.map((id) => `"${id}"`).join(", ")}]`);
  writeFileSync(SCHEDULE_FILE, `${header}\n${days.map(line).join("\n")}\n`, "utf8");
}

const groupOf = (r: { source?: { source?: string; author?: string } }) =>
  r.source?.source === "quran" ? "quran" : (r.source?.author ?? r.source?.source ?? "");

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, ...args] = process.argv.slice(2);
  const { results, days, pool, setErrors } = loadAll();
  const byId = new Map([...results, ...pool].map((r) => [r.id, r]));
  const locked = lockedDays();
  const today = locked; // 0 before launch
  // Played days and tomorrow (already on the site as the rollover buffer) never change.
  const fixed = locked + 1;
  const flag = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };

  try {
    let next: string[][] | null = null;
    const singlesOnly = () => {
      if (days.slice(fixed).some((d) => d.length > 1)) {
        throw new Error(
          "the schedule has three-sentence days; use: npm run schedule -- plan [--first IDs] [--author NAME]",
        );
      }
      return days.map((d) => d[0]);
    };
    const asDays = (order: string[]) => order.map((id) => [id]);

    if (cmd === "next") next = asDays(moveTo(singlesOnly(), args.map(normalizeId), locked + 1, locked));
    else if (cmd === "author") {
      const name = args.join(" ").trim();
      const order = singlesOnly();
      const ids = order.filter((id, k) => k >= locked && byId.get(id)?.source?.author?.trim() === name);
      if (!ids.length) throw new Error(`no upcoming puzzles by "${name}"`);
      next = asDays(moveTo(order, ids, locked + 1, locked));
    } else if (cmd === "move") {
      next = asDays(moveTo(singlesOnly(), [normalizeId(args[0])], Number(args[1]), locked));
    } else if (cmd === "mix") {
      const order = singlesOnly();
      const upcoming = order
        .slice(fixed)
        .map((id) => ({ id, level: byId.get(id)?.source?.level, group: groupOf(byId.get(id)!) }));
      next = asDays([...order.slice(0, fixed), ...mixByLevel(upcoming).map((x) => x.id)]);
    } else if (cmd === "plan") {
      // Every puzzle not on a fixed day is a candidate: future single days, future triples, the pool.
      const keep = days.slice(0, fixed);
      const kept = new Set(keep.flat());
      const candidates = [...byId.values()]
        .filter((r) => !kept.has(r.id))
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((r) => ({ id: r.id, level: r.source?.level, group: groupOf(r) }));
      const author = flag("--author");
      const first = [
        ...(flag("--first")?.split(",").map(normalizeId) ?? []),
        ...(author
          ? candidates.filter((c) => byId.get(c.id)?.source?.author?.trim() === author).map((c) => c.id)
          : []),
      ];
      const n = flag("--days") ? Number(flag("--days")) : undefined;
      const plan = planTriples(candidates, { days: n, first });
      next = [...keep, ...plan.days];
      console.log(
        `${plan.days.length} three-sentence days from day ${fixed + 1}; ${plan.leftover.length} puzzles left in the pool.`,
      );
    } else if (cmd) throw new Error(`unknown command "${cmd}"; use next, author, move, mix or plan`);

    if (next) {
      writeSchedule(next);
      console.log("schedule.yaml updated.");
    }
    for (const e of setErrors) console.log(`✗ ${e}`);
    (next ?? days).forEach((day, k) => {
      const n = k + 1;
      const tag = n < today ? "🔒" : n === today ? "▶ " : "  ";
      day.forEach((id, slot) => {
        const r = byId.get(id);
        const lvl = ["", "·", "··", "···"][r?.source?.level ?? 1];
        const head = slot === 0 ? `${tag} ${String(n).padStart(3)}  ${dateOfDay(n)}` : " ".repeat(20);
        console.log(`${head}  ${id} ${lvl.padEnd(3)} ${(r?.source?.author ?? "").padEnd(16)} ${r?.source?.text ?? ""}`);
      });
    });
    if (!next && pool.length) console.log(`(${pool.length} puzzles in the unscheduled pool)`);
    console.log(locked ? `🔒 days 1–${locked - 1} played, ▶ today` : `pre-launch (${LAUNCH_DATE}): nothing locked yet`);
  } catch (e) {
    console.error(`✗ ${(e as Error).message}`);
    process.exit(1);
  }
}
