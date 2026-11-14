// 最初の訪問のイントロの時刻。墨の絵の CSS（ink/InkGate.astro）と、場面のバンドル（scene/）の両方が読む。
// 値は top-garden の Design Doc の「イントロの各段の時間」で、INK_END のほかは試作の値である。

/** 開いてから、墨の線を描き始めるまで（ms）。この間に署名を書き始める */
export const SIGN_LEAD = 600;

/**
 * 開いてから、署名と墨の絵を描き終えるまで（ms）。墨の線の遷移が取れないときも、これより前には色を差さない。
 * 5000 は、木の線を足した墨の絵の最後の線を描き終える時刻を、0.3 秒以内で切り上げた値である（ink/ink-art.test.ts が確かめる）
 */
export const INK_END = SIGN_LEAD + 5000;

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
