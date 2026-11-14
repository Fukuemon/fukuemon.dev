import { getCollection, getEntry, render } from "astro:content";
import { assertContentGraph } from "./article-graph";
import { listArticles, planSeriesPages, type SeriesSource } from "./article-list";
import { type ArticleSeries, isPublic, planArticlePages } from "./article-pages";
import { findEmbedNames } from "../playground/embeds";
import { projectDir, readProject } from "../playground/project";

/** 記事のページが描く値。Astro のエントリの形をページに出さない (docs/adr/0002-content-model-independence.md) */
export type ArticlePageProps = {
  id: string;
  title: string;
  description: string;
  publishedAt: Date;
  updatedAt?: Date;
  series?: ArticleSeries;
};

async function loadArticlesAndSeries() {
  const [articles, series] = await Promise.all([
    getCollection("articles"),
    getCollection("series"),
  ]);
  assertContentGraph(articles);
  // series の glob は `<series>/index.md` を読み、id はディレクトリ名から始まる
  const seriesSources: SeriesSource[] = series.map((s) => ({
    name: s.id.split("/")[0] as string,
    data: s.data,
  }));
  return { articles, series: seriesSources };
}

/** 記事のページの `getStaticPaths` が返す、書き出す記事のパスと props */
export async function getArticlePaths() {
  const { articles, series } = await loadArticlesAndSeries();
  const titles = new Map(series.map((s) => [s.name, s.data.title]));
  return planArticlePages(articles, titles, import.meta.env.DEV).map(({ article, series }) => {
    const { title, description, publishedAt, updatedAt } = article.data;
    return {
      params: { slug: article.id },
      props: {
        id: article.id,
        title,
        description,
        publishedAt,
        updatedAt,
        series,
      } satisfies ArticlePageProps,
    };
  });
}

/** 記事の本文を描くコンポーネントを返す */
export async function renderArticle(id: string) {
  const entry = await getEntry("articles", id);
  if (!entry) throw new Error(`記事が見つからない: ${id}`);
  const { Content } = await render(entry);
  return Content;
}

/** 記事の一覧と RSS に載せる記事を、新しい順に返す */
export async function getArticleList() {
  const { articles, series } = await loadArticlesAndSeries();
  return listArticles(articles, series, import.meta.env.DEV);
}

/** シリーズのページの `getStaticPaths` が返す、書き出すシリーズのパスと props */
export async function getSeriesPaths() {
  const { articles, series } = await loadArticlesAndSeries();
  return planSeriesPages(articles, series, import.meta.env.DEV).map((page) => ({
    params: { series: page.name },
    props: page,
  }));
}

/** プロジェクトの JSON のページの `getStaticPaths` が返す、ページを書き出す記事が埋め込むプロジェクト (ADR-0049) */
export async function getPlaygroundProjectPaths() {
  const { articles } = await loadArticlesAndSeries();
  return articles
    .filter((a) => isPublic(a.data.status, import.meta.env.DEV))
    .flatMap((article) => {
      if (article.filePath === undefined) throw new Error(`記事のパスが分からない: ${article.id}`);
      const path = article.filePath;
      return findEmbedNames(article.body ?? "").map((name) => ({
        params: { contentId: article.data.contentId, name },
        props: { project: readProject(projectDir(path, name)) },
      }));
    });
}
