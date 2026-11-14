// 最初の訪問のイントロの時刻。墨の絵の CSS（ink/InkGate.astro）と、場面のバンドル（scene/）の両方が読む。
// 値は top-garden の Design Doc の「イントロの各段の時間」で、試作の値である。

/** 開いてから、墨の線を描き始めるまで（ms）。この間に署名を書き始める */
export const SIGN_LEAD = 600;

/**
 * 色を差し始めてからの各段の時刻と長さ（ms）。
 * tint0 と move0 は始める時刻、tint と move はその長さ、cards は文を出す時刻、done はカメラが止まる時刻である。
 */
export const INTRO = {
  tint0: 300,
  tint: 1200,
  move0: 1300,
  move: 2800,
  cards: 3700,
  done: 4500,
} as const;
