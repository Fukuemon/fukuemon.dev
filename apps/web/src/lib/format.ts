import type { ContentRef, ContentType } from "@fukuemon/content-model";

/**
 * 種別の正本。表示名と URL の綴りをここだけで持つ。
 * 一覧・タブ・パンくず・RSS が同じ表から引く。
 */
const KINDS = {
  article: { label: "記事", slug: "articles" },
  "hands-on": { label: "ハンズオン", slug: "labs" },
} as const satisfies Record<ContentType, { label: string; slug: string }>;

export const CONTENT_TYPES = Object.keys(KINDS) as ContentType[];

/** 一覧全体。種別ではないので表の外に置く */
export const ALL_KIND = { label: "すべて", title: "一覧", href: "/blog" } as const;

/** 種別の表示名。ここ以外に日本語を置かない */
export const KIND_LABEL = Object.fromEntries(
  CONTENT_TYPES.map((t) => [t, KINDS[t].label]),
) as Record<ContentType, string>;

/** 種別ごとの一覧の URL */
export const KIND_INDEX = Object.fromEntries(
  CONTENT_TYPES.map((t) => [t, `${ALL_KIND.href}/${KINDS[t].slug}`]),
) as Record<ContentType, string>;

/** URL の綴り。`/blog/<slug>` の動的経路が使う */
export const kindSlug = (type: ContentType): string => KINDS[type].slug;

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
