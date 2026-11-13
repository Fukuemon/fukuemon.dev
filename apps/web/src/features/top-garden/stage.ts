import { seasonOf, timeOfDayOf, type Season, type TimeOfDay } from "./season";
import { takeFirstVisit, type SeenStore } from "./visit";

interface StageRoot {
  readonly dataset: DOMStringMap;
  readonly classList: Pick<DOMTokenList, "add" | "remove">;
}

/** 端末の日付と時刻の代わりに使う、季節と時間帯 */
interface StageOverride {
  readonly season?: Season;
  readonly time?: TimeOfDay;
}

/** `applyStage` が読むページと端末の値。inline script では、`document` や `localStorage` から作る */
export interface StageEnv {
  readonly root: StageRoot;
  readonly now: Date;
  readonly override: StageOverride;
  readonly reducedMotion: boolean;
  readonly storage: () => SeenStore;
  /** 場面の束を読み込む。失敗したら、渡した関数を呼ぶ。束が無いときは null */
  readonly load: ((onError: () => void) => void) | null;
}

interface StageFns {
  readonly seasonOf: typeof seasonOf;
  readonly timeOfDayOf: typeof timeOfDayOf;
  readonly takeFirstVisit: typeof takeFirstVisit;
}

/**
 * 季節と時間帯を `html` の `data-season` と `data-time` に書き、最初の訪問かを記録する。
 * 動きを減らす設定のときと、場面の束が無いときは、庭を出さない。記録は、庭を出すかに関わらず書く。
 * 庭を出すときは class `stage-on` を付け、最初の訪問なら class `intro` も付けて、場面の束を読み込む。
 * 読み込みに失敗したら、2 つの class を外し、ふつうのページに戻す。記録は戻さない。
 *
 * `head` の inline script に文字列にして埋め込むので、この関数の外の名前を参照しない。
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
 * URL の引数 `season` と `time` から、端末の日付と時刻の代わりに使う値を読む。決めた値のほかは無視する。
 *
 * 開発のビルドの inline script にだけ文字列にして埋め込むので、この関数の外の名前を参照しない。
 */
export function readOverride(search: string): StageOverride {
  const q = new URLSearchParams(search);
  const seasons: readonly Season[] = ["spring", "summer", "autumn", "winter"];
  const times: readonly TimeOfDay[] = ["morning", "day", "evening", "night"];
  const season = seasons.find((v) => v === q.get("season"));
  const time = times.find((v) => v === q.get("time"));
  return { ...(season ? { season } : {}), ...(time ? { time } : {}) };
}

/**
 * トップの `head` に置く inline script の中身を作る。
 * `dev` が true のときだけ、URL の引数を読む処理を入れる。`bundle` を渡さないときは、庭を出さない。
 */
export function stageScript({ dev, bundle }: { dev: boolean; bundle?: string }): string {
  const override = dev ? `(${readOverride.toString()})(location.search)` : "{}";
  const load = bundle
    ? `function(e){var s=document.createElement("script");s.src=${JSON.stringify(bundle).replace(/</g, "\\u003c")};s.defer=true;s.onerror=e;document.head.appendChild(s)}`
    : "null";
  return (
    `(${applyStage.toString()})({root:document.documentElement,now:new Date,override:${override},` +
    `reducedMotion:matchMedia("(prefers-reduced-motion: reduce)").matches,storage:function(){return localStorage},load:${load}},` +
    `{seasonOf:${seasonOf.toString()},timeOfDayOf:${timeOfDayOf.toString()},takeFirstVisit:${takeFirstVisit.toString()}})`
  );
}
