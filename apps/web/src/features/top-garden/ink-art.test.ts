import { describe, expect, it } from "vitest";
import { inkArt } from "./ink-art";

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
});
