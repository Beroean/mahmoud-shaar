/**
 * Data test: every committed puzzle must be valid, and the schedule must not be about to run out.
 * This is what blocks a bad contribution from being merged/deployed.
 */
import { describe, expect, it } from "vitest";
import { LAUNCH_DAY, dayIndex, puzzleNumber } from "../../src/pages/shakkil/core/daily";
import { loadAll } from "./content";

/** Fail CI when fewer than this many future days are covered. */
const MIN_RUNWAY_DAYS = 14;

describe("content/shakkil/puzzles", () => {
  const { results, setErrors } = loadAll();

  it("has puzzles", () => {
    expect(results.length).toBeGreaterThan(0);
  });

  it("has a valid schedule and no duplicate sentences", () => {
    expect(setErrors).toEqual([]);
  });

  it.each(results.map((r) => [r.file, r] as const))("%s is valid", (_, r) => {
    expect(r.errors).toEqual([]);
  });

  it(`covers at least ${MIN_RUNWAY_DAYS} days ahead (after launch)`, () => {
    if (dayIndex() < LAUNCH_DAY) return; // pre-launch: nothing scheduled yet
    const remaining = results.length - puzzleNumber();
    expect(
      remaining,
      `only ${remaining} puzzle(s) left in the schedule; add more under content/shakkil/puzzles`,
    ).toBeGreaterThanOrEqual(MIN_RUNWAY_DAYS);
  });
});
