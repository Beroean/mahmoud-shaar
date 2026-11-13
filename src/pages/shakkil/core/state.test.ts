import { describe, expect, it } from "vitest";
import { LAUNCH_DATE, dayIndex, msUntilNext, puzzleNumber, scheduledIndex } from "./daily";
import { shareText, toArabicDigits, wordSquare } from "./share";
import { type KV, currentStreak, emptyStats, load, recordResult, save } from "./storage";

const launch = Date.parse(`${LAUNCH_DATE}T00:00:00+03:00`);
const H = 3_600_000;

describe("daily", () => {
  it("puzzle #1 starts at midnight Mecca time on launch day", () => {
    expect(puzzleNumber(launch)).toBe(1);
    expect(puzzleNumber(launch - 1)).toBe(1); // before launch: preview #1
    expect(puzzleNumber(launch + 24 * H - 1)).toBe(1);
    expect(puzzleNumber(launch + 24 * H)).toBe(2);
  });

  it("rolls over at 21:00 UTC", () => {
    const d = Date.parse("2027-01-10T20:59:59Z");
    expect(dayIndex(d + 1000)).toBe(dayIndex(d) + 1);
  });

  it("counts down to the next puzzle", () => {
    expect(msUntilNext(launch)).toBe(24 * H);
    expect(msUntilNext(launch + 23 * H)).toBe(H);
  });

  it("wraps the schedule instead of failing", () => {
    expect(scheduledIndex(1, 10)).toBe(0);
    expect(scheduledIndex(10, 10)).toBe(9);
    expect(scheduledIndex(11, 10)).toBe(0);
  });
});

describe("stats", () => {
  it("builds streaks on consecutive wins and resets on a loss", () => {
    let s = emptyStats();
    s = recordResult(s, 1, true, 3);
    s = recordResult(s, 2, true, 1);
    expect(s).toMatchObject({ played: 2, won: 2, streak: 2, maxStreak: 2, lastWon: 2 });
    expect(s.dist).toEqual([1, 0, 1, 0, 0, 0]);
    s = recordResult(s, 3, false, 6);
    expect(s).toMatchObject({ played: 3, streak: 0, maxStreak: 2 });
  });

  it("restarts the streak after a skipped day", () => {
    let s = recordResult(emptyStats(), 1, true, 2);
    s = recordResult(s, 3, true, 2);
    expect(s.streak).toBe(1);
  });

  it("shows a streak as broken once a day is missed", () => {
    const s = recordResult(emptyStats(), 5, true, 2);
    expect(currentStreak(s, 5)).toBe(1);
    expect(currentStreak(s, 6)).toBe(1); // today not played yet
    expect(currentStreak(s, 7)).toBe(0);
  });
});

describe("storage", () => {
  const memory = (): KV & { data: Map<string, string> } => {
    const data = new Map<string, string>();
    return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  };

  it("round-trips", () => {
    const kv = memory();
    const d = load(kv);
    d.stats = recordResult(d.stats, 1, true, 2);
    d.daily = { puzzle: 1, attempts: [[[{ shadda: false, vowel: "a" }]]], status: "won" };
    save(d, kv);
    expect(load(kv)).toEqual(d);
  });

  it("falls back to a fresh save on corrupt or foreign data", () => {
    const kv = memory();
    kv.data.set("shakkil:v1", "{not json");
    expect(load(kv).stats.played).toBe(0);
    kv.data.set("shakkil:v1", JSON.stringify({ version: 99 }));
    expect(load(kv).stats.played).toBe(0);
  });

  it("drops a malformed in-progress game but keeps stats", () => {
    const kv = memory();
    kv.data.set(
      "shakkil:v1",
      JSON.stringify({ version: 1, stats: { ...emptyStats(), played: 4 }, daily: { puzzle: 1, attempts: "x" } }),
    );
    const d = load(kv);
    expect(d.daily).toBeNull();
    expect(d.stats.played).toBe(4);
  });

  it("survives storage that throws", () => {
    const kv: KV = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(load(kv).version).toBe(1);
    expect(() => save(load(kv), kv)).not.toThrow();
  });
});

describe("share", () => {
  it("summarizes each word", () => {
    expect(wordSquare(["fixed", "correct", "correct"])).toBe("🟩");
    expect(wordSquare(["wrong", "fixed", "wrong"])).toBe("🟥");
    expect(wordSquare(["wrong", "partial"])).toBe("🟨");
  });

  it("formats the share text", () => {
    const text = shareText(
      12,
      [
        [["wrong"], ["correct", "partial"]],
        [["correct"], ["correct", "correct"]],
      ],
      true,
    );
    expect(text.split("\n")).toEqual([
      "شَكِّل #١٢ ٢/٦",
      "",
      "🟥🟨",
      "🟩🟩",
      "",
      "https://mahmoudshaar.com/shakkil/",
    ]);
    expect(shareText(3, [[["wrong"]]], false)).toContain("X/٦");
  });

  it("uses Arabic-Indic digits", () => {
    expect(toArabicDigits(2026)).toBe("٢٠٢٦");
  });
});

describe("launch", () => {
  it("counts down to launch before it and reports launched after", async () => {
    const { isLaunched, msUntilLaunch } = await import("./daily");
    expect(isLaunched(launch - 1)).toBe(false);
    expect(msUntilLaunch(launch - H)).toBe(H);
    expect(isLaunched(launch)).toBe(true);
    expect(msUntilLaunch(launch + H)).toBe(0);
  });
});
