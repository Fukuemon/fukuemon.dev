import type { PlaygroundProject } from "@fukuemon/playground-project";
import { findEmbedNames } from "./embeds";
import { projectDir, readProject } from "./project";

type EmbeddingArticle = { id: string; filePath?: string; contentId: string; body?: string };

/**
 * 記事が埋め込むプロジェクトの JSON のページを並べる。
 * 同じディレクトリの 2 本の記事が同じ名前を書くと、片方のための変更がもう片方に及ぶので、失敗にする。
 */
export function planProjectPages(
  articles: readonly EmbeddingArticle[],
  read: (dir: string) => PlaygroundProject = readProject,
) {
  const owners = new Map<string, string>();
  return articles.flatMap((article) => {
    const { filePath } = article;
    if (filePath === undefined) throw new Error(`記事のパスが分からない: ${article.id}`);
    return findEmbedNames(article.body ?? "").map((name) => {
      const dir = projectDir(filePath, name);
      const owner = owners.get(dir);
      if (owner !== undefined && owner !== article.id) {
        throw new Error(`${dir} を、${owner} と ${article.id} の 2 本の記事が埋め込んでいる`);
      }
      owners.set(dir, article.id);
      return {
        params: { contentId: article.contentId, name },
        props: { project: read(dir) },
      };
    });
  });
}
