import { describe, expect, it } from "vitest";
import {
  type Conditions,
  isAdrConditions,
  judge,
  medians,
  needsRemeasure,
  type Row,
} from "./lighthouse-judge.ts";

const row = (score: number, lcp: number, lcpIsFcp = false): Row => ({
  score,
  fcp: 1500,
  lcp,
  tbt: 180,
  si: 1500,
  cls: 0,
  lcpIsFcp,
});
const fixed = { fcp: 1500, tbt: 180, si: 1500, cls: 0 };

describe("medians", () => {
  it("奇数の回は、中央の値を返す", () => {
    expect(medians([row(93, 2900), row(91, 2800), row(92, 2850)])).toStrictEqual({
      score: 92,
      lcp: 2850,
      ...fixed,
    });
  });

  it("偶数の回は、中央の 2 つの値の平均を返す", () => {
    expect(medians([row(91, 2800), row(92, 2820), row(93, 2840), row(94, 2900)])).toStrictEqual({
      score: 92.5,
      lcp: 2830,
      ...fixed,
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
      median: { score: 92, lcp: 2825, ...fixed },
    });
  });

  it("庭を出さないトップでは、lcpIsFcp の回を除かない", () => {
    const rows = [row(100, 1500, true), row(98, 1510, true), row(100, 1505, true)];
    expect(judge(rows, "reduced-motion")).toStrictEqual({
      excludedRuns: 0,
      keptRuns: 3,
      median: { score: 100, lcp: 1505, ...fixed },
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

const adr: Conditions = { visit: "second", gpu: "metal", throttling: "simulate", runs: 5 };

describe("isAdrConditions", () => {
  it("庭を出すトップと庭を出さないトップの、ADR-0078 の条件で true を返す", () => {
    expect(isAdrConditions(adr)).toBe(true);
    expect(isAdrConditions({ ...adr, visit: "reduced-motion" })).toBe(true);
  });

  it.each([{ visit: "first" }, { gpu: "swiftshader" }, { throttling: "devtools" }, { runs: 3 }])(
    "条件が 1 つ違うとき（%o）は false を返す",
    (diff) => {
      expect(isAdrConditions({ ...adr, ...diff })).toBe(false);
    },
  );
});

describe("needsRemeasure", () => {
  const judged = (excludedRuns: number) => ({
    excludedRuns,
    keptRuns: 5 - excludedRuns,
    median: null,
  });

  it("ADR-0078 の条件で、除いた回が 3 回以上なら true を返す", () => {
    expect(needsRemeasure(adr, judged(3))).toBe(true);
  });

  it("除いた回が 2 回なら false を返す", () => {
    expect(needsRemeasure(adr, judged(2))).toBe(false);
  });

  it("ADR-0078 の条件でない計測では、除いた回が 3 回以上でも false を返す", () => {
    expect(needsRemeasure({ ...adr, gpu: "swiftshader" }, judged(5))).toBe(false);
  });
});
