import { describe, expect, it } from "vitest";
import { inkArt } from "./ink-art";
import { TIME_SCALE } from "./ink-svg";
import { INK_END, SIGN_LEAD } from "../intro-timing";

describe("inkArt", () => {
  it("同じ種からは同じ線のデータができる", () => {
    expect(inkArt(7)).toStrictEqual(inkArt(7));
  });

  it("違う種からは違う線のデータができる", () => {
    expect(inkArt(8)).not.toStrictEqual(inkArt(7));
  });

  it("試作と同じ数の線を作る", () => {
    expect(inkArt().strokes).toHaveLength(281);
  });

  it("墨の絵の最後の線は、INK_END より前に描き終え、その差は 0.3 秒より短い", () => {
    const last = Math.max(...inkArt().strokes.map((s) => (s.t0 + s.dur) * TIME_SCALE)) + SIGN_LEAD;
    expect({
      last: Math.round(last),
      early: INK_END - last >= 0 && INK_END - last < 300,
    }).toStrictEqual({
      last: Math.round(last),
      early: true,
    });
  });
});
