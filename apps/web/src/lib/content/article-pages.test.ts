import { describe, expect, it } from "vitest";
import { type ArticleSource, isPublic, planArticlePages } from "./article-pages";

const article = (id: string, over: Partial<ArticleSource["data"]> = {}): ArticleSource => ({
  id,
  data: {
    title: id,
    description: "",
    status: "published",
    publishedAt: new Date("2026-11-14"),
    ...over,
  },
});

const TITLES = new Map([["rdbms", "RDBMS を手で追う"]]);

describe("isPublic", () => {
  it.each([
    ["draft", false],
    ["archived", false],
    ["published", true],
  ] as const)("build では %s を書き出すかが %s になる", (status, expected) => {
    expect(isPublic(status, false)).toBe(expected);
  });

  it.each(["draft", "archived", "published"] as const)(
    "dev server では %s も書き出す",
    (status) => {
      expect(isPublic(status, true)).toBe(true);
    },
  );
});

describe("planArticlePages", () => {
  it("シリーズに入れない記事には、シリーズの値を付けない", () => {
    expect(planArticlePages([article("standalone")], TITLES, false)).toStrictEqual([
      { id: "standalone" },
    ]);
  });

  it("シリーズの記事を order の昇順に並べ、位置と前後を付ける", () => {
    const pages = planArticlePages(
      [
        article("rdbms/c", { order: 10 }),
        article("rdbms/a", { order: 2 }),
        article("rdbms/b", { order: 3 }),
      ],
      TITLES,
      false,
    );
    expect(pages.find((p) => p.id === "rdbms/b")?.series).toStrictEqual({
      title: "RDBMS を手で追う",
      position: 2,
      total: 3,
      prev: { title: "rdbms/a", href: "/articles/rdbms/a" },
      next: { title: "rdbms/c", href: "/articles/rdbms/c" },
    });
  });

  it("シリーズの最初の記事には前を、最後の記事には次を付けない", () => {
    const pages = planArticlePages(
      [article("rdbms/a", { order: 1 }), article("rdbms/b", { order: 2 })],
      TITLES,
      false,
    );
    expect(pages.map((p) => [p.series?.prev, p.series?.next])).toStrictEqual([
      [undefined, { title: "rdbms/b", href: "/articles/rdbms/b" }],
      [{ title: "rdbms/a", href: "/articles/rdbms/a" }, undefined],
    ]);
  });

  it("build では下書きを書き出さず、位置と前後も下書きを飛ばして数える", () => {
    const pages = planArticlePages(
      [
        article("rdbms/a", { order: 1 }),
        article("rdbms/b", { order: 2, status: "draft" }),
        article("rdbms/c", { order: 3 }),
      ],
      TITLES,
      false,
    );
    expect(
      pages.map((p) => [p.id, p.series?.position, p.series?.total, p.series?.next?.href]),
    ).toStrictEqual([
      ["rdbms/a", 1, 2, "/articles/rdbms/c"],
      ["rdbms/c", 2, 2, undefined],
    ]);
  });

  it("dev server では下書きも位置に数える", () => {
    const pages = planArticlePages(
      [article("rdbms/a", { order: 1 }), article("rdbms/b", { order: 2, status: "draft" })],
      TITLES,
      true,
    );
    expect(pages.map((p) => p.series?.total)).toStrictEqual([2, 2]);
  });
});
