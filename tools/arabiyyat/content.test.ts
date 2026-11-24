/**
 * Data test: every عربيّات item must be valid, every day must have its three rounds, and Aleppo items
 * borrowed from حلبيّات' spares must never be played in Halab too, and the days must keep
 * coming after the last one (they wrap around; `npm run runway` warns ahead).
 */
import { describe, expect, it } from "vitest";
import { shippedDays } from "../../src/lib/wrapDays";
import { loadDays as loadHalab } from "../halab/content";
import { loadDays } from "./content";

describe("content/arabiyyat", () => {
  const { days, errors, counts, halabIds } = loadDays();

  it("has no invalid items", () => {
    expect(errors).toEqual([]);
  });

  it("has days, each with a saying, a usage or meaning, and a wildcard", () => {
    expect(days.length).toBeGreaterThan(0);
    expect(days.length).toBe(Math.min(...Object.values(counts)));
    for (const d of days) {
      expect(d.rounds[0].kind).toBe("saying");
      expect(["usage", "meaning"]).toContain(d.rounds[1].kind);
      expect(["origin", "root", "riddle", "custom"]).toContain(d.rounds[2].kind);
    }
  });

  // Running out no longer breaks the site: the days wrap around. `npm run runway` warns ahead.
  it("keeps serving days after the last one (wraps around)", () => {
    const shipped = shippedDays(days, days.length + 3);
    for (let k = 1; k <= 3; k++) {
      const ids = (n: number) => shipped.find((d) => d.number === n)?.rounds.map((r) => r.id);
      expect(ids(days.length + k)).toEqual(ids(k));
    }
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

  it("only borrows حلبيّات items that Halab never plays", () => {
    const played = new Set(loadHalab().days.flatMap((d) => d.rounds.map((r) => r.id)));
    const clash = halabIds.filter((id) => played.has(id));
    expect(clash, "these Aleppo items are now played in حلبيّات too: replace them in content/arabiyyat").toEqual([]);
  });
});
