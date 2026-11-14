import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { brush } from "./brush";
import { inkSvg, renderStrokes } from "./ink-svg";

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
    expect({ head: r.layers.far[0]?.slice(0, 52), paths: r.paths }).toStrictEqual({
      head: '<g style="--t:3150ms;--d:315ms"><path pathLength="1"',
      paths: 1,
    });
  });

  it("太い線ほど、多くの path に分ける", () => {
    const B = brush(1);
    const pts = [
      [0, 0],
      [100, 0],
    ] as const;
    B.add("mid", pts, { w: 2, a: 0.5, t0: 0, dur: 100 });
    B.add("mid", pts, { w: 30, a: 0.5, t0: 0, dur: 100 });
    const counts = renderStrokes(B.strokes).layers.mid.map((g) => g.match(/<path/g)?.length);
    expect(counts).toStrictEqual([1, 5]);
  });
});

describe("inkSvg", () => {
  const out = inkSvg();

  it("同じ入力からは同じ文字列を書く", () => {
    expect(inkSvg().svg).toBe(out.svg);
  });

  it("試作の線に木の線を足した数の線と path を書く", () => {
    expect({
      strokes: out.strokes,
      paths: out.paths,
      tags: out.svg.match(/<path /g)?.length,
    }).toStrictEqual({ strokes: 393, paths: 543, tags: 543 });
  });

  it("決めた墨の絵と同じ文字列を書く", () => {
    // 試作の線に木の線を足した SVG の文字列の SHA-256。乱数の順がずれると変わる。
    expect(createHash("sha256").update(out.svg).digest("hex")).toBe(
      "3a6bc9830ed4ce5aa082bb587f902c58b7123d161ed352316db9814b27e67004",
    );
  });

  it("gzip で 45 KB 以内に収まる", () => {
    expect(gzipSync(out.svg).length).toBeLessThanOrEqual(45 * 1024);
  });

  it("3 つの層と松の円を、読み上げから隠した 1 枚の SVG に置く", () => {
    expect(out.svg).toMatch(
      /^<svg class="ink-svg" viewBox="0 0 1600 900" aria-hidden="true" focusable="false">.*<g class="far">.*<g class="mid">.*<g class="near"><g class="pine"><circle .*<\/svg>$/s,
    );
  });
});
