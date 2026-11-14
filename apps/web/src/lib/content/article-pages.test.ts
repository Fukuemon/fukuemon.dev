import { describe, expect, it } from "vitest";
import { type ArticleSource, isPublic, planArticlePages } from "./article-pages";

const article = (id: string, over: Partial<ArticleSource["data"]> = {}): ArticleSource => ({
  id,
  data: { title: id, status: "published", ...over },
});

const TITLES = new Map([["rdbms", "RDBMS を手で追う"]]);

const seriesById = (pages: ReturnType<typeof planArticlePages>) =>
  Object.fromEntries(pages.map((p) => [p.article.id, p.series]));

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
  it("渡した記事をそのまま返し、シリーズに入れない記事には、シリーズの値を付けない", () => {
    const standalone = article("standalone");
    expect(planArticlePages([standalone], TITLES, false)).toStrictEqual([
      { article: standalone, series: undefined },
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
    expect(seriesById(pages)["rdbms/b"]).toStrictEqual({
      title: "RDBMS を手で追う",
      position: 2,
      total: 3,
      prev: { title: "rdbms/a", href: "/articles/rdbms/a" },
      next: { title: "rdbms/c", href: "/articles/rdbms/c" },
    });
  });

  it("シリーズの最初の記事には前を、最後の記事には次を付けない", () => {
    const series = seriesById(
      planArticlePages(
        [article("rdbms/a", { order: 1 }), article("rdbms/b", { order: 2 })],
        TITLES,
        false,
      ),
    );
    expect([series["rdbms/a"]?.prev, series["rdbms/b"]?.next]).toStrictEqual([
      undefined,
      undefined,
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
      pages.map((p) => [p.article.id, p.series?.position, p.series?.total, p.series?.next?.href]),
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

  it("題が引けないシリーズがあると、ビルドを失敗させる", () => {
    expect(() => planArticlePages([article("unknown/a", { order: 1 })], TITLES, false)).toThrow(
      "unknown",
    );
  });

  it("order の無いシリーズの記事があると、ビルドを失敗させる", () => {
    expect(() =>
      planArticlePages([article("rdbms/a", { order: 1 }), article("rdbms/b")], TITLES, false),
    ).toThrow("rdbms/b");
  });
});
