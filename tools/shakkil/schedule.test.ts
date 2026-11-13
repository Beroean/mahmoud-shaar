import { describe, expect, it } from "vitest";
import { loadAll, normalizeId, parseSchedule, readRejected, resolveOrder } from "./content";
import { buildReport } from "./pr-report";
import { dateOfDay, moveTo } from "./schedule";

describe("schedule", () => {
  it("normalizes IDs however YAML reads them", () => {
    expect(parseSchedule('- "0007"\n- 3\n- 0012.yaml\n')).toEqual(["0007", "0003", "0012"]);
    expect(normalizeId(42)).toBe("0042");
  });

  it("runs scheduled IDs first, then the rest in ID order", () => {
    const r = resolveOrder(["0003", "0001"], ["0001", "0002", "0003", "0004"]);
    expect(r.order).toEqual(["0003", "0001", "0002", "0004"]);
    expect(r.errors).toEqual([]);
  });

  it("reports unknown and duplicate entries", () => {
    const r = resolveOrder(["0009", "0001", "0001"], ["0001", "0002"]);
    expect(r.order).toEqual(["0001", "0002"]);
    expect(r.errors.join()).toMatch(/unknown puzzle 0009/);
    expect(r.errors.join()).toMatch(/listed twice/);
  });

  it("moves puzzles to the front of the upcoming days, never into locked ones", () => {
    const order = ["a", "b", "c", "d", "e"];
    expect(moveTo(order, ["e", "d"], 3, 2)).toEqual(["a", "b", "e", "d", "c"]);
    expect(moveTo(order, ["a"], 5, 0)).toEqual(["b", "c", "d", "e", "a"]);
    expect(() => moveTo(order, ["b"], 4, 2)).toThrow(/locked/);
    expect(() => moveTo(order, ["e"], 2, 2)).toThrow(/locked/);
    expect(() => moveTo(order, ["x"], 4, 0)).toThrow(/unknown/);
  });

  it("dates days from the launch date", () => {
    expect(dateOfDay(1)).toBe("2026-12-01");
    expect(dateOfDay(32)).toBe("2027-01-01");
  });
});

describe("PR report locking", () => {
  const { results, setErrors } = loadAll();
  const ids = results.map((r) => r.id);

  it("fails when a played day's puzzle changes", () => {
    const base = [ids[1], ids[0], ...ids.slice(2)]; // live order had the first two swapped
    const r = buildReport([], results, setErrors, { baseOrder: base, locked: 2, scheduleChanged: true });
    expect(r.ok).toBe(false);
    expect(r.markdown).toMatch(/played and can't change/);
  });

  it("allows reordering upcoming days", () => {
    const base = [ids[0], ids[1], ids[3], ids[2], ...ids.slice(4)];
    const r = buildReport([], results, setErrors, { baseOrder: base, locked: 2, scheduleChanged: true });
    expect(r.ok).toBe(true);
    expect(r.markdown).toMatch(/new order/);
  });

  it("allows deleting an upcoming puzzle but not a played one", () => {
    const ctx = { baseOrder: ids, locked: 3 };
    expect(buildReport([{ status: "deleted", file: `${ids[5]}.yaml` }], results, setErrors, ctx).ok).toBe(true);
    expect(buildReport([{ status: "deleted", file: `${ids[1]}.yaml` }], results, setErrors, ctx).ok).toBe(false);
  });
});

describe("rejected sentences", () => {
  it("reserves the link-preview tagline", () => {
    expect(readRejected().has("شَكِّلْ تَفُزْ".normalize("NFC"))).toBe(true);
  });
});
