import { describe, expect, it } from "vitest";
import {
  type ListArticleSource,
  type SeriesSource,
  listArticles,
  planSeriesPages,
  toContentRef,
} from "./article-list";

const article = (
  id: string,
  publishedAt: string,
  over: Partial<ListArticleSource["data"]> = {},
): ListArticleSource => ({
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

const hrefs = (items: { href: string }[]) => items.map((i) => i.href);

describe("toContentRef", () => {
  it("シリーズの記事は、id の先頭のディレクトリ名をシリーズにし、href を /articles/<id> にする", () => {
    expect(toContentRef(article("rdbms/btree", "2026-11-01", { order: 1 }))).toStrictEqual({
      contentId: "rdbms-btree",
      format: "page",
      series: "rdbms",
      title: "題 rdbms/btree",
      description: "説明 rdbms/btree",
      href: "/articles/rdbms/btree",
      tags: ["検証"],
      date: new Date("2026-11-01"),
    });
  });

  it("シリーズに入れない記事は、series を持たない", () => {
    expect(toContentRef(article("standalone", "2026-11-01")).series).toBeUndefined();
  });
});

describe("listArticles", () => {
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
    expect(hrefs(items.map((i) => i.ref))).toStrictEqual([
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
    expect(hrefs(items.map((i) => i.ref))).toStrictEqual(["/articles/published"]);
  });

  it("dev server では、公開していない記事も載せる", () => {
    const items = listArticles([article("draft", "2026-11-01", { status: "draft" })], [], true);
    expect(items).toHaveLength(1);
  });

  it("シリーズの記事には、シリーズの題とページへのリンクを付け、ほかの記事には付けない", () => {
    const items = listArticles(
      [article("rdbms/btree", "2026-11-02", { order: 1 }), article("standalone", "2026-11-01")],
      [RDBMS],
      false,
    );
    expect(items.map((i) => i.series)).toStrictEqual([
      { title: "RDBMS を手で追う", href: "/series/rdbms" },
      undefined,
    ]);
  });

  it("シリーズの題が引けない記事があると throw する", () => {
    expect(() =>
      listArticles([article("unknown/a", "2026-11-01", { order: 1 })], [RDBMS], false),
    ).toThrow("シリーズの題が無い: unknown");
  });
});

describe("planSeriesPages", () => {
  it("シリーズの題と説明を持ち、記事を order の昇順に並べる", () => {
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
    expect(pages).toHaveLength(1);
    const [page] = pages;
    expect(page).toMatchObject({
      name: "rdbms",
      title: "RDBMS を手で追う",
      description: "B-tree から順に追う",
    });
    expect(hrefs(page?.articles ?? [])).toStrictEqual([
      "/articles/rdbms/first",
      "/articles/rdbms/second",
      "/articles/rdbms/a-last",
    ]);
  });

  it("build では、公開していない記事を外す", () => {
    const [page] = planSeriesPages(
      [
        article("rdbms/first", "2026-11-01", { order: 1 }),
        article("rdbms/draft", "2026-11-01", { order: 2, status: "draft" }),
      ],
      [RDBMS],
      false,
    );
    expect(hrefs(page?.articles ?? [])).toStrictEqual(["/articles/rdbms/first"]);
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
    expect(pages).toHaveLength(1);
  });

  it("シリーズの記事に order が無いと throw する", () => {
    expect(() =>
      planSeriesPages(
        [article("rdbms/a", "2026-11-01", { order: 1 }), article("rdbms/b", "2026-11-01")],
        [RDBMS],
        false,
      ),
    ).toThrow("シリーズの記事に order が無い: rdbms/b");
  });
});
