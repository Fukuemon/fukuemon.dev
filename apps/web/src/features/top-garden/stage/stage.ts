import { seasonOf, timeOfDayOf, type Season, type SeasonTime, type TimeOfDay } from "./season";
import { takeFirstVisit, type SeenStore } from "./visit";

interface StageRoot {
  readonly dataset: DOMStringMap;
  readonly classList: Pick<DOMTokenList, "add" | "remove" | "contains">;
}

/** 端末の日付と時刻の代わりに使う、季節と時間帯 */
type StageOverride = Partial<SeasonTime>;

/** `applyStage` が読むページと端末の値。inline script では、`document` や `localStorage` から作る */
export interface StageEnv {
  readonly root: StageRoot;
  readonly now: Date;
  readonly override: StageOverride;
  readonly reducedMotion: boolean;
  readonly storage: () => SeenStore;
  /** 場面のバンドルを読み込む。失敗したら、渡した関数を呼ぶ。バンドルが無いときは null */
  readonly load: ((onError: () => void) => void) | null;
  /** 墨の絵と署名のファイルを読み込む。失敗したら、渡した関数を呼ぶ。最初の訪問のイントロを出すときだけ呼ぶ。ファイルが無いときは null */
  readonly loadInk: ((onError: () => void) => void) | null;
  /** 渡した関数を、渡したミリ秒の後に 1 回呼ぶ。inline script では `setTimeout` */
  readonly later: (fn: () => void, ms: number) => void;
}

interface StageFns {
  readonly seasonOf: typeof seasonOf;
  readonly timeOfDayOf: typeof timeOfDayOf;
  readonly takeFirstVisit: typeof takeFirstVisit;
}

/**
 * 季節と時間帯を `html` の `data-season` と `data-time` に書き、最初の訪問かを記録する。
 * 動きを減らす設定のときと、場面のバンドルが無いときは、庭を出さない。記録は、庭を出すかに関わらず書く。
 * 庭を出すときは class `stage-on` を付け、最初の訪問なら class `intro` も付けて、場面のバンドルと、墨の絵と署名のファイルを読み込む。
 * 場面のバンドルの読み込みに失敗したときと、6 秒の後に場面の準備（class `scene-ready`）ができていないときは、2 つの class を外し、ふつうのページに戻す。記録は戻さない。
 * 墨の絵と署名のファイルの読み込みに失敗したときと、6 秒の後に場面の準備ができていて墨の絵が届いていない（class `ink-ready` が無い）ときは、class `ink-failed` を付ける。場面のバンドルが読んで、ふつうのページに戻す。
 * 通信が応答を返さずに止まると、読み込みの失敗が届かないので、6 秒で打ち切る。
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
  // 墨の絵と署名のファイルが無いときは、イントロを出さず、庭だけを出す
  const ink = first && env.loadInk ? env.loadInk : null;
  if (ink) root.classList.add("intro");
  const plain = () => root.classList.remove("stage-on", "intro");
  env.load(plain);
  if (ink) ink(() => root.classList.add("ink-failed"));
  env.later(() => {
    if (!root.classList.contains("scene-ready")) plain();
    // 場面が動き出した後のクリーンアップは場面のバンドルが持つので、墨の絵が届いていないことだけを class で伝える
    else if (ink && root.classList.contains("intro") && !root.classList.contains("ink-ready"))
      root.classList.add("ink-failed");
  }, 6000);
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
 * バンドルは module の script で読み込む。開発のサーバーはバンドルを ES モジュールのまま配り、本番のビルドの IIFE は module としても動くためである。
 */
export function stageScript({
  dev,
  bundle,
  ink,
}: {
  dev: boolean;
  bundle?: string;
  ink?: string;
}): string {
  const override = dev ? `(${readOverride.toString()})(location.search)` : "{}";
  const loader = (url: string) =>
    `function(e){var s=document.createElement("script");s.type="module";s.src=${JSON.stringify(url).replace(/</g, "\\u003c")};s.onerror=e;document.head.appendChild(s)}`;
  const load = bundle ? loader(bundle) : "null";
  const loadInk = ink ? loader(ink) : "null";
  return (
    `(${applyStage.toString()})({root:document.documentElement,now:new Date,override:${override},` +
    `reducedMotion:matchMedia("(prefers-reduced-motion: reduce)").matches,storage:function(){return localStorage},load:${load},loadInk:${loadInk},later:function(f,m){setTimeout(f,m)}},` +
    `{seasonOf:${seasonOf.toString()},timeOfDayOf:${timeOfDayOf.toString()},takeFirstVisit:${takeFirstVisit.toString()}})`
  );
}
