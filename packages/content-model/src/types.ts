import type { ArticleFormat } from "./schema.js";

/** 一覧が記事の形式ごとの分岐を持たないための正規化表現 */
export type ContentRef = {
  contentId: string;
  format: ArticleFormat;
  /** シリーズに入る記事のみ。`articles/` の直下のディレクトリ名 */
  series?: string;
  title: string;
  description: string;
  href: string;
  tags: string[];
  date: Date;
};

export type ContentGraph = {
  byId: ReadonlyMap<string, ContentRef>;
  /** contentId → 関連する contentId。片方向の記述から双方向に導出済み */
  relatedOf: ReadonlyMap<string, readonly string[]>;
};
