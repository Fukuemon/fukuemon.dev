import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";

/** rehypePlayground が、Node の実行環境を埋め込む要素に付ける属性 */
const NODE_EMBED = /data-playground-tool="node"/;

/** 出力の HTML のパスから、配信する URL のパスを返す。`a/index.html` は `/a/` になる */
export function pagePath(htmlPath: string): string {
  const path = `/${htmlPath.split(sep).join("/")}`;
  return path.endsWith("/index.html") ? path.slice(0, -"index.html".length) : path;
}

/** Node の実行環境を埋め込むページのパスごとに、cross-origin isolation のヘッダの規則を返す (ADR-0034) */
export function isolationHeaders(paths: readonly string[]): string {
  return paths
    .flatMap((path) => {
      // 末尾のスラッシュの無い URL は、Workers Static Assets がリダイレクトする前に規則を当てる
      const bare = path.length > 1 && path.endsWith("/") ? [path.slice(0, -1)] : [];
      return [...bare, path];
    })
    .map(
      (path) =>
        `${path}\n  Cross-Origin-Opener-Policy: same-origin\n  Cross-Origin-Embedder-Policy: require-corp\n`,
    )
    .join("\n");
}

/** 出力のディレクトリの HTML のうち、Node の実行環境を埋め込むページのパス */
export function findNodeEmbedPages(distDir: string): string[] {
  return readdirSync(distDir, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".html"))
    .filter((file) => NODE_EMBED.test(readFileSync(join(distDir, file), "utf8")))
    .map(pagePath)
    .sort();
}

/** ビルドの最後に、Node の実行環境を埋め込むページの規則を、出力の `_headers` の末尾に足す */
export function playgroundIsolationHeaders(): AstroIntegration {
  return {
    name: "playground-isolation-headers",
    hooks: {
      "astro:build:done": ({ dir, logger }) => {
        const distDir = fileURLToPath(dir);
        const pages = findNodeEmbedPages(distDir);
        if (pages.length === 0) return;
        const headersPath = join(distDir, "_headers");
        const current = existsSync(headersPath) ? readFileSync(headersPath, "utf8") : "";
        writeFileSync(headersPath, `${current.trimEnd()}\n\n${isolationHeaders(pages)}`);
        logger.info(`cross-origin isolation のヘッダを ${pages.length} ページに返す`);
      },
    },
  };
}
