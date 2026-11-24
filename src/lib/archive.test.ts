import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type KV, dateOfDay, loadArchive, randomPastDay, saveArchiveDay } from "./archive";
import { archivePicks, archivedPicks, dayMode } from "../pages/halab/core/pastDays";
import { archiveNumber } from "../pages/shakkil/core/daily";

function fakeKV(init: Record<string, string> = {}): KV & { data: Record<string, string> } {
  const data = { ...init };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

describe("archive storage", () => {
  it("keeps each game's days apart and adds to what's there", () => {
    const kv = fakeKV();
    saveArchiveDay("halab", 3, { progress: "a" }, kv);
    saveArchiveDay("halab", 5, { progress: "b", score: { got: 2, of: 3 } }, kv);
    saveArchiveDay("shakkil", 3, { progress: "c" }, kv);
    expect(loadArchive("halab", kv)).toEqual({ 3: { progress: "a" }, 5: { progress: "b", score: { got: 2, of: 3 } } });
    expect(loadArchive("shakkil", kv)).toEqual({ 3: { progress: "c" } });
  });

  it("starts empty on corrupt or missing storage, and never throws", () => {
    expect(loadArchive("halab", fakeKV({ "halab:archive": "{oops" }))).toEqual({});
    expect(loadArchive("halab", fakeKV({ "halab:archive": "[1]" }))).toEqual({});
    expect(loadArchive("halab", undefined)).toEqual({});
    const full: KV = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
    expect(() => saveArchiveDay("halab", 1, { progress: 1 }, full)).not.toThrow();
  });
});

describe("dateOfDay", () => {
  it("counts from the launch date", () => {
    expect(dateOfDay("2026-11-13", 1).toISOString().slice(0, 10)).toBe("2026-11-13");
    expect(dateOfDay("2026-11-13", 20).toISOString().slice(0, 10)).toBe("2026-12-02");
  });
});

describe("randomPastDay", () => {
  it("picks a day before today, preferring unplayed ones", () => {
    const archive = { 1: { progress: 0 }, 2: { progress: 0 } };
    for (const r of [0, 0.5, 0.99]) expect(randomPastDay(5, archive, () => r)).toBeOneOf([3, 4]);
    expect(randomPastDay(3, archive, () => 0.99)).toBe(2);
    expect(randomPastDay(1, {})).toBeNull();
  });
});

describe("dayMode (حلبيّات, عربيّات)", () => {
  it("plays past days from the archive, today as the daily game", () => {
    expect(dayMode(null, 10, true)).toBe("daily");
    expect(dayMode(10, 10, true)).toBe("daily");
    expect(dayMode(4, 10, true)).toBe("archive");
    expect(dayMode(12, 10, true)).toBe("preview"); // dev only: previewNumber refuses it on the site
    expect(dayMode(null, 1, false)).toBe("preview");
  });
});

describe("archivePicks / archivedPicks", () => {
  beforeEach(() => vi.stubGlobal("localStorage", fakeKV()));
  afterEach(() => vi.unstubAllGlobals());
  const day = { number: 4, rounds: [{ id: "a", answer: "x" }, { id: "b", answer: "y" }, { id: "c", answer: "z" }] };

  it("saves answers so far, and the score once every round is answered", () => {
    archivePicks("test-picks", day, ["x", null, null]);
    expect(loadArchive("test-picks")[4]).toEqual({ progress: { ids: ["a", "b", "c"], picks: ["x", null, null] } });
    expect(archivedPicks("test-picks", day)).toEqual(["x", null, null]);
    archivePicks("test-picks", day, ["x", "n", "z"]);
    expect(loadArchive("test-picks")[4].score).toEqual({ got: 2, of: 3 });
  });

  it("drops answers saved for different rounds", () => {
    archivePicks("test-picks", day, ["x", "y", "z"]);
    expect(archivedPicks("test-picks", { ...day, rounds: [...day.rounds.slice(0, 2), { id: "d", answer: "w" }] })).toBeNull();
  });
});

describe("archiveNumber (Shakkil)", () => {
  it("opens only days before today", () => {
    expect(archiveNumber("?day=3", 10)).toBe(3);
    expect(archiveNumber("?day=10", 10)).toBeNull();
    expect(archiveNumber("?day=11", 10)).toBeNull();
    expect(archiveNumber("?day=0", 10)).toBeNull();
    expect(archiveNumber("?day=x", 10)).toBeNull();
    expect(archiveNumber("", 10)).toBeNull();
  });
});
