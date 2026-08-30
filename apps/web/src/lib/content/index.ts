import { getCollection, render, type CollectionEntry } from "astro:content";
import {
  buildContentGraph,
  type ContentGraph,
  type ContentRef,
  type ContentType,
} from "@fukuemon/content-model";

type ArticleEntry = CollectionEntry<"articles">;
type LabEntry = CollectionEntry<"labs">;
type PlaygroundEntry = CollectionEntry<"playgrounds">;
type Entry = ArticleEntry | LabEntry;

const HREF: Record<ContentType, string> = { article: "/articles", "hands-on": "/labs" };

/** 下書きは dev でだけ見える。一覧とページ生成で同じ判定を使う */
export const isPublic = (e: { data: { status: string } }) =>
  import.meta.env.DEV || e.data.status === "published";

function toRef(entry: Entry, type: ContentType): ContentRef {
  const d = entry.data;
  const meta =
    type === "hands-on" && "duration" in d ? [{ label: "所要", value: `${d.duration}分` }] : [];
  const level = "interactive" in d && d.interactive ? d.interactive.level : undefined;
  return {
    contentId: d.contentId,
    type,
    level,
    title: d.title,
    description: d.description,
    href: `${HREF[type]}/${entry.id}`,
    tags: d.tags,
    date: d.publishedAt,
    meta,
  };
}

/**
 * グラフは下書きも含めて組む。
 * 除外してから組むと、下書きを指す `related` が「存在しません」で落ちる。
 * 実際には存在しており、公開されていないだけなので、表示の側で落とす。
 */
async function load(): Promise<{
  entries: { ref: ContentRef; related: string[] }[];
  publicIds: Set<string>;
}> {
  const [articles, labs] = await Promise.all([getCollection("articles"), getCollection("labs")]);
  const all = [
    ...articles.map((e) => ({ e, ref: toRef(e, "article") })),
    ...labs.map((e) => ({ e, ref: toRef(e, "hands-on") })),
  ];
  return {
    entries: all.map(({ e, ref }) => ({ ref, related: e.data.related })),
    publicIds: new Set(all.filter(({ e }) => isPublic(e)).map(({ ref }) => ref.contentId)),
  };
}

let cache: { graph: ContentGraph; publicIds: Set<string> } | undefined;

async function get(): Promise<{ graph: ContentGraph; publicIds: Set<string> }> {
  if (!cache) {
    const { entries, publicIds } = await load();
    cache = { graph: buildContentGraph(entries), publicIds };
  }
  return cache;
}

export async function listContent(filter?: { type?: ContentType }): Promise<ContentRef[]> {
  const { graph, publicIds } = await get();
  return [...graph.byId.values()]
    .filter((r) => publicIds.has(r.contentId))
    .filter((r) => !filter?.type || r.type === filter.type)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

export async function getContent(contentId: string): Promise<ContentRef | undefined> {
  const { graph, publicIds } = await get();
  return publicIds.has(contentId) ? graph.byId.get(contentId) : undefined;
}

/**
 * ページから `astro:content` を直接触らせないための入口。
 * Astro の版が変わったとき、直す場所をこのファイルに閉じ込める
 * (`context/architecture.md` 規約 1)。
 */
export const listArticleEntries = (filter?: (e: ArticleEntry) => boolean) =>
  getCollection("articles", filter);
export const listLabEntries = (filter?: (e: LabEntry) => boolean) => getCollection("labs", filter);
export const renderEntry = (entry: Entry) => render(entry);
export const renderPlayground = (entry: PlaygroundEntry) => render(entry);

/** 遊び場。`order` の昇順に並べる */
export async function listPlaygrounds(): Promise<PlaygroundEntry[]> {
  const found = await getCollection("playgrounds", isPublic);
  return [...found].sort((a, b) => a.data.order - b.data.order);
}

/** 片方向に書かれた related から、双方向に導出した関連を返す。下書きは出さない */
export async function getRelated(contentId: string): Promise<ContentRef[]> {
  const { graph, publicIds } = await get();
  return (graph.relatedOf.get(contentId) ?? [])
    .filter((id) => publicIds.has(id))
    .map((id) => graph.byId.get(id))
    .filter((r): r is ContentRef => r !== undefined)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}
