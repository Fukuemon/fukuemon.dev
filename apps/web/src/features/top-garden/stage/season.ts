// 2 つの関数は、`head` の inline script に文字列にして埋め込む。
// 文字列にして運ぶので、関数の外の名前を参照しない。
// 場面と island は関数を呼び直さず、`html` の `data-season` と `data-time` を読む。

import type { PickValue } from "../../../components/site-settings/settings";

/** 季節。値の一覧は、表示の設定（`components/site-settings/settings.ts`）が持つ */
export type Season = Exclude<PickValue<"season">, "auto">;
/** 時間帯。値の一覧は、表示の設定が持つ */
export type TimeOfDay = Exclude<PickValue<"time">, "auto">;

/** 場面の季節と時間帯 */
export interface SeasonTime {
  readonly season: Season;
  readonly time: TimeOfDay;
}

/** 端末の日付の月で季節を返す。3〜5 月が春、6〜8 月が夏、9〜11 月が秋、12〜2 月が冬である。 */
export function seasonOf(date: Date): Season {
  const seasons: readonly Season[] = ["winter", "spring", "summer", "autumn"];
  return seasons[Math.floor(((date.getMonth() + 1) % 12) / 3)];
}

/** 端末の時刻で時間帯を返す。境目の時刻は、後ろの時間帯に入る。 */
export function timeOfDayOf(date: Date): TimeOfDay {
  const h = date.getHours();
  if (h < 5) return "night";
  if (h < 10) return "morning";
  if (h < 16) return "day";
  if (h < 19) return "evening";
  return "night";
}
