import { describe, expect, it } from "vitest";
import { MEASURES, type Measure } from "./basket";
import { type Point, flatRuleText, readChange, tally } from "./verdict";

const m = (id: string) => MEASURES.find((x) => x.id === id)!;
const life = m("SP.DYN.LE00.IN"); // higher is better, little change < 1 year
const child = m("SH.DYN.MORT"); // lower is better, little change < 5%
const pop = m("SP.POP.TOTL"); // context

describe("readChange", () => {
  it("reads the latest figure against the first", () => {
    const up: Point[] = [[1960, 50], [1990, 60], [2024, 72]];
    expect(readChange(life, up, {}, 2024)).toMatchObject({ verdict: "better", first: [1960, 50], last: [2024, 72], diff: 22 });
    expect(readChange(child, up, {}, 2024).verdict).toBe("worse");
    expect(readChange(child, [[1960, 200], [2024, 20]], {}, 2024)).toMatchObject({ verdict: "better", percent: -90 });
  });

  it("ignores what happened in between", () => {
    expect(readChange(life, [[1960, 50], [1990, 30], [2024, 52]], {}, 2024).verdict).toBe("better");
  });

  it("calls a change inside the rule little change", () => {
    expect(readChange(life, [[1960, 70], [2024, 70.9]], {}, 2024).verdict).toBe("flat");
    expect(readChange(life, [[1960, 70], [2024, 69]], {}, 2024).verdict).toBe("worse");
    expect(readChange(child, [[1960, 100], [2024, 96]], {}, 2024).verdict).toBe("flat");
    expect(readChange(child, [[1960, 100], [2024, 95]], {}, 2024).verdict).toBe("better");
  });

  it("compares within the years the reader chose", () => {
    const pts: Point[] = [[1960, 50], [2005, 75], [2012, 74], [2020, 70]];
    expect(readChange(life, pts, {}, 2024).verdict).toBe("better");
    expect(readChange(life, pts, { from: 2010 }, 2024)).toMatchObject({ verdict: "worse", first: [2012, 74], last: [2020, 70] });
    expect(readChange(life, pts, { from: 1950, to: 2006 }, 2024)).toMatchObject({ verdict: "better", first: [1960, 50], last: [2005, 75] });
    // Too old is judged against the end of the chosen years.
    expect(readChange(life, pts, { to: 2019 }, 2024).last).toEqual([2012, 74]);
    expect(readChange(life, [[1960, 50], [1970, 60]], { to: 1985 }, 2024).verdict).toBe("stale");
    expect(readChange(life, pts, { from: 2021 }, 2024)).toMatchObject({ verdict: "short", first: null, last: null });
  });

  it("gives no reading without enough years or with an old latest figure", () => {
    expect(readChange(life, [], {}, 2024).verdict).toBe("short");
    expect(readChange(life, [[2020, 70]], {}, 2024).verdict).toBe("short");
    expect(readChange(life, [[2020, 70], [2024, 75]], {}, 2024).verdict).toBe("short");
    expect(readChange(life, [[1997, 60], [2010, 75]], {}, 2024).verdict).toBe("stale");
    expect(readChange(life, [[1997, 60], [2014, 75]], {}, 2024).verdict).toBe("better");
  });

  it("never reads a context measure", () => {
    expect(readChange(pop, [[1960, 1e6], [2024, 9e6]], {}, 2024)).toMatchObject({ verdict: "context", percent: 800 });
  });
});

describe("the basket", () => {
  it("has no duplicate series and a reason for every reading", () => {
    expect(new Set(MEASURES.map((x) => x.id)).size).toBe(MEASURES.length);
    for (const x of MEASURES) expect(x.basis.length, x.id).toBeGreaterThan(20);
    for (const x of MEASURES) expect((x.group === "context") === (x.reading === "context"), x.id).toBe(true);
  });

  it("states each little-change rule", () => {
    expect(flatRuleText(life)).toBe("less than 1 year");
    expect(flatRuleText(child)).toBe("less than 5% of the first figure");
    expect(flatRuleText(m("EG.ELC.ACCS.ZS"))).toBe("less than 1 percentage point");
    expect(flatRuleText(m("GOV_WGI_CC.SC") as Measure)).toBe("less than 3 points");
  });
});

describe("tally", () => {
  it("counts every reading except context", () => {
    expect(tally(["better", "better", "worse", "context", "stale"])).toEqual({ better: 2, worse: 1, flat: 0, short: 0, stale: 1 });
  });
});
