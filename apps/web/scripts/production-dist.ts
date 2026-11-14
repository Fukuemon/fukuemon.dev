import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

type Article = { id: string; contentId: string; verificationOnly: boolean };

/** 原稿の frontmatter から、書き出し先の判定に要る値を読む */
export function parseArticle(id: string, source: string): Article {
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source)?.[1] ?? "";
  const value = (key: string) => new RegExp(`^${key}:\\s*(.+?)\\s*$`, "m").exec(front)?.[1];
  return {
    id,
    contentId: value("contentId") ?? "",
    verificationOnly: value("verificationOnly") === "true",
  };
}

/**
 * 本番の dist に出てはいけないパスを返す。
 * 検証用の記事のページとプロジェクトの JSON と、検証用の記事だけのシリーズのページが対象である
 */
export function forbiddenPaths(
  articles: readonly Article[],
  exists: (p: string) => boolean,
): string[] {
  const found: string[] = [];
  for (const a of articles.filter((x) => x.verificationOnly)) {
    for (const p of [`articles/${a.id}`, `playground-projects/${a.contentId}`]) {
      if (exists(p)) found.push(p);
    }
  }
  const dirs = new Set(
    articles.flatMap((a) => (a.id.includes("/") ? [a.id.split("/")[0] as string] : [])),
  );
  for (const dir of dirs) {
    const inSeries = articles.filter((a) => a.id.startsWith(`${dir}/`));
    if (inSeries.every((a) => a.verificationOnly) && exists(`series/${dir}`))
      found.push(`series/${dir}`);
  }
  return found;
}

function listArticleFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter(
      (e) =>
        e.isFile() &&
        /\.mdx?$/.test(e.name) &&
        !/(^|[\\/])(index\.mdx?|playground)([\\/]|$)/.test(join(e.parentPath, e.name)),
    )
    .map((e) => join(e.parentPath, e.name));
}

/** `articles/` の原稿を読み、本番の dist に検証用の記事の出力があれば、パスを返す */
export function checkProductionDist(articlesDir: string, distDir: string): string[] {
  const articles = listArticleFiles(articlesDir)
    .filter((f) => !/[\\/]playground[\\/]/.test(f) && !/[\\/]index\.mdx?$/.test(f))
    .map((f) =>
      parseArticle(relative(articlesDir, f).replace(/\.mdx?$/, ""), readFileSync(f, "utf8")),
    );
  return forbiddenPaths(articles, (p) => existsSync(join(distDir, p)));
}
