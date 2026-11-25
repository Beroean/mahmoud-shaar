import { describe, expect, it } from "vitest";
import { toPoints } from "./country";

describe("toPoints", () => {
  it("keeps each figure with its year and drops the missing years", () => {
    expect(toPoints(2000, [1, null, 3, null])).toEqual([[2000, 1], [2002, 3]]);
    expect(toPoints(2000, undefined)).toEqual([]);
  });
});
