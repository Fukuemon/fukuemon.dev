import type { ArticleData } from "@fukuemon/content-model";
import type { SeriesPagerLink } from "@fukuemon/ui";

/** 記事のページを組むのに要る、記事の 1 本の値 */
export type ArticleSource = {
  /** Astro の id。`articles/` からの相対パスから拡張子を外したもの */
  id: string;
  data: Pick<
    ArticleData,
    "title" | "description" | "status" | "publishedAt" | "updatedAt" | "order"
  >;
};

/** シリーズの中の記事のページが、シリーズについて描く値 */
export type ArticleSeries = {
  title: string;
  position: number;
  total: number;
  prev?: SeriesPagerLink;
  next?: SeriesPagerLink;
};

export type ArticlePage = {
  id: string;
  series?: ArticleSeries;
};

/** dev server ではすべてを、build では公開した記事だけを書き出す */
export function isPublic(status: ArticleData["status"], isDev: boolean): boolean {
  return isDev || status === "published";
}

function articleHref(id: string): string {
  return `/articles/${id}`;
}

/** シリーズに入る記事は `articles/<series>/` に置かれ、id の先頭がシリーズのディレクトリ名になる */
function seriesDir(id: string): string | undefined {
  const i = id.indexOf("/");
  return i === -1 ? undefined : id.slice(0, i);
}

/** 書き出す記事を、シリーズのディレクトリ名ごとに、order の昇順に並べる */
function groupSeries(shown: readonly ArticleSource[]): Map<string, ArticleSource[]> {
  const groups = Map.groupBy(
    shown.filter((a) => seriesDir(a.id) !== undefined),
    (a) => seriesDir(a.id)!,
  );
  for (const list of groups.values())
    list.sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  return groups;
}

function toLink(a: ArticleSource | undefined): SeriesPagerLink | undefined {
  return a && { title: a.data.title, href: articleHref(a.id) };
}

/**
 * 書き出す記事のページを組む。
 * シリーズの位置と前後は、書き出す記事だけで数える。
 * 書き出さない記事を数えると、前後のリンクが無いページを指す。
 * @param seriesTitles シリーズのディレクトリ名から、`index.md` の `title` への対応
 */
export function planArticlePages(
  articles: readonly ArticleSource[],
  seriesTitles: ReadonlyMap<string, string>,
  isDev: boolean,
): ArticlePage[] {
  const shown = articles.filter((a) => isPublic(a.data.status, isDev));
  const groups = groupSeries(shown);
  return shown.map((a) => {
    const dir = seriesDir(a.id);
    const list = dir === undefined ? undefined : groups.get(dir);
    if (dir === undefined || list === undefined) return { id: a.id };
    const i = list.indexOf(a);
    return {
      id: a.id,
      series: {
        title: seriesTitles.get(dir) ?? dir,
        position: i + 1,
        total: list.length,
        prev: toLink(list[i - 1]),
        next: toLink(list[i + 1]),
      },
    };
  });
}
