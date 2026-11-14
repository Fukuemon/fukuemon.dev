import type { Element, ElementContent, Root, RootContent } from "hast";
import {
  type PlaygroundProject,
  type PlaygroundTool,
  isEmbedName,
} from "@fukuemon/playground-project";
import { buttonClassName } from "@fukuemon/ui/button-class-name";
import { fromHtml } from "hast-util-from-html";
import { PLAYGROUND_LANG, embedId, embedUrl, projectDir, readProject } from "./project";
import { replaceFences } from "../rehype-fence";
import { PLAYGROUND_ORIGIN } from "./origin";

// 本文は React を配らないので、Button と同じクラスを素の <button> に付ける
const OPEN_BUTTON_CLASS = buttonClassName({ variant: "secondary", size: "M" }).split(" ");

const TOOL_NAME: Record<PlaygroundTool, string> = {
  node: "Node の実行環境",
  sql: "SQL のツール",
  go: "Go のツール",
};

/** rehypePlayground が書いた、Node の実行環境を埋め込む要素か */
export const isNodeEmbed = (el: Element) =>
  el.properties.dataPlaygroundEmbed !== undefined && el.properties.dataPlaygroundTool === "node";

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
    transform(tree, file, options.origin ?? PLAYGROUND_ORIGIN, options.readProject ?? readProject);

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
  if (file.path === undefined) throw new Error("記事のパスが分からない");
  const contentId = file.data.astro?.frontmatter?.contentId;
  if (typeof contentId !== "string") throw new Error(`${file.path}: contentId が無い`);
  if (!isEmbedName(name)) throw new Error(`${file.path}: 埋め込みの名前の形が違う: ${name}`);
  if (embeds.some((e) => e.name === name)) {
    throw new Error(`${file.path}: 埋め込みの名前が重なっている: ${name}`);
  }
  const { tool } = read(projectDir(file.path, name));
  return { name, tool, id: embedId(contentId, name) };
}

function embedElement(tool: PlaygroundTool, src: string): Element {
  const title = TOOL_NAME[tool];
  return {
    type: "element",
    tagName: "div",
    properties: {
      className: ["playground-embed"],
      dataPlaygroundEmbed: "",
      dataPlaygroundTool: tool,
      dataPlaygroundSrc: src,
      dataPlaygroundTitle: title,
    },
    children: [
      {
        type: "element",
        tagName: "button",
        properties: { type: "button", className: [...OPEN_BUTTON_CLASS, "playground-embed-open"] },
        children: [{ type: "text", value: `${title}を開きます` }],
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

const isCrossOrigin = (url: string) => /^(?:https?:)?\/\//.test(url);

/** `srcset` は、カンマで区切った「URL と幅か倍率」の並び。hast は、文字列か文字列の配列で持つ */
const srcsetUrls = (value: unknown): string[] =>
  (Array.isArray(value) ? value.join(",") : typeof value === "string" ? value : "")
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/)[0] ?? "")
    .filter((url) => url !== "");

function subresourceUrls(el: Element): string[] {
  const { src, data, poster, srcSet } = el.properties;
  return [src, data, poster]
    .filter((v): v is string => typeof v === "string")
    .concat(srcsetUrls(srcSet));
}

/**
 * 別の origin を指す `src`、`srcset`、`data`、`poster` の値。
 * Astro は rehype-raw をユーザーのプラグインの後に動かすので、Markdown に直に書いた HTML（raw）は要素にしてから見る
 */
function crossOriginSources(node: Root | RootContent | ElementContent): string[] {
  if (node.type === "raw") return crossOriginSources(fromHtml(node.value, { fragment: true }));
  if (node.type !== "root" && node.type !== "element") return [];
  const own =
    node.type === "element" && SUBRESOURCE_TAGS.has(node.tagName)
      ? subresourceUrls(node).filter(isCrossOrigin)
      : [];
  return [...own, ...node.children.flatMap(crossOriginSources)];
}
