import type { Root, Element } from "hast";

/**
 * 本文の表を `<div class="scroll-x">` で包む。
 * 表を `display: block` にすると `thead` と `tbody` の列が揃わないため。
 */
export function rehypeScrollTable() {
  return (tree: Root) => {
    walk(tree);
  };
}

function walk(node: Root | Element): void {
  node.children = node.children.map((child) => {
    if (child.type !== "element") return child;
    if (child.tagName !== "table") {
      walk(child);
      return child;
    }
    return {
      type: "element",
      tagName: "div",
      properties: { className: ["scroll-x"] },
      children: [child],
    } satisfies Element;
  });
}
