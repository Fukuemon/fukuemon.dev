export type ContentType = "article" | "hands-on";

export type MetaItem = { label: string; value: string };

/** 手を動かす場所。ページに何を置くかが変わる */
export type InteractiveLevel = "embedded" | "local";

/** 一覧が種別ごとの分岐を持たないための正規化表現 */
export type ContentRef = {
  contentId: string;
  type: ContentType;
  /** ハンズオンのみ。導線の文言を level から出すために持つ */
  level?: InteractiveLevel;
  title: string;
  description: string;
  href: string;
  tags: string[];
  date: Date;
  meta: MetaItem[];
};

export type ContentGraph = {
  byId: ReadonlyMap<string, ContentRef>;
  /** contentId → 関連する contentId。片方向の記述から双方向に導出済み */
  relatedOf: ReadonlyMap<string, readonly string[]>;
};
