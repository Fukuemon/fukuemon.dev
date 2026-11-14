import { describe, expect, it } from "vitest";
import type { PlaygroundProject } from "@fukuemon/playground-project";
import { planProjectPages } from "./project-pages";

const read = (dir: string): PlaygroundProject => ({
  tool: "go",
  version: dir,
  files: { "main.go": "" },
  open: "main.go",
});

const fence = (name: string) => `\`\`\`playground\n${name}\n\`\`\`\n`;

describe("プロジェクトの JSON のページ", () => {
  it("記事ごとに、埋め込みの名前と contentId をパスにし、記事のディレクトリのプロジェクトを読む", () => {
    const pages = planProjectPages(
      [{ id: "s/a", filePath: "articles/s/a.md", contentId: "a", body: fence("x") + fence("y") }],
      read,
    );
    expect(pages.map((p) => [p.params, p.props.project.version])).toStrictEqual([
      [{ contentId: "a", name: "x" }, "articles/s/playground/x"],
      [{ contentId: "a", name: "y" }, "articles/s/playground/y"],
    ]);
  });

  it("埋め込みの無い記事は、ページを作らない", () => {
    expect(
      planProjectPages([{ id: "a", filePath: "articles/a.md", contentId: "a" }], read),
    ).toStrictEqual([]);
  });

  it("同じディレクトリの 2 本の記事が、同じ名前を埋め込むと失敗する", () => {
    const articles = [
      { id: "a", filePath: "articles/a.md", contentId: "a", body: fence("x") },
      { id: "b", filePath: "articles/b.md", contentId: "b", body: fence("x") },
    ];
    expect(() => planProjectPages(articles, read)).toThrow("2 本の記事が埋め込んでいる");
  });

  it("記事のパスが分からないときは失敗する", () => {
    expect(() => planProjectPages([{ id: "a", contentId: "a", body: fence("x") }], read)).toThrow(
      "記事のパスが分からない",
    );
  });
});
