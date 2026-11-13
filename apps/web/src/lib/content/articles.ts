import { getCollection, render, type CollectionEntry } from "astro:content";
import { type ArticleSeries, planArticlePages } from "./article-pages";

export type ArticlePageProps = {
  entry: CollectionEntry<"articles">;
  series?: ArticleSeries;
};

/** 記事のページの `getStaticPaths` が返す、書き出す記事のパスと props */
export async function getArticlePaths() {
  const [articles, series] = await Promise.all([
    getCollection("articles"),
    getCollection("series"),
  ]);
  // series の glob は `<series>/index.md` を読み、id はディレクトリ名から始まる
  const titles = new Map(series.map((s) => [s.id.split("/")[0], s.data.title]));
  const byId = new Map(articles.map((a) => [a.id, a]));
  return planArticlePages(articles, titles, import.meta.env.DEV).map((page) => ({
    params: { slug: page.id },
    props: { entry: byId.get(page.id)!, series: page.series } satisfies ArticlePageProps,
  }));
}

/** 記事の本文を描くコンポーネントを返す */
export async function renderArticle(entry: ArticlePageProps["entry"]) {
  const { Content } = await render(entry);
  return Content;
}
