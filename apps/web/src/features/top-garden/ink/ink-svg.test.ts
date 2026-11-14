import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { brush } from "./brush";
import { inkSvg, pathData, renderStrokes } from "./ink-svg";

/** `M` と `l` だけで書いた `d` を、0.1 の単位の絶対の座標の列に戻す */
const absolute = (d: string): [number, number][] => {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map((v) => Math.round(Number(v) * 10));
  const out: [number, number][] = [];
  for (let i = 0; i < nums.length; i += 2) {
    const [px, py] = out.at(-1) ?? [0, 0];
    out.push([px + nums[i]!, py + nums[i + 1]!]);
  }
  return out;
};

describe("pathData", () => {
  it("1 点目を絶対の座標で、2 点目からを前の点との差で書く", () => {
    expect(
      pathData([
        [10, 20],
        [12.5, 18],
        [11, 18.04],
      ]),
    ).toBe("M10 20l2.5-2-1.5 0");
  });

  it("差を丸めた座標どうしで取り、絶対の座標を 0.1 の単位に丸めた点を通る", () => {
    const pts: [number, number][] = [
      [0.04, 0.06],
      [0.14, -0.26],
      [-3.05, 7.449],
      [100.96, 50.05],
    ];
    expect(absolute(pathData(pts))).toStrictEqual(
      pts.map(([x, y]) => [Math.round(x * 10), Math.round(y * 10)]),
    );
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
    }).toStrictEqual({ strokes: 399, paths: 543, tags: 543 });
  });

  it("決めた墨の絵と同じ文字列を書く", () => {
    // 試作の線に木の線を足した SVG の文字列の SHA-256。乱数の順がずれると変わる。
    expect(createHash("sha256").update(out.svg).digest("hex")).toBe(
      "729bb85f7d616fe625313426736797eceb60c4ce337d956c43b2799c87db1143",
    );
  });

  it("gzip で 28 KB 以内に収まる", () => {
    expect(gzipSync(out.svg).length).toBeLessThanOrEqual(28 * 1024);
  });

  it("3 つの層と松の円を、読み上げから隠した 1 枚の SVG に置く", () => {
    expect(out.svg).toMatch(
      /^<svg class="ink-svg" viewBox="0 0 1600 900" aria-hidden="true" focusable="false">.*<g class="far">.*<g class="mid">.*<g class="near"><g class="pine"><circle .*<\/svg>$/s,
    );
  });
});
