// 墨の絵と立体の場面の両方が使う乱数。同じ種からは、どちらでも同じ順の値が出る。

export type Rng = () => number;

/** 種から、0 以上 1 未満の値を決まった順に返す乱数（mulberry32）を作る。 */
export function rng(seed: number): Rng {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
