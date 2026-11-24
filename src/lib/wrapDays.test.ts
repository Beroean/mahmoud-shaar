import { describe, expect, it } from "vitest";
import { shippedDays, sourceDay, wrapDays } from "./wrapDays";

const day = (number: number, id = `d${number}`) => ({ number, id });

describe("wrapDays", () => {
  it("leaves the list alone until it runs out", () => {
    const days = [day(1), day(2), day(3)];
    expect(wrapDays(days, 3)).toEqual(days);
    expect(wrapDays(days, 1)).toEqual(days);
  });

  it("replays day 1 after the last day, under the new number", () => {
    const out = wrapDays([day(1), day(2), day(3)], 8);
    expect(out.map((d) => [d.number, d.id])).toEqual([
      [1, "d1"], [2, "d2"], [3, "d3"],
      [4, "d1"], [5, "d2"], [6, "d3"],
      [7, "d1"], [8, "d2"],
    ]);
  });

  it("copies every entry of a day (Shakkil's three sentences), in order", () => {
    const days = [
      { number: 1, id: "a", slot: 0 },
      { number: 1, id: "b", slot: 1 },
      { number: 2, id: "c", slot: 0 },
    ];
    expect(wrapDays(days, 3).filter((d) => d.number === 3)).toEqual([
      { number: 3, id: "a", slot: 0 },
      { number: 3, id: "b", slot: 1 },
    ]);
  });

  it("doesn't change the original entries", () => {
    const days = [day(1), day(2)];
    wrapDays(days, 5);
    expect(days).toEqual([day(1), day(2)]);
  });

  it("handles an empty list", () => {
    expect(wrapDays([], 10)).toEqual([]);
  });
});

describe("sourceDay", () => {
  it("maps a day past the end back into the list", () => {
    expect(sourceDay(1, 621)).toBe(1);
    expect(sourceDay(621, 621)).toBe(621);
    expect(sourceDay(622, 621)).toBe(1);
    expect(sourceDay(1242, 621)).toBe(621);
    expect(sourceDay(1243, 621)).toBe(1);
  });
});

describe("shippedDays", () => {
  const days = [day(1), day(2), day(3)];

  it("ships only up to lastDay, so later answers stay off the site", () => {
    expect(shippedDays(days, 2).map((d) => d.number)).toEqual([1, 2]);
    expect(shippedDays(days, 5).map((d) => d.number)).toEqual([1, 2, 3, 4, 5]);
  });

  it("ships every day to the dev server, wrapped up to lastDay", () => {
    expect(shippedDays(days, 2, true).map((d) => d.number)).toEqual([1, 2, 3]);
    expect(shippedDays(days, 5, true).map((d) => d.number)).toEqual([1, 2, 3, 4, 5]);
  });
});
