// 2 つの関数は、`head` の inline script に文字列にして埋め込む。
// 文字列にして運ぶので、関数の外の名前を参照しない。型は、埋め込むときに消える。

import type { Season, TimeOfDay } from "./season";

type SeenStore = Pick<Storage, "getItem" | "setItem">;

interface StageRoot {
  readonly dataset: DOMStringMap;
  readonly classList: Pick<DOMTokenList, "add" | "remove">;
}

export interface StageOverride {
  readonly season?: Season;
  readonly time?: TimeOfDay;
}

export interface StageEnv {
  readonly root: StageRoot;
  readonly now: Date;
  readonly override: StageOverride;
  readonly reducedMotion: boolean;
  readonly storage: () => SeenStore;
  /** 場面の束を読み込む。失敗したら、渡した関数を呼ぶ。束が無いときは null */
  readonly load: ((onError: () => void) => void) | null;
}

export interface StageFns {
  readonly seasonOf: (date: Date) => Season;
  readonly timeOfDayOf: (date: Date) => TimeOfDay;
  readonly takeFirstVisit: (storage: () => SeenStore) => boolean;
}

/**
 * 季節と時間帯を `html` の `data-season` と `data-time` に書き、最初の訪問かを記録する。
 * 動きを減らす設定のときと、場面の束が無いときは、庭を出さない。
 * 庭を出すときは class `stage-on` を付け、最初の訪問なら class `intro` も付けて、場面の束を読み込む。
 * 読み込みに失敗したら、2 つの class を外し、ふつうのページに戻す。
 */
export function applyStage(env: StageEnv, fns: StageFns): void {
  const root = env.root;
  root.dataset.season = env.override.season ?? fns.seasonOf(env.now);
  root.dataset.time = env.override.time ?? fns.timeOfDayOf(env.now);
  const first = fns.takeFirstVisit(env.storage);
  if (env.reducedMotion || !env.load) return;
  root.classList.add("stage-on");
  if (first) root.classList.add("intro");
  env.load(() => root.classList.remove("stage-on", "intro"));
}

/**
 * URL の引数 `season` と `time` から、端末の日付と時刻の代わりに使う値を読む。
 * 開発のビルドの inline script にだけ埋め込む。決めた値のほかは無視する。
 */
export function readOverride(search: string): StageOverride {
  const q = new URLSearchParams(search);
  const season = q.get("season");
  const time = q.get("time");
  const seasons = ["spring", "summer", "autumn", "winter"];
  const times = ["morning", "day", "evening", "night"];
  return {
    ...(season !== null && seasons.includes(season) ? { season: season as Season } : {}),
    ...(time !== null && times.includes(time) ? { time: time as TimeOfDay } : {}),
  };
}
