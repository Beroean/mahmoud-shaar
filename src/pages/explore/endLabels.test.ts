import { describe, expect, it } from "vitest";
import { dodge } from "./endLabels";

describe("dodge", () => {
  it("leaves labels that are far enough apart where they are", () => {
    expect(dodge([100, 10, 50], 15, 0, 200)).toEqual([100, 10, 50]);
  });

  it("spreads bunched labels at least the gap apart, keeping their order", () => {
    const ys = dodge([50, 52, 51], 15, 0, 200);
    const sorted = [...ys].sort((a, b) => a - b);
    expect(sorted[1] - sorted[0]).toBeGreaterThanOrEqual(15);
    expect(sorted[2] - sorted[1]).toBeGreaterThanOrEqual(15);
    expect(ys[0] < ys[2] && ys[2] < ys[1]).toBe(true);
  });

  it("keeps labels inside the plot", () => {
    expect(dodge([198, 199], 15, 0, 200)).toEqual([185, 200]);
    expect(dodge([1, 2], 15, 10, 200)).toEqual([10, 25]);
  });
});
