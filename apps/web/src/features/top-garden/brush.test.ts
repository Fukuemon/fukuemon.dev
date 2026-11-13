import { describe, expect, it } from "vitest";
import { brush, sample } from "./brush";
import { rng } from "./rng";

const take = (seed: number) => Array.from({ length: 8 }, rng(seed));

describe("rng", () => {
  it("同じ種からは同じ列を返す", () => {
    expect(take(7)).toStrictEqual(take(7));
  });

  it("違う種からは違う列を返す", () => {
    expect(take(7)).not.toStrictEqual(take(8));
  });

  it("0 以上 1 未満の値を返す", () => {
    expect(take(7).every((v) => v >= 0 && v < 1)).toBe(true);
  });
});

describe("sample", () => {
  it("始めの点と終わりの点を通り、間を step ほどの間隔で埋める", () => {
    const p = sample(
      [
        [0, 0],
        [30, 0],
      ],
      3,
    );
    expect({ first: p[0], last: p.at(-1), length: p.length }).toStrictEqual({
      first: [0, 0],
      last: [30, 0],
      length: 11,
    });
  });
});

describe("brush", () => {
  it("add は、省いた値に既定の値を入れる", () => {
    const B = brush(1);
    B.add(
      "mid",
      [
        [0, 0],
        [10, 0],
      ],
      { w: 3, a: 0.5, t0: 0, dur: 100 },
    );
    const { layer, dry, tin, tout, lw } = B.strokes[0]!;
    expect({ layer, dry, tin, tout, lw }).toStrictEqual({
      layer: "mid",
      dry: 0.4,
      tin: 0.12,
      tout: 0.3,
      lw: 1.7,
    });
  });
});
