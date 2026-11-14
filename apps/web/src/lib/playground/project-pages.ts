import { type PlaygroundProject, isEmbedName } from "@fukuemon/playground-project";
import { findEmbedNames } from "./embeds";
import { projectDir, readProject } from "./project";

type EmbeddingArticle = { id: string; filePath?: string; contentId: string; body?: string };

type Embedding = { articleId: string; contentId: string; name: string; dir: string };

/** 記事の Markdown から、埋め込みの名前とプロジェクトのディレクトリを並べる */
function embeddingsOf(article: EmbeddingArticle): Embedding[] {
  const { id, filePath, contentId } = article;
  if (filePath === undefined) throw new Error(`記事のパスが分からない: ${id}`);
  return findEmbedNames(article.body ?? "").map((name) => {
    if (!isEmbedName(name)) throw new Error(`${filePath}: 埋め込みの名前の形が違う: ${name}`);
    return { articleId: id, contentId, name, dir: projectDir(filePath, name) };
  });
}

/** 同じディレクトリの 2 本の記事が同じ名前を書くと、片方のための変更がもう片方に及ぶので、失敗にする */
function assertOneOwner(embeddings: readonly Embedding[]): void {
  const owners = new Map<string, string>();
  for (const { dir, articleId } of embeddings) {
    const owner = owners.get(dir) ?? articleId;
    if (owner !== articleId) {
      throw new Error(`${dir} を、${owner} と ${articleId} の 2 本の記事が埋め込んでいる`);
    }
    owners.set(dir, owner);
  }
}

/** 記事が埋め込むプロジェクトの JSON のページを並べる。 */
export function planProjectPages(
  articles: readonly EmbeddingArticle[],
  read: (dir: string) => PlaygroundProject = readProject,
) {
  const embeddings = articles.flatMap(embeddingsOf);
  assertOneOwner(embeddings);
  return embeddings.map(({ contentId, name, dir }) => ({
    params: { contentId, name },
    props: { project: read(dir) },
  }));
}
