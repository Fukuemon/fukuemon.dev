import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findNodeEmbedPages, isolationHeaders, pagePath } from "./isolation-headers";

function dist(pages: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "isolation-headers-"));
  for (const [path, html] of Object.entries(pages)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), html);
  }
  return dir;
}

const NODE = '<div data-playground-embed="" data-playground-tool="node"></div>';
const SQL = '<div data-playground-embed="" data-playground-tool="sql"></div>';

describe("Node の実行環境を埋め込むページを集める", () => {
  it("Node の実行環境を埋め込むページだけを集め、SQL だけと埋め込まないページを除く", () => {
    const dir = dist({
      "articles/node/index.html": NODE,
      "articles/s/node2/index.html": `${SQL}${NODE}`,
      "articles/sql/index.html": SQL,
      "articles/plain/index.html": "<p>本文</p>",
      "playground-projects/a/b.json": NODE,
    });
    expect(findNodeEmbedPages(dir)).toStrictEqual(["/articles/node/", "/articles/s/node2/"]);
  });

  it("index.html は、末尾にスラッシュを付けたディレクトリのパスにする", () => {
    expect(pagePath("articles/a/index.html")).toBe("/articles/a/");
    expect(pagePath("404.html")).toBe("/404.html");
  });
});

describe("cross-origin isolation のヘッダの規則", () => {
  it("末尾のスラッシュの有無の両方に、COOP と COEP を返す", () => {
    expect(isolationHeaders(["/articles/a/"])).toBe(
      [
        "/articles/a",
        "  Cross-Origin-Opener-Policy: same-origin",
        "  Cross-Origin-Embedder-Policy: require-corp",
        "",
        "/articles/a/",
        "  Cross-Origin-Opener-Policy: same-origin",
        "  Cross-Origin-Embedder-Policy: require-corp",
        "",
      ].join("\n"),
    );
  });

  it("ページが無いときは空にする", () => {
    expect(isolationHeaders([])).toBe("");
  });
});
