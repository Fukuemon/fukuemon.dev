import { seasonOf, timeOfDayOf, type Season, type SeasonTime, type TimeOfDay } from "./season";
import { takeFirstVisit, type SeenStore } from "./visit";
import { INTRO_PARAM, SETTINGS_CHANGE } from "../../../components/site-settings/settings";

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
  /** 設定の面の「イントロをもう一度見る」から開いた。inline script では、URL の引数 `intro` があるか */
  readonly introAgain: boolean;
  readonly storage: () => SeenStore;
  /** 場面のバンドルを読み込む。失敗したら、渡した関数を呼ぶ。バンドルが無いときは null */
  readonly load: ((onError: () => void) => void) | null;
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
 * 庭の表示の設定（`data-garden`）が `off` のときと、場面のバンドルが無いときは、庭を出さない。記録は、庭を出すかに関わらず書く。
 * 庭を出すときは class `stage-on` を付けて、場面のバンドルを読み込む。
 * 最初の訪問か、「イントロをもう一度見る」から開いたときは、アニメーションの設定（`data-motion`）が `off` でなければ class `intro` も付ける。
 * 設定の属性は、全てのページの `head` の inline script（`components/site-settings/settings.ts`）が先に書いている。
 * 読み込みに失敗したときと、6 秒の後に場面の準備（class `scene-ready`）ができていないときは、2 つの class を外し、ふつうのページに戻す。記録は戻さない。
 * 通信が応答を返さずに止まると、読み込みの失敗が届かないので、6 秒で打ち切る。
 *
 * `head` の inline script に文字列にして埋め込むので、この関数の外の名前を参照しない。
 */
export function applyStage(env: StageEnv, fns: StageFns): void {
  const root = env.root;
  root.dataset.season = env.override.season ?? fns.seasonOf(env.now);
  root.dataset.time = env.override.time ?? fns.timeOfDayOf(env.now);
  const first = fns.takeFirstVisit(env.storage);
  if (root.dataset.garden === "off" || !env.load) return;
  root.classList.add("stage-on");
  if ((first || env.introAgain) && root.dataset.motion !== "off") root.classList.add("intro");
  const plain = () => root.classList.remove("stage-on", "intro");
  env.load(plain);
  env.later(() => {
    if (!root.classList.contains("scene-ready")) plain();
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
 * URL の引数 `intro` は、読んだ後に URL から消す。読み込み直したときに、イントロをまた流さないためである。
 * 庭を出していないトップで、歯車の設定の庭の表示をオンにしたときは、読み込み直して庭を出す。庭を出すかは、描く前のこのスクリプトが決めるためである。
 */
export function stageScript({ dev, bundle }: { dev: boolean; bundle?: string }): string {
  const override = dev ? `(${readOverride.toString()})(location.search)` : "{}";
  const load = bundle
    ? `function(e){var s=document.createElement("script");s.type="module";s.src=${JSON.stringify(bundle).replace(/</g, "\\u003c")};s.onerror=e;document.head.appendChild(s)}`
    : "null";
  return (
    `(function(){var q=new URLSearchParams(location.search),p=${JSON.stringify(INTRO_PARAM)},introAgain=q.has(p);` +
    `(${applyStage.toString()})({root:document.documentElement,now:new Date,override:${override},` +
    `introAgain:introAgain,storage:function(){return localStorage},load:${load},later:function(f,m){setTimeout(f,m)}},` +
    `{seasonOf:${seasonOf.toString()},timeOfDayOf:${timeOfDayOf.toString()},takeFirstVisit:${takeFirstVisit.toString()}});` +
    `if(introAgain){var u=new URL(location.href);u.searchParams.delete(p);history.replaceState(history.state,"",u)}` +
    `var root=document.documentElement;root.addEventListener(${JSON.stringify(SETTINGS_CHANGE)},function(e){if(e.detail.name==="garden"&&e.detail.on&&!root.classList.contains("stage-on"))location.reload()})})()`
  );
}
