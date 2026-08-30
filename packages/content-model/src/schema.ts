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

/**
 * 記事は固有の属性を持たない。
 * 読了時間は出さない。手で書くと本文の分量とずれ、ずれた数字は
 * 同じ行にある実測値まで疑われる。
 */
export const articleFields = {};

export const handsOnFields = {
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  duration: z.number().int().positive(),
  /** 実行パネルが最初に流す SQL。全手順で 1 インスタンスを共有する */
  setup: z.string().optional(),
  /**
   * 手を動かす場所。3 つに分かれる。
   *
   * - `embedded` — ページの中で動く。cross-origin isolation を要求しない
   * - `local`    — 読者が自分の環境に用意する。実行環境をこちらで持たない
   *
   * `level` で分けるのは、**ページに何を置くかが変わる**ためである。
   * embedded は実行パネル、local は clone の手順を置く。
   *
   * `sandbox` (WebContainers / WebVM) は ADR-0006 で設計だけ決めてある。
   * 実装するときに足す。受け口だけ先に開けない。
   */
  interactive: z
    .discriminatedUnion("level", [
      z.object({
        level: z.literal("embedded"),
        /**
         * WASM の実行環境。**実装済みの値だけを並べる。**
         * 先回りして受理すると、ビルドを通ったコンテンツが読者の押下で初めて失敗する。
         */
        runtime: z.enum(["pglite"]),
      }),
      z.object({
        level: z.literal("local"),
        /** クローン先。読者はここを自分の環境へ持っていく */
        repository: z.string().url(),
        /** 用意の仕方。devcontainer なら開くだけで済む */
        via: z.enum(["devcontainer", "docker-compose", "manual"]),
        /** 始める前に要るもの。名前と、確かめるコマンド */
        requires: z
          .array(z.object({ name: z.string(), check: z.string().optional() }))
          .default([]),
      }),
    ])
    .optional(),
};

export const articleSchema = portalBase.extend(articleFields);
export const handsOnSchema = portalBase.extend(handsOnFields);

export type PortalBase = z.infer<typeof portalBase>;
export type ArticleData = z.infer<typeof articleSchema>;
export type HandsOnData = z.infer<typeof handsOnSchema>;
