import type { Code, Root, RootContent } from "mdast";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { PLAYGROUND_LANG } from "./rehype-playground";

function codeBlocks(node: Root | RootContent): Code[] {
  if (node.type === "code") return [node];
  return "children" in node ? node.children.flatMap(codeBlocks) : [];
}

/** 記事の Markdown の、`playground` のコードフェンスに書いた埋め込みの名前 */
export function findEmbedNames(markdown: string): string[] {
  return codeBlocks(unified().use(remarkParse).parse(markdown))
    .filter((code) => code.lang === PLAYGROUND_LANG)
    .map((code) => code.value.trim());
}
