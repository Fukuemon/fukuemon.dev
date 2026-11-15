import { describe, expect, it } from "vitest";
import {
  type ArticleListSource,
  type SeriesSource,
  listArticles,
  planSeriesPages,
} from "./article-list";

const article = (
  id: string,
  publishedAt: string,
  over: Partial<ArticleListSource["data"]> = {},
): ArticleListSource => ({
  id,
  data: {
    contentId: id.replace("/", "-"),
    title: `題 ${id}`,
    description: `説明 ${id}`,
    tags: ["検証"],
    status: "published",
    publishedAt: new Date(publishedAt),
    format: "page",
    ...over,
  },
});

const RDBMS: SeriesSource = {
  name: "rdbms",
  data: { title: "RDBMS を手で追う", description: "B-tree から順に追う" },
};

const listedHrefs = (items: ReturnType<typeof listArticles>) => items.map((i) => i.ref.href);

const pageHrefs = (pages: ReturnType<typeof planSeriesPages>) =>
  pages.map((p) => ({ name: p.name, articles: p.articles.map((a) => a.href) }));

describe("listArticles", () => {
  it("シリーズの記事を ContentRef にし、シリーズの題とページへのリンクを付ける", () => {
    const items = listArticles(
      [article("rdbms/btree", "2026-11-01", { order: 1 })],
      [RDBMS],
      false,
    );
    expect(items).toStrictEqual([
      {
        ref: {
          contentId: "rdbms-btree",
          format: "page",
          series: "rdbms",
          title: "題 rdbms/btree",
          description: "説明 rdbms/btree",
          href: "/articles/rdbms/btree",
          tags: ["検証"],
          date: new Date("2026-11-01"),
        },
        series: { title: "RDBMS を手で追う", href: "/series/rdbms" },
      },
    ]);
  });

  it("シリーズに入れない記事は、series を持たず、シリーズのリンクも付けない", () => {
    const items = listArticles([article("standalone", "2026-11-01")], [], false);
    expect(items).toStrictEqual([
      {
        ref: {
          contentId: "standalone",
          format: "page",
          series: undefined,
          title: "題 standalone",
          description: "説明 standalone",
          href: "/articles/standalone",
          tags: ["検証"],
          date: new Date("2026-11-01"),
        },
      },
    ]);
  });

  it("公開の日付の新しい順に並べ、同じ日は href の順にする", () => {
    const items = listArticles(
      [
        article("old", "2026-10-01"),
        article("b-same", "2026-11-01"),
        article("a-same", "2026-11-01"),
        article("new", "2026-11-10"),
      ],
      [],
      false,
    );
    expect(listedHrefs(items)).toStrictEqual([
      "/articles/new",
      "/articles/a-same",
      "/articles/b-same",
      "/articles/old",
    ]);
  });

  it("build では、公開していない記事を外す", () => {
    const items = listArticles(
      [
        article("draft", "2026-11-01", { status: "draft" }),
        article("archived", "2026-11-01", { status: "archived" }),
        article("published", "2026-11-01"),
      ],
      [],
      false,
    );
    expect(listedHrefs(items)).toStrictEqual(["/articles/published"]);
  });

  it("dev server では、公開していない記事も載せる", () => {
    const items = listArticles([article("draft", "2026-11-01", { status: "draft" })], [], true);
    expect(listedHrefs(items)).toStrictEqual(["/articles/draft"]);
  });

  it("同じ日の記事は、大文字を小文字より先にする。ロケールの照合順に依らない", () => {
    const items = listArticles([article("a", "2026-11-01"), article("B", "2026-11-01")], [], false);
    expect(listedHrefs(items)).toStrictEqual(["/articles/B", "/articles/a"]);
  });

  it("index.md の無いディレクトリの記事があると、ビルドを失敗させる", () => {
    expect(() =>
      listArticles([article("unknown/a", "2026-11-01", { order: 1 })], [RDBMS], false),
    ).toThrow("シリーズの題が無い: unknown");
  });
});

