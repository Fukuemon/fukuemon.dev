/**
 * 手順 1 つ。本文の `h2` から導く。
 * 導出は `apps/web` の remark plugin が行い、ここは型だけを持つ。
 * 数える場所を 1 箇所に保つため、同じ導出をこの package で再実装しない。
 */
export type Step = { index: number; title: string; duration?: number };
