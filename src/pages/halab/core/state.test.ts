import { describe, expect, it } from "vitest";
import { shareText } from "./share";
import { type KV, currentStreak, emptySave, emptyStats, load, recordDay, save } from "./storage";

function memoryKV(): KV {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

describe("stats", () => {
  it("counts scores and consecutive days", () => {
    let s = recordDay(emptyStats(), 4, 3);
    s = recordDay(s, 5, 1);
    expect(s.played).toBe(2);
    expect(s.dist).toEqual([0, 1, 0, 1]);
    expect(s.streak).toBe(2);
    s = recordDay(s, 7, 2);
    expect(s.streak).toBe(1);
    expect(s.maxStreak).toBe(2);
  });

  it("shows a streak only while it's alive", () => {
    const s = recordDay(emptyStats(), 4, 0);
    expect(currentStreak(s, 5)).toBe(1);
    expect(currentStreak(s, 6)).toBe(0);
  });
});

describe("storage", () => {
  it("round-trips and survives garbage", () => {
    const kv = memoryKV();
    const data = { ...emptySave(), daily: { day: 2, ids: ["o002", "p002", "w002"], picks: ["التركية", null, null] } };
    save(data, kv);
    expect(load(kv)).toEqual(data);
    kv.setItem("halab:v1", "{not json");
    expect(load(kv)).toEqual(emptySave());
    expect(load(undefined)).toEqual(emptySave());
  });
});

describe("share", () => {
  it("lists one square per round", () => {
    const text = shareText(3, [
      { kind: "origin", correct: true },
      { kind: "proverb", correct: false },
      { kind: "riddle", correct: true },
    ]);
    expect(text.split("\n")[0]).toBe("حلبيّات #٣ ٢/٣");
    expect(text).toContain("🟩 أصل الكلمة\n🟥 كمّل المثل\n🟩 حزّورة");
  });
});
