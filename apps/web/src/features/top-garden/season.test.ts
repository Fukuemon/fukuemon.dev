import { describe, expect, it } from "vitest";
import { seasonOf, timeOfDayOf } from "./season";

const dateOn = (m: number, d: number) => new Date(2026, m - 1, d, 12);
const dateAt = (h: number, min: number) => new Date(2026, 10, 13, h, min);

describe("seasonOf", () => {
  it.each([
    [2, 28, "winter"],
    [3, 1, "spring"],
    [5, 31, "spring"],
    [6, 1, "summer"],
    [8, 31, "summer"],
    [9, 1, "autumn"],
    [11, 30, "autumn"],
    [12, 1, "winter"],
    [1, 1, "winter"],
  ] as const)("%i 月 %i 日は %s", (m, d, season) => {
    expect(seasonOf(dateOn(m, d))).toBe(season);
  });
});

describe("timeOfDayOf", () => {
  it.each([
    [0, 0, "night"],
    [4, 59, "night"],
    [5, 0, "morning"],
    [9, 59, "morning"],
    [10, 0, "day"],
    [15, 59, "day"],
    [16, 0, "evening"],
    [18, 59, "evening"],
    [19, 0, "night"],
    [23, 59, "night"],
  ] as const)("%i 時 %i 分は %s", (h, min, time) => {
    expect(timeOfDayOf(dateAt(h, min))).toBe(time);
  });
});
