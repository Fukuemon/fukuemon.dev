import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { brush, rng, sample } from "./brush";
import { inkArt } from "./ink-art";
import { inkSvg, renderStrokes } from "./ink-svg";

describe("rng", () => {
  it("同じ種からは同じ列を、違う種からは違う列を返す", () => {
    const take = (seed: number) => {
      const r = rng(seed);
      return Array.from({ length: 8 }, r);
    };
    expect(take(7)).toEqual(take(7));
    expect(take(7)).not.toEqual(take(8));
    for (const v of take(7)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
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
    expect(p[0]).toEqual([0, 0]);
    expect(p.at(-1)).toEqual([30, 0]);
    expect(p).toHaveLength(11);
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
    expect(B.strokes[0]).toMatchObject({ layer: "mid", dry: 0.4, tin: 0.12, tout: 0.3, lw: 1.7 });
  });
});

describe("inkArt", () => {
  it("同じ種からは同じ線のデータができる", () => {
    expect(inkArt(7)).toEqual(inkArt(7));
  });

  it("違う種からは違う線のデータができる", () => {
    expect(inkArt(8)).not.toEqual(inkArt(7));
  });

  it("試作と同じ数の線を作る", () => {
    expect(inkArt().strokes).toHaveLength(281);
  });
});

describe("renderStrokes", () => {
  it("線ごとの <g> に、描き始める時刻と描く時間を、縮めた ms で書く", () => {
    const B = brush(1);
    B.add(
      "far",
      [
        [0, 0],
        [100, 0],
      ],
      { w: 4, a: 0.5, t0: 3900, dur: 390 },
    );
    const r = renderStrokes(B.strokes);
    expect(r.layers.far[0]).toMatch(
      /^<g style="--t:3150ms;--d:315ms"><path pathLength="1" d="M0 0L/,
    );
    expect(r.paths).toBe(1);
  });

  it("太い線ほど、多くの path に分ける", () => {
    const B = brush(1);
    const pts = [
      [0, 0],
      [100, 0],
    ] as const;
    B.add("mid", pts, { w: 2, a: 0.5, t0: 0, dur: 100 });
    B.add("mid", pts, { w: 30, a: 0.5, t0: 0, dur: 100 });
    const [thin, thick] = renderStrokes(B.strokes).layers.mid;
    expect(thin!.match(/<path/g)).toHaveLength(1);
    expect(thick!.match(/<path/g)).toHaveLength(5);
  });
});

describe("inkSvg", () => {
  const out = inkSvg();

  it("同じ入力からは同じ文字列を書く", () => {
    expect(inkSvg().svg).toBe(out.svg);
  });

  it("試作と同じ数の path を書く", () => {
    expect(out.strokes).toBe(281);
    expect(out.paths).toBe(415);
    expect(out.svg.match(/<path /g)).toHaveLength(415);
  });

  it("gzip で 40 KB 以内に収まる", () => {
    expect(gzipSync(out.svg).length).toBeLessThanOrEqual(40 * 1024);
  });

  it("3 つの層と松の円を、読み上げから隠した 1 枚の SVG に置く", () => {
    expect(out.svg).toMatch(
      /^<svg class="ink-svg" viewBox="0 0 1600 900" aria-hidden="true" focusable="false">/,
    );
    expect(out.svg).toContain('<g class="far">');
    expect(out.svg).toContain('<g class="mid">');
    expect(out.svg).toMatch(/<g class="near"><g class="pine"><circle /);
    expect(out.svg.endsWith("</svg>")).toBe(true);
  });
});
