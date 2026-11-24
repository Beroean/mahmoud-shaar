import { describe, expect, it, vi } from "vitest";
import { dayStore, splitDays, storeOf } from "./dayStore";

const day = (number: number, id = `d${number}`) => ({ number, id });
const days = (n: number) => Array.from({ length: n }, (_, i) => day(i + 1));
const numbers = (list: { number: number }[]) => list.map((d) => d.number);

describe("splitDays", () => {
  it("ships nothing after tomorrow, so later answers stay off the site", () => {
    const split = splitDays(days(100), 12, false, 5);
    expect(split.last).toBe(12);
    expect(numbers(split.blocks.flat())).toEqual(numbers(days(12)));
    expect(split.blocks.map(numbers)).toEqual([[1, 2, 3, 4, 5], [6, 7, 8, 9, 10], [11, 12]]);
  });

  it("inlines today and tomorrow, so the daily game needs no block", () => {
    expect(numbers(splitDays(days(100), 12, false, 5).recent)).toEqual([11, 12]);
  });

  it("keeps each original day once after the content wraps around", () => {
    const split = splitDays(days(10), 25, false, 4);
    expect(split.count).toBe(10);
    expect(numbers(split.blocks.flat())).toEqual(numbers(days(10)));
    expect(split.recent).toEqual([day(24, "d4"), day(25, "d5")]);
  });

  it("gives the dev server every day", () => {
    const split = splitDays(days(10), 3, true, 4);
    expect(split.last).toBe(10);
    expect(numbers(split.blocks.flat())).toEqual(numbers(days(10)));
  });

  it("puts all of a day's entries in one block (Shakkil's three sentences)", () => {
    const entries = [day(1, "a"), day(1, "b"), day(2, "c"), day(2, "d"), day(3, "e")];
    expect(splitDays(entries, 3, false, 2).blocks).toEqual([entries.slice(0, 4), entries.slice(4)]);
  });

  it("leaves a full block unchanged as later days are added (so it stays cached)", () => {
    const first = splitDays(days(100), 33, false, 30).blocks[0];
    expect(splitDays(days(100), 80, false, 30).blocks[0]).toEqual(first);
  });
});

describe("dayStore", () => {
  it("serves past days, wrapped days under their own number, and nothing past the last day", async () => {
    const store = storeOf(splitDays(days(10), 25, false, 4));
    expect(await store.day(3)).toEqual([day(3)]);
    expect(await store.day(13)).toEqual([day(13, "d3")]);
    expect(await store.day(25)).toEqual([day(25, "d5")]);
    expect(await store.day(26)).toEqual([]);
    expect(await store.day(0)).toEqual([]);
    expect(await store.day(1.5)).toEqual([]);
  });

  it("fetches a block only when one of its days is opened, and only once", async () => {
    const split = splitDays(days(12), 12, false, 5);
    const loads = split.blocks.map((b) => vi.fn(async () => ({ default: b })));
    const store = dayStore({ ...split, blocks: loads });
    await store.day(12);
    expect(loads.map((l) => l.mock.calls.length)).toEqual([0, 0, 0]);
    await store.day(2);
    await store.day(4);
    expect(loads.map((l) => l.mock.calls.length)).toEqual([1, 0, 0]);
  });

  it("retries a block whose fetch failed", async () => {
    const split = splitDays(days(5), 5, false, 5);
    let fail = true;
    const store = dayStore({
      ...split,
      blocks: [async () => (fail ? Promise.reject(new Error("offline")) : { default: split.blocks[0] })],
    });
    await expect(store.day(1)).rejects.toThrow("offline");
    fail = false;
    expect(await store.day(1)).toEqual([day(1)]);
  });
});
