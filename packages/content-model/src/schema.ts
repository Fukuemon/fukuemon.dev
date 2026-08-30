import { z } from "zod";

export const CONTENT_ID = /^[a-z0-9][a-z0-9-]*$/;

/** 記事とハンズオンに共通する frontmatter */
export const portalBase = z.object({
  contentId: z.string().regex(CONTENT_ID),
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()).min(1),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  publishedAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  related: z.array(z.string()).default([]),
  repository: z
    .object({ url: z.string().url(), path: z.string().optional() })
    .optional(),
});

/** 読了時間は出さない。手で書くと本文の分量とずれる */
export const articleFields = {};

export const handsOnFields = {
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  duration: z.number().int().positive(),
  /** 全手順で 1 インスタンスを共有する */
  setup: z.string().optional(),
  /**
   * ページに何を置くかが変わるので level で分ける。
   * embedded は実行パネル、local は clone の手順。
   * sandbox は ADR-0006 で設計だけ決めてあり、実装するときに足す。
   */
  interactive: z
    .discriminatedUnion("level", [
      z.object({
        level: z.literal("embedded"),
        /** 実装済みの値だけを並べる。先回りして受理すると読者の押下で初めて失敗する */
        runtime: z.enum(["pglite"]),
      }),
      z.object({
        level: z.literal("local"),
        repository: z.string().url(),
        via: z.enum(["devcontainer", "docker-compose", "manual"]),
        requires: z
          .array(z.object({ name: z.string(), check: z.string().optional() }))
          .default([]),
      }),
    ])
    .optional(),
};

export const presetSchema = z.object({ label: z.string(), sql: z.string() });

/** 記事とハンズオンと同じく 1 枚の Markdown で表す (ADR-0009) */
export const playgroundSchema = z.object({
  contentId: z.string().regex(CONTENT_ID),
  title: z.string(),
  description: z.string(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  /** 実装済みの値だけを並べる */
  runtime: z.enum(["pglite"]),
  setup: z.string().optional(),
  /** 押すと入力欄へ入る例 */
  presets: z.array(presetSchema).default([]),
  /** 小さいほど前 */
  order: z.number().int().default(0),
});

export const articleSchema = portalBase.extend(articleFields);
export const handsOnSchema = portalBase.extend(handsOnFields);

export type PortalBase = z.infer<typeof portalBase>;
export type ArticleData = z.infer<typeof articleSchema>;
export type HandsOnData = z.infer<typeof handsOnSchema>;

export type PlaygroundData = z.infer<typeof playgroundSchema>;
export type Preset = z.infer<typeof presetSchema>;
