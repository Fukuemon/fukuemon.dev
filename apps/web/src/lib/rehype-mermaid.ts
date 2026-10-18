import type { Element, Root } from "hast";
import { fromHtml } from "hast-util-from-html";
import { render } from "pele";

/**
 * Pele は Node では書体を測れず、組み込みの Arial の字幅で箱の大きさを決める。
 * 表示の書体を同じ字幅のものにしないと、文字が箱からはみ出す (ADR-0016)。
 */
const FONT = "Arial, Helvetica, sans-serif";

/**
 * `mermaid` のコードフェンスを、ビルド時に Pele で SVG へ置き換える。
 * 色は Pele の CSS 変数に任せ、site.css がトークンへ対応させる。
 * Expressive Code より前に実行し、素の `<pre><code>` のまま拾う。
 */
export function rehypeMermaid() {
  return (tree: Root) => {
    let n = 0;
    walk(tree, (source) => toSvg(source, `mermaid-${n++}`));
  };
}

function walk(node: Root | Element, draw: (source: string) => Element): void {
  node.children = node.children.map((child) => {
    if (child.type !== "element") return child;
    const source = mermaidSource(child);
    if (source === undefined) {
      walk(child, draw);
      return child;
    }
    return draw(source);
  }) as typeof node.children;
}

function mermaidSource(pre: Element): string | undefined {
  if (pre.tagName !== "pre") return undefined;
  const code = pre.children.find((c): c is Element => c.type === "element");
  if (code?.tagName !== "code") return undefined;
  const cls = code.properties.className;
  if (!Array.isArray(cls) || !cls.includes("language-mermaid")) return undefined;
  return code.children.map((c) => (c.type === "text" ? c.value : "")).join("");
}

function toSvg(source: string, idPrefix: string): Element {
  const { svg } = render(source, { fontFamily: FONT, idPrefix });
  return fromHtml(svg, { fragment: true }).children[0] as Element;
}
