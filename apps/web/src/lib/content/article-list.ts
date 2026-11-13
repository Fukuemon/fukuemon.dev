import type { ArticleData, ContentRef, SeriesData } from "@fukuemon/content-model";
import { type ArticleSource, articleHref, isPublic, orderOf, seriesDir } from "./article-pages";

/** 一覧、シリーズのページ、RSS を組むのに要る、記事の 1 本の値。記事のページの値に、一覧に出す項目を足す */
export type ListArticleSource = ArticleSource & {
  data: Pick<ArticleData, "contentId" | "description" | "tags" | "publishedAt" | "format">;
};

/** シリーズの `index.md` の 1 枚の値 */
export type SeriesSource = {
  /** シリーズのディレクトリ名 */
  name: string;
  data: SeriesData;
};

/** シリーズのページへのリンク */
export type SeriesLink = Pick<ContentRef, "title" | "href">;

/** 一覧の 1 行。記事がシリーズに入っていれば、シリーズの題とページへのリンクを持つ */
export type ArticleListItem = { ref: ContentRef; series?: SeriesLink };

export type SeriesPage = {
  name: string;
  href: string;
  title: string;
  description: string;
  /** `order` の昇順に並べた、公開した記事 */
  articles: ContentRef[];
};

export function seriesHref(name: string): string {
  return `/series/${name}`;
}

export function toContentRef(a: ListArticleSource): ContentRef {
  const { contentId, format, title, description, tags, publishedAt } = a.data;
  return {
    contentId,
    format,
    series: seriesDir(a.id),
    title,
    description,
    href: articleHref(a.id),
    tags,
    date: publishedAt,
  };
}

/** 新しい順。同じ日の記事は href の順にして、ビルドごとに並びが変わらないようにする */
function byNewest(a: ContentRef, b: ContentRef): number {
  return b.date.getTime() - a.date.getTime() || a.href.localeCompare(b.href);
}

function seriesLinks(series: readonly SeriesSource[]): Map<string, SeriesLink> {
  return new Map(series.map((s) => [s.name, { title: s.data.title, href: seriesHref(s.name) }]));
}

/**
 * 一覧に載せる記事を、公開の日付の新しい順に返す。
 * シリーズの題が引けない記事があると throw する。題の無いシリーズ名を一覧に出さないためである。
 */
export function listArticles(
  articles: readonly ListArticleSource[],
  series: readonly SeriesSource[],
  isDev: boolean,
): ArticleListItem[] {
  const links = seriesLinks(series);
  return articles
    .filter((a) => isPublic(a.data.status, isDev))
    .map(toContentRef)
    .sort(byNewest)
    .map((ref) => {
      if (ref.series === undefined) return { ref };
      const link = links.get(ref.series);
      if (link === undefined) throw new Error(`シリーズの題が無い: ${ref.series}`);
      return { ref, series: link };
    });
}

/**
 * 書き出すシリーズのページを組む。記事は `order` の昇順に並べる。
 * 公開した記事が 1 本も無いシリーズは返さない。記事の無いページを書き出さないためである。
 */
export function planSeriesPages(
  articles: readonly ListArticleSource[],
  series: readonly SeriesSource[],
  isDev: boolean,
): SeriesPage[] {
  const shown = articles.filter((a) => isPublic(a.data.status, isDev));
  const byDir = Map.groupBy(shown, (a) => seriesDir(a.id));
  return series.flatMap(({ name, data }) => {
    const members = byDir.get(name);
    if (members === undefined) return [];
    const articles = members.toSorted((a, b) => orderOf(a) - orderOf(b)).map(toContentRef);
    return [
      { name, href: seriesHref(name), title: data.title, description: data.description, articles },
    ];
  });
}
