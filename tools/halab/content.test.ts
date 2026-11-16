/**
 * Data test: every حلبيّات item must be valid, each day must have its three rounds, and the content
 * must not be about to run out (this fails CI, and the nightly build, two weeks ahead).
 */
import { describe, expect, it } from "vitest";
import { todayNumber } from "../../src/pages/halab/core/daily";
import { loadDays, shuffledChoices } from "./content";

/** Fail CI when fewer than this many future days are covered. */
const MIN_RUNWAY_DAYS = 14;

describe("content/halab", () => {
  const { days, errors, counts } = loadDays();

  it("has no invalid items", () => {
    expect(errors).toEqual([]);
  });

  it("has days, each with an origin, a saying and a wildcard", () => {
    expect(days.length).toBeGreaterThan(0);
    for (const d of days) {
      expect(d.rounds[0].kind).toBe("origin");
      expect(["proverb", "wisdom", "taunt"]).toContain(d.rounds[1].kind);
      expect(["riddle", "vendor", "idiom", "belief", "simile", "blessing", "song"]).toContain(d.rounds[2].kind);
    }
  });

  it("sets the day count by the shortest list (the rest are spares)", () => {
    expect(days.length).toBe(Math.min(...Object.values(counts)));
  });

  it(`covers at least ${MIN_RUNWAY_DAYS} days ahead`, () => {
    const remaining = days.length - todayNumber();
    expect(
      remaining,
      `Only ${remaining} حلبيّات days left after today: add items to content/halab before the game runs out.`,
    ).toBeGreaterThanOrEqual(MIN_RUNWAY_DAYS);
  });

  it("offers four distinct choices including the answer", () => {
    for (const r of days.flatMap((d) => d.rounds)) {
      expect(r.choices).toHaveLength(4);
      expect(new Set(r.choices).size).toBe(4);
      expect(r.choices).toContain(r.answer);
    }
  });

  it("doesn't always put the answer in the same place", () => {
    const places = new Set(days.flatMap((d) => d.rounds.map((r) => r.choices.indexOf(r.answer))));
    expect(places.size).toBeGreaterThan(2);
  });
});

describe("shuffledChoices", () => {
  it("is stable for an ID", () => {
    expect(shuffledChoices("o001", "a", ["b", "c", "d"])).toEqual(shuffledChoices("o001", "a", ["b", "c", "d"]));
  });
});
