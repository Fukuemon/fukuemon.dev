import { useSyncExternalStore } from "react";

/**
 * コードを動かす画面の配置（docs/adr/0072-short-landscape-layout-in-playground.md）。
 * `wide` はペインを並べる PC の配置、`narrow` は下のタブの配置、`short` は左の縦のタブの配置である。
 */
export type LayoutMode = "wide" | "narrow" | "short";

// テーマ変数の md（48rem）と、custom variant の short（高さ 500px 未満）にそろえる
const SHORT_QUERY = "(max-height: 499.98px)";
const NARROW_QUERY = "(max-width: 47.98rem)";

function subscribe(onChange: () => void) {
  const queries = [SHORT_QUERY, NARROW_QUERY].map((query) => window.matchMedia(query));
  for (const query of queries) query.addEventListener("change", onChange);
  return () => {
    for (const query of queries) query.removeEventListener("change", onChange);
  };
}

function snapshot(): LayoutMode {
  if (window.matchMedia(SHORT_QUERY).matches) return "short";
  if (window.matchMedia(NARROW_QUERY).matches) return "narrow";
  return "wide";
}

/** 画面の幅と高さから配置を決め、回したときや窓の大きさを変えたときに替える。 */
export function useLayoutMode(): LayoutMode {
  return useSyncExternalStore(subscribe, snapshot, () => "wide");
}
