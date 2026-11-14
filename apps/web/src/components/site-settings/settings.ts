/** 訪問者がヘッダーの歯車から変える設定の名前。`html` の `data-<名前>` と、`localStorage` の `fd-<名前>` に書く */
export type SettingName = "motion" | "garden";

type SettingStore = Pick<Storage, "getItem" | "setItem">;

interface SettingsRoot {
  readonly dataset: DOMStringMap;
}

/** 設定を書き換えたときに `html` の要素へ送るイベントの名前。トップの庭の場面が受ける */
export const SETTINGS_CHANGE = "fd-settings-change";

/** 設定の面の要素の id。歯車のボタンの `popovertarget` が指す */
export const SITE_SETTINGS_ID = "site-settings";

/** 設定の面の「イントロをもう一度見る」が、トップを開く URL に付ける引数の名前 */
export const INTRO_PARAM = "intro";

export interface SettingsChange {
  readonly name: SettingName;
  readonly on: boolean;
}

/**
 * 保存した設定を読み、`html` の `data-motion` と `data-garden` に `on` か `off` を書く。
 * 保存していない設定は、OS の動きを減らす設定のときに `off`、ほかは `on` にする。
 * `localStorage` に触れるだけで例外を投げるブラウザがあるので、取り出す関数で受け取り、読めないときは保存していない扱いにする。
 *
 * 全てのページの `head` の inline script に文字列にして埋め込むので、この関数の外の名前を参照しない。
 */
export function applySettings(
  root: SettingsRoot,
  storage: () => SettingStore,
  reducedMotion: boolean,
): void {
  const names: readonly SettingName[] = ["motion", "garden"];
  for (const name of names) {
    let saved: string | null = null;
    try {
      saved = storage().getItem(`fd-${name}`);
    } catch {
      saved = null;
    }
    root.dataset[name] = saved === "on" || saved === "off" ? saved : reducedMotion ? "off" : "on";
  }
}

/** 全てのページの `head` に置く inline script の中身を作る。描く前に設定を `html` に書く */
export function settingsScript(): string {
  return `(${applySettings.toString()})(document.documentElement,function(){return localStorage},matchMedia("(prefers-reduced-motion: reduce)").matches)`;
}

/**
 * 設定を `html` に書き、`localStorage` に保存し、`html` の要素に {@link SETTINGS_CHANGE} を送る。
 * 保存できない端末でも、開いているページには当てる。
 */
export function changeSetting(
  root: SettingsRoot & Pick<EventTarget, "dispatchEvent">,
  storage: () => SettingStore,
  change: SettingsChange,
): void {
  const value = change.on ? "on" : "off";
  root.dataset[change.name] = value;
  try {
    storage().setItem(`fd-${change.name}`, value);
  } catch {
    // 保存できない端末では、開いているページにだけ当てる。
  }
  root.dispatchEvent(new CustomEvent<SettingsChange>(SETTINGS_CHANGE, { detail: change }));
}
