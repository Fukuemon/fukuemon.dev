import { describe, expect, it } from "vitest";
import { forbiddenPaths, parseArticle } from "./production-dist.ts";

const article = (id: string, over: Partial<ReturnType<typeof parseArticle>> = {}) => ({
  id,
  contentId: id.replace("/", "-"),
  verificationOnly: false,
  ...over,
});

describe("parseArticle", () => {
  it("frontmatter から contentId と verificationOnly を読む", () => {
    const src = "---\ncontentId: a-b\nstatus: published\nverificationOnly: true\n---\n本文";
    expect(parseArticle("x", src)).toStrictEqual({
      id: "x",
      contentId: "a-b",
      verificationOnly: true,
    });
  });

  it("verificationOnly を書かない記事は false にする", () => {
    expect(parseArticle("x", "---\ncontentId: a\n---\n").verificationOnly).toBe(false);
  });
});

describe("forbiddenPaths", () => {
  const all = (p: string) => p !== "never";

  it("検証用の記事のページとプロジェクトの JSON があれば、そのパスを返す", () => {
    expect(forbiddenPaths([article("check", { verificationOnly: true })], all)).toStrictEqual([
      "articles/check",
      "playground-projects/check",
    ]);
  });

  it("検証用の記事だけのシリーズのページがあれば、返す", () => {
    const found = forbiddenPaths([article("s/a", { verificationOnly: true })], all);
    expect(found).toContain("series/s");
  });

  it("本物の記事が入るシリーズのページと、本物の記事は、返さない", () => {
    const found = forbiddenPaths(
      [article("s/a", { verificationOnly: true }), article("s/b"), article("real")],
      all,
    );
    expect(found).toStrictEqual(["articles/s/a", "playground-projects/s-a"]);
  });

  it("出力が無ければ、空を返す", () => {
    expect(
      forbiddenPaths([article("check", { verificationOnly: true })], () => false),
    ).toStrictEqual([]);
  });
});
