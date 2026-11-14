import { describe, expect, it } from "vitest";
import { type ArticleSource, isPublic, planArticlePages, siteModeOf } from "./article-pages";

const article = (id: string, over: Partial<ArticleSource["data"]> = {}): ArticleSource => ({
  id,
  data: { title: id, status: "published", verificationOnly: false, ...over },
});

const TITLES = new Map([["rdbms", "RDBMS を手で追う"]]);

const seriesById = (pages: ReturnType<typeof planArticlePages>) =>
  Object.fromEntries(pages.map((p) => [p.article.id, p.series]));

describe("isPublic", () => {
  const data = (status: "draft" | "archived" | "published", verificationOnly = false) => ({
    status,
    verificationOnly,
  });

  it.each([
    ["draft", false, false],
    ["archived", false, false],
    ["published", false, true],
    ["published", true, false],
  ] as const)(
    "本番の build では status が %s、verificationOnly が %s の記事を書き出すかが %s になる",
    (status, verificationOnly, expected) => {
      expect(isPublic(data(status, verificationOnly), "production")).toBe(expected);
    },
  );

  it.each([
    ["draft", false, false],
    ["published", false, true],
    ["published", true, true],
  ] as const)(
    "内部向けの build では status が %s、verificationOnly が %s の記事を書き出すかが %s になる",
    (status, verificationOnly, expected) => {
      expect(isPublic(data(status, verificationOnly), "internal")).toBe(expected);
    },
  );

  it.each(["draft", "archived", "published"] as const)(
    "dev server では %s も、検証用の記事も書き出す",
    (status) => {
      expect(isPublic(data(status, true), "dev")).toBe(true);
    },
  );
});

describe("siteModeOf", () => {
  it.each([
    [true, "production", "dev"],
    [false, undefined, "internal"],
    [false, "", "internal"],
    [false, "production", "production"],
  ] as const)("dev が %s、SITE_ENV が %s のとき %s にする", (dev, siteEnv, expected) => {
    expect(siteModeOf(dev, siteEnv)).toBe(expected);
  });

  it("production 以外の値は throw する", () => {
    expect(() => siteModeOf(false, "prod")).toThrow("SITE_ENV の値が誤っている: prod");
  });
});

describe("planArticlePages", () => {
  it("渡した記事をそのまま返し、シリーズに入れない記事には、シリーズの値を付けない", () => {
    const standalone = article("standalone");
    expect(planArticlePages([standalone], TITLES, "production")).toStrictEqual([
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
      "production",
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
        "production",
      ),
    );
    expect([series["rdbms/a"]?.prev, series["rdbms/b"]?.next]).toStrictEqual([
      undefined,
      undefined,
    ]);
  });

  it("本番の build では下書きを書き出さず、位置と前後も下書きを飛ばして数える", () => {
    const pages = planArticlePages(
      [
        article("rdbms/a", { order: 1 }),
        article("rdbms/b", { order: 2, status: "draft" }),
        article("rdbms/c", { order: 3 }),
      ],
      TITLES,
      "production",
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
      "dev",
    );
    expect(pages.map((p) => p.series?.total)).toStrictEqual([2, 2]);
  });

  it("題が引けないシリーズがあると、ビルドを失敗させる", () => {
    expect(() =>
      planArticlePages([article("unknown/a", { order: 1 })], TITLES, "production"),
    ).toThrow("unknown");
  });

  it("order の無いシリーズの記事があると、ビルドを失敗させる", () => {
    expect(() =>
      planArticlePages(
        [article("rdbms/a", { order: 1 }), article("rdbms/b")],
        TITLES,
        "production",
      ),
    ).toThrow("rdbms/b");
  });
});
