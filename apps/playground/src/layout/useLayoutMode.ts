import { useSyncExternalStore } from "react";

/**
 * コードを動かす画面の配置（docs/adr/0072-short-landscape-layout-in-playground.md）。
 * `wide` はペインを並べる PC の配置、`narrow` は下のタブの配置、`short` は左の縦のタブの配置である。
 */
export type LayoutMode = "wide" | "narrow" | "short";

// テーマ変数の md（48rem）と、custom variant の short（高さ 500px 未満）にそろえる
const SHORT_QUERY = "(max-height: 499.98px)";
const NARROW_QUERY = "(max-width: 47.98rem)";

/** 配置を決める 2 つの media query の変化を購読し、解除の関数を返す。 */
export function subscribeLayoutMode(onChange: () => void) {
  const queries = [SHORT_QUERY, NARROW_QUERY].map((query) => window.matchMedia(query));
  for (const query of queries) query.addEventListener("change", onChange);
  return () => {
    for (const query of queries) query.removeEventListener("change", onChange);
  };
}

/** 今の画面の配置を返す。高さの条件を幅より先に見る。横に向けたスマートフォンは幅が 48rem を超えるためである（ADR-0072）。 */
export function currentLayoutMode(): LayoutMode {
  if (window.matchMedia(SHORT_QUERY).matches) return "short";
  if (window.matchMedia(NARROW_QUERY).matches) return "narrow";
  return "wide";
}

/** 画面の幅と高さから配置を決め、回したときや窓の大きさを変えたときに替える。 */
export function useLayoutMode(): LayoutMode {
  return useSyncExternalStore(subscribeLayoutMode, currentLayoutMode, () => "wide");
}
