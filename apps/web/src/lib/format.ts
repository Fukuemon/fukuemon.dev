import type { ContentRef, ContentType } from "@fukuemon/content-model";

/** 種別の表示名。ここ以外に日本語を置かない */
export const KIND_LABEL: Record<ContentType, string> = {
  article: "記事",
  "hands-on": "ハンズオン",
};

/** 種別ごとの一覧の URL */
export const KIND_INDEX: Record<ContentType, string> = {
  article: "/blog/articles",
  "hands-on": "/blog/labs",
};

/** 一覧と本文で同じ形にする */
export function ymd(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, ".");
}

export function kindClass(type: ContentType): string {
  return type === "hands-on" ? "kind--lab" : "kind--article";
}

/** 実行環境の表示名。ハンズオンの frontmatter の runtime から引く */
/** 一覧の「種類」列。絞り込み中は種別名を落とす */
export function kindLine(ref: ContentRef, withKind: boolean): string {
  const parts = withKind ? [KIND_LABEL[ref.type]] : [];
  return [...parts, ...ref.meta.map((m) => m.value)].join(" · ");
}
