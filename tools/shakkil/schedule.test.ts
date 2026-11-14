import { describe, expect, it } from "vitest";
import { loadAll, normalizeId, parseSchedule, readRejected, resolveOrder } from "./content";
import { buildReport } from "./pr-report";
import { LAUNCH_DATE } from "../../src/pages/shakkil/core/daily";
import { dateOfDay, mixByLevel, moveTo, roundRobin } from "./schedule";

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
    expect(dateOfDay(1)).toBe(LAUNCH_DATE);
    const d = new Date(`${LAUNCH_DATE}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 31);
    expect(dateOfDay(32)).toBe(d.toISOString().slice(0, 10));
  });
});

describe("mixByLevel", () => {
  it("spreads harder puzzles evenly and keeps each level's order", () => {
    const easy = Array.from({ length: 6 }, (_, i) => ({ id: `e${i}`, level: 1 }));
    const hard = [{ id: "h0", level: 3 }, { id: "h1", level: 3 }];
    const mixed = mixByLevel([...easy, ...hard]).map((x) => x.id);
    expect(mixed).toEqual(["e0", "e1", "h0", "e2", "e3", "e4", "h1", "e5"]);
  });
});

describe("roundRobin", () => {
  it("spreads each group through the list instead of leaving blocks", () => {
    const items = ["q1", "q2", "q3", "p1", "p2", "p3"].map((id) => ({ id, g: id[0] }));
    expect(roundRobin(items, (x) => x.g).map((x) => x.id)).toEqual(["q1", "p1", "q2", "p2", "q3", "p3"]);
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
