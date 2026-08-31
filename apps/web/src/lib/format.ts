import type { ContentRef, ContentType } from "@fukuemon/content-model";

/** 種別の正本。一覧・タブ・パンくず・RSS が同じ表から引く */
const KINDS = {
  article: { label: "記事", slug: "articles" },
  "hands-on": { label: "ハンズオン", slug: "labs" },
} as const satisfies Record<ContentType, { label: string; slug: string }>;

export const CONTENT_TYPES = Object.keys(KINDS) as ContentType[];

/** 種別ではないので表の外に置く */
export const ALL_KIND = { label: "すべて", title: "一覧", href: "/blog" } as const;

export const KIND_LABEL = Object.fromEntries(
  CONTENT_TYPES.map((t) => [t, KINDS[t].label]),
) as Record<ContentType, string>;

export const KIND_INDEX = Object.fromEntries(
  CONTENT_TYPES.map((t) => [t, `${ALL_KIND.href}/${KINDS[t].slug}`]),
) as Record<ContentType, string>;

export const kindSlug = (type: ContentType): string => KINDS[type].slug;

export function ymd(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, ".");
}

export function kindClass(type: ContentType): string {
  return type === "hands-on" ? "kind--lab" : "kind--article";
}

/** 絞り込み中は種別名を省く */
export function kindLine(ref: ContentRef, withKind: boolean): string {
  const parts = withKind ? [KIND_LABEL[ref.type]] : [];
  return [...parts, ...ref.meta.map((m) => m.value)].join(" · ");
}
