import { describe, expect, it } from "vitest";
import { judge, medians, type Row } from "./lighthouse-judge.ts";

const row = (score: number, lcp: number, lcpIsFcp = false): Row => ({
  score,
  fcp: 1500,
  lcp,
  tbt: 180,
  si: 1500,
  cls: 0,
  lcpIsFcp,
});

describe("medians", () => {
  it("奇数の回は、中央の値を返す", () => {
    expect(medians([row(93, 2900), row(91, 2800), row(92, 2850)])).toMatchObject({
      score: 92,
      lcp: 2850,
    });
  });

  it("偶数の回は、中央の 2 つの値の平均を返す", () => {
    expect(medians([row(91, 2800), row(92, 2820), row(93, 2840), row(94, 2900)])).toMatchObject({
      score: 92.5,
      lcp: 2830,
    });
  });

  it("回が無いときは null を返す", () => {
    expect(medians([])).toBeNull();
  });
});

describe("judge", () => {
  it("庭を出すトップでは、lcpIsFcp の回を Performance と LCP の両方から除く", () => {
    const rows = [row(97, 1500, true), row(91, 2800), row(92, 2820), row(93, 2840), row(92, 2830)];
    expect(judge(rows, "second")).toStrictEqual({
      excludedRuns: 1,
      keptRuns: 4,
      median: { score: 92, fcp: 1500, lcp: 2825, tbt: 180, si: 1500, cls: 0 },
    });
  });

  it("庭を出さないトップでは、lcpIsFcp の回を除かない", () => {
    const rows = [row(100, 1500, true), row(98, 1510, true), row(100, 1505, true)];
    expect(judge(rows, "reduced-motion")).toMatchObject({
      excludedRuns: 0,
      keptRuns: 3,
      median: { score: 100, lcp: 1505 },
    });
  });

  it("全ての回を除いたときは、中央値を null にする", () => {
    expect(judge([row(62, 1500, true), row(58, 2290, true)], "second")).toStrictEqual({
      excludedRuns: 2,
      keptRuns: 0,
      median: null,
    });
  });
});
