/** 導出は apps/web の remark plugin が行う。数える場所を 1 箇所に保つため再実装しない */
export type Step = { index: number; title: string; duration?: number };
