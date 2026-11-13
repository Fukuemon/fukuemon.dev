export type Season = "spring" | "summer" | "autumn" | "winter";
export type TimeOfDay = "morning" | "day" | "evening" | "night";

const SEASONS: readonly Season[] = ["winter", "spring", "summer", "autumn"];

/** 端末の日付の月で季節を返す。3〜5 月が春、6〜8 月が夏、9〜11 月が秋、12〜2 月が冬である。 */
export function seasonOf(date: Date): Season {
  return SEASONS[Math.floor(((date.getMonth() + 1) % 12) / 3)]!;
}

/** 端末の時刻で時間帯を返す。境目の時刻は、後ろの時間帯に入る。 */
export function timeOf(date: Date): TimeOfDay {
  const h = date.getHours();
  if (h < 5) return "night";
  if (h < 10) return "morning";
  if (h < 16) return "day";
  if (h < 19) return "evening";
  return "night";
}
