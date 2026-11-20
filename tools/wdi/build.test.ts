import { describe, expect, it } from "vitest";
import { timeSeries } from "./build";

describe("timeSeries", () => {
  it("spans the indicator's years and fills gaps with null", () => {
    const ts = timeSeries(
      new Map([
        ["AAA", [[2000, 1], [2002, 3]]],
        ["BBB", [[2001, 5], [2003, 7]]],
      ] as [string, [number, number][]][]),
    );
    expect(ts).toEqual({
      from: 2000,
      to: 2003,
      series: { AAA: [1, null, 3, null], BBB: [null, 5, null, 7] },
    });
  });
});
