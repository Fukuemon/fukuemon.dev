import { z } from "zod";

export const CONTENT_ID = /^[a-z0-9][a-z0-9-]*$/;

/**
 * 実装した形式の値だけを並べる。
 * 先に受け付けると、ビルドを通った記事が表示のときに崩れる (ADR-0030)
 */
export const ARTICLE_FORMATS = ["page"] as const;

export const articleSchema = z.object({
  contentId: z.string().regex(CONTENT_ID),
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()).min(1),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  publishedAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  related: z.array(z.string()).default([]),
  repository: z.object({ url: z.string().url(), path: z.string().optional() }).optional(),
  format: z.enum(ARTICLE_FORMATS).default("page"),
  /** シリーズの中の読む順。小さいほど前。シリーズに入れない記事は書かない */
  order: z.number().int().optional(),
});

/** `articles/<series>/index.md` の frontmatter */
export const seriesSchema = z.object({
  title: z.string(),
  description: z.string(),
});

export type ArticleData = z.infer<typeof articleSchema>;
export type ArticleFormat = ArticleData["format"];
export type SeriesData = z.infer<typeof seriesSchema>;
