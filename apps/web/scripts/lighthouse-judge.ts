/** トップの Lighthouse の計測（scripts/measure-top-lighthouse.mjs）の 1 回の値のうち、集計に使うもの */
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
 */
export function judge(rows: readonly Row[], visit: string) {
  const kept = visit === "reduced-motion" ? rows : rows.filter((r) => !r.lcpIsFcp);
  return {
    excludedRuns: rows.length - kept.length,
    keptRuns: kept.length,
    median: medians(kept),
  };
}