describe("planSeriesPages", () => {
  it("シリーズの題、説明、ページの URL を持ち、記事を ContentRef にする", () => {
    const pages = planSeriesPages(
      [article("rdbms/btree", "2026-11-01", { order: 1 })],
      [RDBMS],
      false,
    );
    expect(pages).toStrictEqual([
      {
        name: "rdbms",
        href: "/series/rdbms",
        title: "RDBMS を手で追う",
        description: "B-tree から順に追う",
        articles: [
          {
            contentId: "rdbms-btree",
            format: "page",
            series: "rdbms",
            title: "題 rdbms/btree",
            description: "説明 rdbms/btree",
            href: "/articles/rdbms/btree",
            tags: ["検証"],
            date: new Date("2026-11-01"),
          },
        ],
      },
    ]);
  });

  it("記事を、ファイル名や公開の日付の順ではなく、order の昇順に並べ、シリーズに入れない記事を外す", () => {
    const pages = planSeriesPages(
      [
        article("rdbms/a-last", "2026-10-01", { order: 3 }),
        article("rdbms/first", "2026-11-03", { order: 1 }),
        article("rdbms/second", "2026-11-02", { order: 2 }),
        article("standalone", "2026-11-01"),
      ],
      [RDBMS],
      false,
    );
    expect(pageHrefs(pages)).toStrictEqual([
      {
        name: "rdbms",
        articles: ["/articles/rdbms/first", "/articles/rdbms/second", "/articles/rdbms/a-last"],
      },
    ]);
  });

  it("build では、公開していない記事を外す", () => {
    const pages = planSeriesPages(
      [
        article("rdbms/first", "2026-11-01", { order: 1 }),
        article("rdbms/draft", "2026-11-01", { order: 2, status: "draft" }),
      ],
      [RDBMS],
      false,
    );
    expect(pageHrefs(pages)).toStrictEqual([
      { name: "rdbms", articles: ["/articles/rdbms/first"] },
    ]);
  });

  it("公開した記事が 1 本も無いシリーズは返さない", () => {
    const pages = planSeriesPages(
      [article("rdbms/draft", "2026-11-01", { order: 1, status: "draft" })],
      [RDBMS],
      false,
    );
    expect(pages).toStrictEqual([]);
  });

  it("dev server では、公開していない記事だけのシリーズも返す", () => {
    const pages = planSeriesPages(
      [article("rdbms/draft", "2026-11-01", { order: 1, status: "draft" })],
      [RDBMS],
      true,
    );
    expect(pageHrefs(pages)).toStrictEqual([
      { name: "rdbms", articles: ["/articles/rdbms/draft"] },
    ]);
  });

  it("index.md の無いディレクトリの記事があると、ビルドを失敗させる", () => {
    expect(() =>
      planSeriesPages([article("unknown/a", "2026-11-01", { order: 1 })], [RDBMS], false),
    ).toThrow("シリーズの題が無い: unknown");
  });

  it("build では、公開していない記事だけの、index.md の無いディレクトリでは失敗しない", () => {
    const pages = planSeriesPages(
      [article("unknown/a", "2026-11-01", { order: 1, status: "draft" })],
      [RDBMS],
      false,
    );
    expect(pages).toStrictEqual([]);
  });

  it("シリーズが 2 つあるとき、公開した記事のあるシリーズだけを、記事を分けて返す", () => {
    const other: SeriesSource = { name: "other", data: { title: "別", description: "別の説明" } };
    const pages = planSeriesPages(
      [
        article("rdbms/first", "2026-11-01", { order: 1 }),
        article("other/draft", "2026-11-01", { order: 1, status: "draft" }),
      ],
      [other, RDBMS],
      false,
    );
    expect(pageHrefs(pages)).toStrictEqual([
      { name: "rdbms", articles: ["/articles/rdbms/first"] },
    ]);
  });

  it("シリーズの記事に order が無いと、ビルドを失敗させる", () => {
    expect(() =>
      planSeriesPages(
        [article("rdbms/a", "2026-11-01", { order: 1 }), article("rdbms/b", "2026-11-01")],
        [RDBMS],
        false,
      ),
    ).toThrow("シリーズの記事に order が無い: rdbms/b");
  });
});
