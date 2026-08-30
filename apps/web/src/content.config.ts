import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { articleSchema, handsOnSchema } from "@fukuemon/content-model";

const loader = (dir: string) =>
  glob({ base: `./src/content/${dir}`, pattern: "**/*.{md,mdx}" });

// データソースを差し替える点。schema は種別ごとに持つ
export const collections = {
  articles: defineCollection({ loader: loader("articles"), schema: articleSchema }),
  labs: defineCollection({ loader: loader("labs"), schema: handsOnSchema }),
};
