import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { articleSchema, seriesSchema } from "@fukuemon/content-model";
import { ARTICLES_DIR, articlesLoader } from "./lib/content/articles-loader";

// データソースを差し替える点。schema は Content Model が持つ
export const collections = {
  articles: defineCollection({ loader: articlesLoader(), schema: articleSchema }),
  series: defineCollection({
    loader: glob({ base: `./${ARTICLES_DIR}`, pattern: "*/index.{md,mdx}" }),
    schema: seriesSchema,
  }),
};
