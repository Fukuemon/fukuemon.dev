import type { Element, Root } from "hast";

function fenceSource(pre: Element, lang: string): string | undefined {
  if (pre.tagName !== "pre") return undefined;
  const code = pre.children.find((c): c is Element => c.type === "element");
  if (code?.tagName !== "code") return undefined;
  const cls = code.properties.className;
  if (!Array.isArray(cls) || !cls.includes(`language-${lang}`)) return undefined;
  return code.children.map((c) => (c.type === "text" ? c.value : "")).join("");
}

/** `lang` のコードフェンス（素の `<pre><code>`）を、中身の文字列から作った要素に、入れ子の中も含めて置き換える */
export function replaceFences(
  node: Root | Element,
  lang: string,
  replace: (source: string) => Element,
): void {
  node.children = node.children.map((child) => {
    if (child.type !== "element") return child;
    const source = fenceSource(child, lang);
    if (source === undefined) {
      replaceFences(child, lang, replace);
      return child;
    }
    return replace(source);
  }) as typeof node.children;
}
