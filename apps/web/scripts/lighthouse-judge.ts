/** Lighthouse の計測（scripts/measure-top-lighthouse.mjs。既定はトップで、--path でほかのページ）の 1 回の値のうち、集計に使うもの */
export type Row = {
  score: number;
  fcp: number;
  lcp: number;
  tbt: number;
  si: number;
  cls: number;
  lcpIsFcp: boolean;
};

const KEYS = ["score", "fcp", "lcp", "tbt", "si", "cls"] as const;
type Medians = Record<(typeof KEYS)[number], number>;
type Judged = { excludedRuns: number; keptRuns: number; median: Medians | null };

/** 計測の引数のうち、ADR-0078 の合否の条件に関わるもの */
export type Conditions = { visit: string; gpu: string; throttling: string; runs: number };

/** ADR-0078 で合否に使う回数と、測り直す除いた回の数 */
const JUDGED_RUNS = 5;
const REMEASURE_AT = 3;

/**
 * ADR-0078 の合否の条件で測ったか。条件は Metal、simulate、5 回で、
 * 庭を出すトップは 2 回目以降の訪問（second）、庭を出さないトップは reduced-motion で測る
 */
export function isAdrConditions(c: Conditions): boolean {
  return (
    (c.visit === "second" || c.visit === "reduced-motion") &&
    c.gpu === "metal" &&
    c.throttling === "simulate" &&
    c.runs === JUDGED_RUNS
  );
}

/** ADR-0078 の規則で、5 回を測り直すか。ADR-0078 の条件で測り、lcpIsFcp の回を 3 回以上除いたときに true */
export function needsRemeasure(c: Conditions, judged: Judged): boolean {
  return isAdrConditions(c) && judged.excludedRuns >= REMEASURE_AT;
}

/** 指標ごとの中央値。偶数の回は中央の 2 つの値の平均にする。回が無いときは null */
export function medians(rows: readonly Row[]): Medians | null {
  if (rows.length === 0) return null;
  const entries = KEYS.map((k) => {
    const v = rows.map((r) => r[k]).sort((x, y) => x - y);
    const m = Math.floor(v.length / 2);
    return [k, v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2];
  });
  return Object.fromEntries(entries) as Medians;
}

/**
 * 合否の判定に使う回と中央値（docs/adr/0078-top-lighthouse-gpu-and-throttling.md）。
 * 庭を出すトップでは lcpIsFcp の回を除く。
 * 庭を出さないトップ（reduced-motion）は、本文の描画が LCP になり、どの回も lcpIsFcp になるので除かない。
 * トップ以外のページ（path が `/` 以外）も、庭が無く、どの回も lcpIsFcp になるので除かない（ADR-0082）。
 */
export function judge(rows: readonly Row[], visit: string, path = "/"): Judged {
  const kept = visit === "reduced-motion" || path !== "/" ? rows : rows.filter((r) => !r.lcpIsFcp);
  return {
    excludedRuns: rows.length - kept.length,
    keptRuns: kept.length,
    median: medians(kept),
  };
}
