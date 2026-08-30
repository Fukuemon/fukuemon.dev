import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { articleSchema, handsOnSchema, playgroundSchema } from "@fukuemon/content-model";

const loader = (dir: string) => glob({ base: `./src/content/${dir}`, pattern: "**/*.{md,mdx}" });

export const collections = {
  articles: defineCollection({ loader: loader("articles"), schema: articleSchema }),
  labs: defineCollection({ loader: loader("labs"), schema: handsOnSchema }),
  playgrounds: defineCollection({ loader: loader("playgrounds"), schema: playgroundSchema }),
};
