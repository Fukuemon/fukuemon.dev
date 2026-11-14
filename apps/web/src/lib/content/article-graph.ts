import {
  DanglingRelatedError,
  DuplicateContentIdError,
  MutualRelatedError,
  buildContentGraph,
} from "@fukuemon/content-model";
import { type ArticleListSource, toContentRef } from "./article-list";
import { ARTICLES_DIR } from "./articles-loader";

/** `related` を持つ、記事 1 本の値 */
export type ArticleGraphSource = ArticleListSource & { data: { related: readonly string[] } };

/**
 * 下書きも含めたすべての記事で、contentId の重複と `related` の誤りを確認する。
 * 下書きを除くと、下書きを指す `related` が解決できない参照になる。
 * 誤りがあれば、原稿のパスと contentId を付けて throw し、ビルドを失敗させる。
 */
export function assertContentGraph(articles: readonly ArticleGraphSource[]): void {
  try {
    buildContentGraph(articles.map((a) => ({ ref: toContentRef(a), related: a.data.related })));
  } catch (e) {
    throw withPaths(e, articles);
  }
}

function pathsOf(articles: readonly ArticleGraphSource[], contentId: string): string {
  return articles
    .filter((a) => a.data.contentId === contentId)
    .map((a) => `${ARTICLES_DIR}/${a.id}`)
    .join(", ");
}

function withPaths(e: unknown, articles: readonly ArticleGraphSource[]): unknown {
  if (e instanceof DuplicateContentIdError) {
    return new Error(`${e.message} (${pathsOf(articles, e.contentId)})`, { cause: e });
  }
  if (e instanceof DanglingRelatedError) {
    return new Error(`${e.message} (${pathsOf(articles, e.from)})`, { cause: e });
  }
  if (e instanceof MutualRelatedError) {
    return new Error(`${e.message} (${pathsOf(articles, e.a)}, ${pathsOf(articles, e.b)})`, {
      cause: e,
    });
  }
  return e;
}
