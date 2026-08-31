import type { Root, Element, ElementContent, RootContent } from "hast";

/** `@types/hast` が知らない MDX の独自ノードを足した受け口 */
type LabNode = RootContent | { type: "mdxjsEsm" };

/**
 * ハンズオンの本文を `h2` ごとの `<section class="step">` にまとめる。
 * 最初の `h2` より前は `data-step="-1"` の「はじめに」になり、手順には数えない。
 *
 * remark ではなく rehype に置くのは、`.mdx` の JSX と `.md` の生 HTML を
 * 書き分けずに済むため。
 */
export function rehypeLabSteps() {
  return (tree: Root, file: { path?: string }) => {
    if (!(file.path ?? "").includes("/content/labs/")) return;

    const hoisted: LabNode[] = [];
    const sections: Element[] = [];
    let current: LabNode[] = [];
    let index = -1;
    let title = "はじめに";

    const flush = () => {
      if (index < 0 && current.every((n) => n.type === "text" && !n.value.trim())) {
        current = [];
        return;
      }
      sections.push(section(index, title, current));
      current = [];
    };

    for (const node of tree.children as LabNode[]) {
      if (node.type === "mdxjsEsm") {
        hoisted.push(node);
        continue;
      }
      if (node.type === "element" && node.tagName === "h2") {
        flush();
        index += 1;
        title = text(node);
      }
      current.push(node);
    }
    flush();

    tree.children = [...hoisted, ...sections] as RootContent[];
  };
}

function section(index: number, title: string, children: LabNode[]): Element {
  return {
    type: "element",
    tagName: "section",
    properties: {
      className: ["step"],
      id: `step-${index}`,
      "data-step": String(index),
      "data-title": title,
    },
    children: children as ElementContent[],
  };
}

function text(node: Element): string {
  return node.children
    .map((c) => (c.type === "text" ? c.value : c.type === "element" ? text(c) : ""))
    .join("")
    .trim();
}
