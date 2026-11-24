import { describe, expect, it } from "vitest";
import { about, tidy, timeSeries } from "./build";

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

describe("tidy", () => {
  it("trims lines and keeps at most one blank line in a row", () => {
    expect(tidy("  a  \n\n\n\n b \n")).toBe("a\n\nb");
    expect(tidy(undefined)).toBe("");
  });
});

describe("about", () => {
  it("keeps the non-empty notes in a fixed order, with headings", () => {
    expect(
      about({
        "Limitations and exceptions": "Gaps.",
        "Development relevance": " Matters. ",
        "Statistical concept and methodology": "",
      }),
    ).toEqual([
      ["Why it matters", "Matters."],
      ["Limitations", "Gaps."],
    ]);
  });
});
