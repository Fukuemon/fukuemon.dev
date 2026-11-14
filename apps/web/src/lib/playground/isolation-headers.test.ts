import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  findNodeEmbedPages,
  isolationHeaders,
  pagePath,
  playgroundIsolationHeaders,
} from "./isolation-headers";

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
const HANDWRITTEN = "/*\n  X-Content-Type-Options: nosniff\n";
const rule = (path: string) =>
  `${path}\n  Cross-Origin-Opener-Policy: same-origin\n  Cross-Origin-Embedder-Policy: require-corp\n`;

describe("Node の実行環境を埋め込むページを集める", () => {
  it("Node の実行環境を埋め込むページだけを集め、SQL だけと埋め込まないページと、属性を本文に書いただけのページを除く", () => {
    const dir = dist({
      "articles/node/index.html": NODE,
      "articles/s/node2/index.html": `${SQL}${NODE}`,
      "articles/sql/index.html": SQL,
      "articles/plain/index.html": "<p>本文</p>",
      "articles/quoted/index.html":
        '<p><code>data-playground-embed data-playground-tool="node"</code></p>',
      "playground-projects/a/b.json": NODE,
    });
    expect(findNodeEmbedPages(dir)).toStrictEqual(["/articles/node/", "/articles/s/node2/"]);
  });

  it.each([
    ["articles/a/index.html", "/articles/a/"],
    ["index.html", "/"],
    ["404.html", "/404.html"],
  ])("出力の %s を、配信のパス %s にする", (file, path) => {
    expect(pagePath(file)).toBe(path);
  });
});

describe("cross-origin isolation のヘッダの規則", () => {
  it("末尾のスラッシュの有無の両方に、COOP と COEP を返す", () => {
    expect(isolationHeaders(["/articles/a/"])).toBe(
      [rule("/articles/a"), rule("/articles/a/")].join("\n"),
    );
  });

  it("/ には、スラッシュを外した規則を作らない", () => {
    expect(isolationHeaders(["/"])).toBe(rule("/"));
  });

  it("ページが無いときは空にする", () => {
    expect(isolationHeaders([])).toBe("");
  });
});

describe("ビルドの最後に _headers に足す", () => {
  type BuildDone = (args: { dir: URL; logger: { info: (m: string) => void } }) => void;

  const runHook = (dir: string) => {
    const hook = playgroundIsolationHeaders().hooks["astro:build:done"] as unknown as BuildDone;
    hook({ dir: pathToFileURL(`${dir}/`), logger: { info: vi.fn() } });
    return readFileSync(join(dir, "_headers"), "utf8");
  };

  it("手書きの規則を残したまま、末尾に Node の実行環境を埋め込むページの規則を足す", () => {
    const dir = dist({ _headers: HANDWRITTEN, "a/index.html": NODE });
    expect(runHook(dir)).toBe(`${HANDWRITTEN}\n${rule("/a")}\n${rule("/a/")}`);
  });

  it("Node の実行環境を埋め込むページが無いときは、_headers を変えない", () => {
    const dir = dist({ _headers: HANDWRITTEN, "a/index.html": SQL });
    expect(runHook(dir)).toBe(HANDWRITTEN);
  });

  it("_headers が無いときは、規則だけの _headers を作る", () => {
    const dir = dist({ "a/index.html": NODE });
    expect(runHook(dir)).toBe(`\n\n${rule("/a")}\n${rule("/a/")}`);
  });
});
