import type { Element, Root } from "hast";

/**
 * 本文の表と、Pele が描いた図を、横に送れる枠で包む。
 * 縮めて列に収めると、表は列が潰れ、図は文字が 14px より小さくなる。
 * 枠はキーボードで送れるように、フォーカスできる名前つきの領域にする。
 * rehypeMermaid の後に動かす。
 */
export function rehypeScrollBox() {
  return (tree: Root) => {
    walk(tree);
  };
}

function boxLabel(el: Element): string | undefined {
  if (el.tagName === "table") return "表";
  const cls = el.properties.className;
  if (el.tagName === "svg" && Array.isArray(cls) && cls.includes("pele")) return "図";
  return undefined;
}

function walk(node: Root | Element): void {
  node.children = node.children.map((child) => {
    if (child.type !== "element") return child;
    const label = boxLabel(child);
    if (label === undefined) {
      walk(child);
      return child;
    }
    return {
      type: "element",
      tagName: "div",
      properties: { className: ["scroll-box"], tabIndex: 0, role: "region", ariaLabel: label },
      children: [child],
    } satisfies Element;
  });
}
