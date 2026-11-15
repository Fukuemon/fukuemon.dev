/** オンとオフで切り替える設定の名前。`html` の `data-<名前>` と、`localStorage` の `fd-<名前>` に書く */
export type SettingName = "motion" | "garden";

/** 値を 1 つ選ぶ設定の名前。`html` の `data-<名前>-setting` と、`localStorage` の `fd-<名前>` に書く */
export type PickName = "season" | "time";

/** 選ぶ設定の値。`auto` は、端末の日付と時刻で決める。トップの庭の季節と時間帯の型は、この型から作る */
export type PickValue<N extends PickName> =
  | (N extends "season"
      ? "spring" | "summer" | "autumn" | "winter"
      : "morning" | "day" | "evening" | "night")
  | "auto";

/** 選ぶ設定ごとの、選べる値と画面の名前。並びは画面の帯の順である */
export const PICK_CHOICES = {
  season: [
    { value: "auto", label: "自動" },
    { value: "spring", label: "春" },
    { value: "summer", label: "夏" },
    { value: "autumn", label: "秋" },
    { value: "winter", label: "冬" },
  ],
  time: [
    { value: "auto", label: "自動" },
    { value: "morning", label: "朝" },
    { value: "day", label: "昼" },
    { value: "evening", label: "夕" },
    { value: "night", label: "夜" },
  ],
} as const satisfies { [N in PickName]: readonly { value: PickValue<N>; label: string }[] };

type SettingStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

interface SettingsRoot {
  readonly dataset: DOMStringMap;
}

/** 設定を書き換えたときに `html` の要素へ送るイベントの名前。トップの庭の場面と、トップの `head` の inline script が受ける */
export const SETTINGS_CHANGE = "fd-settings-change";

/** 設定の面の要素の id。歯車のボタンの `popovertarget` が指す */
export const SITE_SETTINGS_ID = "site-settings";

/** 設定の面の「イントロをもう一度見る」が、トップを開く URL に付ける引数の名前 */
export const INTRO_PARAM = "intro";

export type SettingsChange =
  | { readonly name: SettingName; readonly on: boolean }
  | { readonly [N in PickName]: { readonly name: N; readonly value: PickValue<N> } }[PickName];

/** 設定の面のボタンの `data-value` を、選べる値に絞る。選べる値のほかは `undefined` を返す */
export function pickValueOf<N extends PickName>(
  name: N,
  value: string | undefined,
): PickValue<N> | undefined {
  const choices = PICK_CHOICES[name] as readonly { readonly value: PickValue<N> }[];
  return choices.find((c) => c.value === value)?.value;
}

/**
 * 保存した設定を読み、`html` に書く。
 * オンとオフの設定は `data-motion` と `data-garden` に `on` か `off` を書く。保存していないときは、OS の動きを減らす設定なら `off`、ほかは `on` にする。
 * 季節と時間帯は `data-season-setting` と `data-time-setting` に、選んだ値か `auto` を書く。保存していないときと、決めた値のほかは `auto` にする。
 * `localStorage` に触れるだけで例外を投げるブラウザがあるので、取り出す関数で受け取り、読めないときは保存していない扱いにする。
 *
 * 全てのページの `head` の inline script に文字列にして埋め込むので、この関数の外の名前を参照しない。
 */
export function applySettings(
  root: SettingsRoot,
  storage: () => Pick<Storage, "getItem">,
  reducedMotion: boolean,
): void {
  const read = (key: string): string | null => {
    try {
      return storage().getItem(key);
    } catch {
      return null;
    }
  };
  const switches: readonly SettingName[] = ["motion", "garden"];
  for (const name of switches) {
    const saved = read(`fd-${name}`);
    root.dataset[name] = saved === "on" || saved === "off" ? saved : reducedMotion ? "off" : "on";
  }
  const allowed: { readonly [N in PickName]: readonly Exclude<PickValue<N>, "auto">[] } = {
    season: ["spring", "summer", "autumn", "winter"],
    time: ["morning", "day", "evening", "night"],
  };
  for (const name of ["season", "time"] as const) {
    const saved = read(`fd-${name}`);
    root.dataset[`${name}Setting`] =
      saved !== null && (allowed[name] as readonly string[]).includes(saved) ? saved : "auto";
  }
}

/** 全てのページの `head` に置く inline script の中身を作る。描く前に設定を `html` に書く */
export function settingsScript(): string {
  return `(${applySettings.toString()})(document.documentElement,function(){return localStorage},matchMedia("(prefers-reduced-motion: reduce)").matches)`;
}

/**
 * 設定を `html` に書き、`localStorage` に保存し、`html` の要素に {@link SETTINGS_CHANGE} を送る。
 * 季節と時間帯を `auto` に戻したときは、保存した値を消す。
 * 保存できない端末でも、開いているページには当てる。
 */
export function changeSetting(
  root: SettingsRoot & Pick<EventTarget, "dispatchEvent">,
  storage: () => SettingStore,
  change: SettingsChange,
): void {
  const key = `fd-${change.name}`;
  const value = "on" in change ? (change.on ? "on" : "off") : change.value;
  if ("on" in change) root.dataset[change.name] = value;
  else root.dataset[`${change.name}Setting`] = value;
  try {
    if (value === "auto") storage().removeItem(key);
    else storage().setItem(key, value);
  } catch {
    // 保存できない端末では、開いているページにだけ当てる。
  }
  root.dispatchEvent(new CustomEvent<SettingsChange>(SETTINGS_CHANGE, { detail: change }));
}
