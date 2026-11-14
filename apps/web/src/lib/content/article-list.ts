import type { ArticleData, ContentRef, SeriesData } from "@fukuemon/content-model";
import { type ArticleSource, articleHref, isPublic, orderOf, seriesDir } from "./article-pages";

/** 一覧、シリーズのページ、RSS を組むのに要る、記事 1 本の id と frontmatter。記事のページの値に、一覧に出す項目を足す */
export type ArticleListSource = ArticleSource & {
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
type ArticleListItem = { ref: ContentRef; series?: SeriesLink };

/** シリーズのページが描く値 */
export type SeriesPage = {
  name: string;
  href: string;
  title: string;
  description: string;
  /** `order` の昇順に並べた、公開した記事 */
  articles: ContentRef[];
};

function seriesHref(name: string): string {
  return `/series/${name}`;
}

export function toContentRef(a: ArticleListSource): ContentRef {
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

/** 新しい順に比べる。同じ日の記事は href の順にし、ビルドごとに並びが変わらないようにする */
function byNewest(a: ContentRef, b: ContentRef): number {
  const byDate = b.date.getTime() - a.date.getTime();
  if (byDate !== 0) return byDate;
  // localeCompare は実行する環境のロケールで結果が変わるので、コードポイントで比べる
  return a.href < b.href ? -1 : 1;
}

function seriesLinks(series: readonly SeriesSource[]): Map<string, SeriesLink> {
  return new Map(series.map((s) => [s.name, { title: s.data.title, href: seriesHref(s.name) }]));
}

/**
 * 一覧に載せる記事を、公開の日付の新しい順に返す。
 * シリーズの題が引けない記事があると throw する。読み込みのときに `planSeries()` が先に止めるので、loader と collection の対応を誤ったときだけ起きる。
 */
export function listArticles(
  articles: readonly ArticleListSource[],
  series: readonly SeriesSource[],
  isDev: boolean,
): ArticleListItem[] {
  const refs = articles.filter((a) => isPublic(a.data.status, isDev)).map(toContentRef);
  assertSeriesDefined(
    refs.map((ref) => ref.series),
    series,
  );
  const links = seriesLinks(series);
  return refs.sort(byNewest).map((ref) => {
    const link = ref.series === undefined ? undefined : links.get(ref.series);
    return link === undefined ? { ref } : { ref, series: link };
  });
}

function assertSeriesDefined(
  dirs: Iterable<string | undefined>,
  series: readonly SeriesSource[],
): void {
  const names = new Set(series.map((s) => s.name));
  for (const dir of dirs) {
    if (dir !== undefined && !names.has(dir)) throw new Error(`シリーズの題が無い: ${dir}`);
  }
}

/**
 * 書き出すシリーズのページを組む。記事は `order` の昇順に並べる。
 * 公開した記事が 1 本も無いシリーズは返さない。記事の無いページを書き出さないためである。
 * `index.md` の無いディレクトリの記事があると throw する。
 * 読み込みのときに `planSeries()` が先に止めるので、ここに来るのは、loader と collection の対応を誤ったときだけである。
 */
export function planSeriesPages(
  articles: readonly ArticleListSource[],
  series: readonly SeriesSource[],
  isDev: boolean,
): SeriesPage[] {
  const shown = articles.filter((a) => isPublic(a.data.status, isDev));
  const byDir = Map.groupBy(shown, (a) => seriesDir(a.id));
  assertSeriesDefined(byDir.keys(), series);
  return series.flatMap((s) => {
    const members = byDir.get(s.name);
    return members === undefined ? [] : [toSeriesPage(s, members)];
  });
}

function toSeriesPage({ name, data }: SeriesSource, members: ArticleListSource[]): SeriesPage {
  return {
    name,
    href: seriesHref(name),
    title: data.title,
    description: data.description,
    articles: members.toSorted((a, b) => orderOf(a) - orderOf(b)).map(toContentRef),
  };
}
