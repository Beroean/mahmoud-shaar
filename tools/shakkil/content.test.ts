/**
 * Data test: every committed puzzle must be valid, and the schedule must not be about to run out.
 * This is what blocks a bad contribution from being merged/deployed.
 */
import { describe, expect, it } from "vitest";
import { LAUNCH_DAY, dayIndex, puzzleNumber } from "../../src/pages/shakkil/core/daily";
import { difficulty } from "../../src/pages/shakkil/core/difficulty";
import { loadAll } from "./content";
import { lockedDays } from "./schedule";
import { loadTanzil, quranProblems } from "./tanzil";

/** Fail CI when fewer than this many future days are covered. */
const MIN_RUNWAY_DAYS = 14;

describe("content/shakkil/puzzles", () => {
  const { results, pool, setErrors } = loadAll();

  it("has puzzles", () => {
    expect(results.length).toBeGreaterThan(0);
  });

  it("has a valid schedule and no duplicate sentences", () => {
    expect(setErrors).toEqual([]);
  });

  it.each([...results, ...pool].map((r) => [r.file, r] as const))("%s is valid", (_, r) => {
    expect(r.errors).toEqual([]);
  });

  // Needs .cache/tanzil (not committed), so it only runs locally where the text is downloaded.
  it.skipIf(!loadTanzil())("has only verbatim Tanzil text in Quran puzzles", () => {
    const wrong = [...results, ...pool]
      .filter((r) => r.source?.source === "quran")
      .flatMap((r) => quranProblems(r.source!.text, r.source!.ref).map((p) => `${r.file}: ${p}`));
    expect(wrong).toEqual([]);
  });

  // Played days and tomorrow can't change; every later three-sentence day must get harder.
  it("gets harder within each upcoming day (easy ≤ medium ≤ hard by difficulty score)", () => {
    const fixed = lockedDays() + 1;
    const byDay = new Map<number, typeof results>();
    for (const r of results) byDay.set(r.number, [...(byDay.get(r.number) ?? []), r]);
    const wrong = [...byDay.entries()]
      .filter(([day, rs]) => day > fixed && rs.length === 3)
      .map(([day, rs]) => ({ day, rs: rs.sort((a, b) => a.slot - b.slot) }))
      .map(({ day, rs }) => ({ day, ids: rs.map((r) => r.id), scores: rs.map((r) => difficulty(r.puzzle!).score) }))
      .filter(({ scores: [e, m, h] }) => e > m || m > h)
      .map(({ day, ids, scores }) => `day ${day}: ${ids.map((id, k) => `${id}=${scores[k]}`).join(" ")}`);
    expect(wrong, "run npm run schedule -- relevel, or fix the levels by hand").toEqual([]);
  });

  it(`covers at least ${MIN_RUNWAY_DAYS} days ahead (after launch)`, () => {
    if (dayIndex() < LAUNCH_DAY) return; // pre-launch: nothing scheduled yet
    const lastDay = Math.max(...results.map((r) => r.number));
    const remaining = lastDay - puzzleNumber();
    expect(
      remaining,
      `only ${remaining} day(s) left in the schedule; add puzzles and run npm run schedule -- plan`,
    ).toBeGreaterThanOrEqual(MIN_RUNWAY_DAYS);
  });
});
