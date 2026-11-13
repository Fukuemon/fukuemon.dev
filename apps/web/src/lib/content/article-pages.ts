import type { ArticleData } from "@fukuemon/content-model";
import type { SeriesPagerLink } from "@fukuemon/ui";

/** 記事のページを組むのに要る、記事の 1 本の値 */
export type ArticleSource = {
  /** Astro の id。`articles/` からの相対パスから拡張子を外したもの */
  id: string;
  data: Pick<ArticleData, "title" | "status" | "order">;
};

/** シリーズの中の記事のページが、シリーズについて描く値 */
export type ArticleSeries = {
  title: string;
  position: number;
  total: number;
  prev?: SeriesPagerLink;
  next?: SeriesPagerLink;
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

/**
 * planSeries() が読み込みのときに order の欠けを止めるので、ここに来るのは対応の誤りだけである。
 * 0 として並べると、誤りが前後のリンクの順の誤りとして、エラーを出さずに出る。
 */
function orderOf(a: ArticleSource): number {
  if (a.data.order === undefined) throw new Error(`シリーズの記事に order が無い: ${a.id}`);
  return a.data.order;
}

function toLink(a: ArticleSource | undefined): SeriesPagerLink | undefined {
  return a && { title: a.data.title, href: articleHref(a.id) };
}

/**
 * 書き出す記事のページを組む。渡した記事を、シリーズの値と組にして返す。
 * シリーズの位置と前後は、書き出す記事だけで数える。
 * 書き出さない記事を数えると、前後のリンクが無いページを指す。
 * @param seriesTitles シリーズのディレクトリ名から、`index.md` の `title` への対応。題が引けないシリーズがあると throw する
 */
export function planArticlePages<T extends ArticleSource>(
  articles: readonly T[],
  seriesTitles: ReadonlyMap<string, string>,
  isDev: boolean,
): { article: T; series?: ArticleSeries }[] {
  const shown = articles.filter((a) => isPublic(a.data.status, isDev));
  const seriesOf = new Map<T, ArticleSeries>();
  for (const [dir, list] of Map.groupBy(shown, (a) => seriesDir(a.id))) {
    if (dir === undefined) continue;
    const title = seriesTitles.get(dir);
    if (title === undefined) throw new Error(`シリーズの題が無い: ${dir}`);
    list.sort((a, b) => orderOf(a) - orderOf(b));
    list.forEach((a, i) => {
      seriesOf.set(a, {
        title,
        position: i + 1,
        total: list.length,
        prev: toLink(list[i - 1]),
        next: toLink(list[i + 1]),
      });
    });
  }
  return shown.map((article) => ({ article, series: seriesOf.get(article) }));
}
