import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { glob } from "astro/loaders";
import type { Loader } from "astro/loaders";
import { planSeries } from "@fukuemon/content-model";

export const ARTICLES_DIR = "src/content/articles";

const INDEX = /^index\.mdx?$/;

/** index.md を持つ、`articles/` 直下のディレクトリの名前 */
function seriesWithIndex(articlesDir: string): Set<string> {
  const names = new Set<string>();
  if (!existsSync(articlesDir)) return names;
  for (const dir of readdirSync(articlesDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    if (readdirSync(join(articlesDir, dir.name)).some((f) => INDEX.test(f))) names.add(dir.name);
  }
  return names;
}

/**
 * 記事を読み込んだ後に、シリーズの構造と order を検査する。
 * 検査をページの描画に任せると、そのページを使わない build で抜ける。
 * index.md は記事ではなくシリーズの定義なので、記事の collection から外す。
 */
export function articlesLoader(): Loader {
  const inner = glob({
    base: `./${ARTICLES_DIR}`,
    pattern: ["**/*.{md,mdx}", "!*/index.{md,mdx}"],
  });
  return {
    name: "articles-with-series-check",
    async load(context) {
      await inner.load(context);
      const entries = [...context.store.values()].map((e) => ({
        path: e.filePath?.slice(`${ARTICLES_DIR}/`.length) ?? e.id,
        order: (e.data as { order?: number }).order,
      }));
      const root = fileURLToPath(context.config.root);
      planSeries(entries, seriesWithIndex(join(root, ARTICLES_DIR)));
    },
  };
}
