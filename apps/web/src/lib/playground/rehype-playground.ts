import type { Element, ElementContent, Root, RootContent } from "hast";
import type { PlaygroundProject, PlaygroundTool } from "@fukuemon/playground-project";
import {
  embedId,
  embedUrl,
  isEmbedName,
  playgroundOrigin,
  projectDir,
  readProject,
} from "./project";
import { replaceFences } from "../rehype-fence";

export const PLAYGROUND_LANG = "playground";

const OPEN_LABEL: Record<PlaygroundTool, string> = {
  node: "Node の実行環境を開く",
  sql: "SQL のツールを開く",
  go: "Go のツールを開く",
};

/** COEP: require-corp の記事で、CORP を返さない別の origin から読むと止められる要素 */
const SUBRESOURCE_TAGS = new Set(["img", "iframe", "video", "audio", "source", "embed", "object"]);

type FileLike = { path?: string; data: { astro?: { frontmatter?: Record<string, unknown> } } };

type Options = {
  origin?: string;
  readProject?: (dir: string) => PlaygroundProject;
};

/**
 * `playground` のコードフェンスを、押すと実行環境の iframe を作るボタンに置き換える。
 * フェンスの中身は埋め込みの名前で、プロジェクトは記事の Markdown があるディレクトリの `playground/<名前>/` に置く。
 * Node の実行環境を埋め込む記事に、別の origin の画像と埋め込みか、SQL と Go のツールがあると、ビルドを失敗させる。
 * Expressive Code より前に動かし、素の `<pre><code>` のまま拾う。
 */
export const rehypePlayground =
  (options: Options = {}) =>
  (tree: Root, file: FileLike) =>
    transform(tree, file, options.origin ?? playgroundOrigin(), options.readProject ?? readProject);

function transform(
  tree: Root,
  file: FileLike,
  origin: string,
  read: (dir: string) => PlaygroundProject,
): void {
  const embeds: Embed[] = [];
  replaceFences(tree, PLAYGROUND_LANG, (source) => {
    const embed = resolveEmbed(file, source.trim(), embeds, read);
    embeds.push(embed);
    return embedElement(embed.tool, embedUrl(origin, embed.tool, embed.id));
  });
  if (embeds.some((e) => e.tool === "node")) assertIsolatable(tree, embeds, file.path);
}

type Embed = { name: string; tool: PlaygroundTool; id: string };

function resolveEmbed(
  file: FileLike,
  name: string,
  embeds: readonly Embed[],
  read: (dir: string) => PlaygroundProject,
): Embed {
  const contentId = file.data.astro?.frontmatter?.contentId;
  if (typeof contentId !== "string") throw new Error(`${file.path}: contentId が無い`);
  if (!isEmbedName(name)) throw new Error(`${file.path}: 埋め込みの名前の形が違う: ${name}`);
  if (embeds.some((e) => e.name === name)) {
    throw new Error(`${file.path}: 埋め込みの名前が重なっている: ${name}`);
  }
  if (file.path === undefined) throw new Error("記事のパスが分からない");
  const { tool } = read(projectDir(file.path, name));
  return { name, tool, id: embedId(contentId, name) };
}

function embedElement(tool: PlaygroundTool, src: string): Element {
  const label = OPEN_LABEL[tool];
  return {
    type: "element",
    tagName: "div",
    properties: {
      className: ["playground-embed"],
      dataPlaygroundEmbed: "",
      dataPlaygroundTool: tool,
      dataPlaygroundSrc: src,
      dataPlaygroundLabel: label,
    },
    children: [
      {
        type: "element",
        tagName: "button",
        properties: { type: "button", className: ["playground-embed-open"] },
        children: [{ type: "text", value: label }],
      },
    ],
  };
}

function assertIsolatable(tree: Root, embeds: readonly Embed[], path: string | undefined): void {
  const others = embeds.filter((e) => e.tool !== "node").map((e) => e.name);
  if (others.length > 0) {
    throw new Error(
      `${path}: Node の実行環境と、SQL か Go のツールを、同じ記事に埋め込めない (ADR-0034): ${others.join(", ")}`,
    );
  }
  const blocked = crossOriginSources(tree);
  if (blocked.length > 0) {
    throw new Error(
      `${path}: Node の実行環境を埋め込む記事に、別の origin の画像と埋め込みを置けない (ADR-0034): ${blocked.join(", ")}`,
    );
  }
}

const SRC_ATTR = /\s(?:src|srcset|data|poster)\s*=\s*["']?\s*((?:https?:)?\/\/[^"'\s>]+)/gi;

/** 別の origin を指す `src` などの値。Markdown に直に書いた HTML（raw）の中も見る */
function crossOriginSources(node: Root | RootContent | ElementContent): string[] {
  if (node.type === "raw") return [...node.value.matchAll(SRC_ATTR)].map((m) => m[1] as string);
  if (node.type === "element" && SUBRESOURCE_TAGS.has(node.tagName)) {
    const values = ["src", "srcSet", "data", "poster"]
      .map((key) => node.properties[key])
      .filter((v): v is string => typeof v === "string" && /^(?:https?:)?\/\//.test(v));
    return [...values, ...node.children.flatMap(crossOriginSources)];
  }
  if (node.type === "root" || node.type === "element")
    return node.children.flatMap(crossOriginSources);
  return [];
}
