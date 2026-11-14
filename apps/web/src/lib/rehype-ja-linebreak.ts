import type { Element, Root, RootContent } from "hast";

/**
 * 原稿の改行のうち、和文の間にあるものを消す。
 * 原稿は 1 文 1 行で書くので、句点の後の改行が HTML では空白 1 つになり、
 * 「書けます。 データ」のように字間が空く。CSS の改行の扱いを和文に合わせる仕様は、ブラウザが実装していない。
 * 改行の前後とも和文の字のときと、改行の前が和文の約物のときに消す。和文と欧文の間は空白を残す。
 */
export function rehypeJaLinebreak() {
  return (tree: Root) => {
    walk(tree);
  };
}

const WIDE = /[　-ヿ㐀-鿿豈-﫿！-｠]/u;
const PUNCT = /[、。，．・：；？！」』）】〉》〕｝]/u;
const BREAK = /([^\s])[ \t]*\n\s*(?=([^\s]))/gu;
const KEEP = new Set(["pre", "code", "script", "style", "textarea", "svg"]);

export function joinJa(text: string): string {
  return text.replace(BREAK, (m, before: string, after: string) =>
    PUNCT.test(before) || (WIDE.test(before) && WIDE.test(after)) ? before : m,
  );
}

/** 改行が要素の境目にあるときは、その外の字が見えないので、約物の規則だけで決める */
function trimEdge(text: string): string {
  return text.replace(/([^\s])[ \t]*\n\s*$/u, (m, before: string) =>
    PUNCT.test(before) ? before : m,
  );
}

function walk(node: Root | Element): void {
  for (const child of node.children as RootContent[]) {
    if (child.type === "text") child.value = trimEdge(joinJa(child.value));
    else if (child.type === "element" && !KEEP.has(child.tagName)) walk(child);
  }
}
