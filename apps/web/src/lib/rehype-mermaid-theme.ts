import type { Root, Element, RootContent } from "hast";
import { MERMAID_TOKENS } from "./mermaid-theme";

const PATTERN = new RegExp(Object.keys(MERMAID_TOKENS).join("|"), "gi");
const swap = (v: string) => v.replace(PATTERN, (m) => MERMAID_TOKENS[m.toLowerCase()] ?? m);

/**
 * mermaid が描いた SVG の色を、サイトのトークンへ置き換える。
 * `rehype-mermaid` の後に実行する。これで 1 枚の SVG が明暗どちらの背景でも成立する。
 */
export function rehypeMermaidTheme() {
  return (tree: Root) => {
    walk(tree, false);
  };
}

function walk(node: Root | Element, inSvg: boolean): void {
  for (const child of node.children as RootContent[]) {
    if (child.type === "text" && inSvg) {
      child.value = swap(child.value);
      continue;
    }
    if (child.type !== "element") continue;
    const svg = inSvg || child.tagName === "svg";
    if (svg) {
      for (const [k, v] of Object.entries(child.properties ?? {})) {
        if (typeof v === "string") child.properties[k] = swap(v);
      }
      if (child.tagName === "svg") child.properties.className = ["figure"];
    }
    walk(child, svg);
  }
}
