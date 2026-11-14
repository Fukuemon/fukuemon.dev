import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkGfm from "remark-gfm";
import type { Element, Root } from "hast";
import { rehypeMermaid } from "./rehype-mermaid";
import { rehypeScrollBox } from "./rehype-scroll-box";

function run(md: string): Root {
  const tree = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .runSync(unified().use(remarkParse).use(remarkGfm).parse(md)) as Root;
  rehypeMermaid()(tree);
  rehypeScrollBox()(tree);
  return tree;
}

const first = (tree: Root) => tree.children.find((n): n is Element => n.type === "element")!;

describe("横に送れる枠", () => {
  it("表を、名前が「表」のフォーカスできる領域で包む", () => {
    const box = first(run("| a | b |\n| - | - |\n| 1 | 2 |"));
    expect([box.tagName, box.properties, (box.children[0] as Element).tagName]).toStrictEqual([
      "div",
      { className: ["scroll-box"], tabIndex: 0, role: "region", ariaLabel: "表" },
      "table",
    ]);
  });

  it("Pele の図を、名前が「図」の領域で包む", () => {
    const box = first(run("```mermaid\nflowchart LR\n  A --> B\n```"));
    expect([box.properties.ariaLabel, (box.children[0] as Element).tagName]).toStrictEqual([
      "図",
      "svg",
    ]);
  });

  it("入れ子の要素の中の表も包む", () => {
    const quote = first(run("> | a |\n> | - |\n> | 1 |"));
    const inner = quote.children.find((n): n is Element => n.type === "element")!;
    expect(inner.properties.className).toStrictEqual(["scroll-box"]);
  });

  it("Pele の class の無い svg と、ほかの要素は包まない", () => {
    const tree: Root = {
      type: "root",
      children: [
        { type: "element", tagName: "svg", properties: {}, children: [] },
        { type: "element", tagName: "p", properties: {}, children: [] },
      ],
    };
    rehypeScrollBox()(tree);
    expect(tree.children.map((n) => (n as Element).tagName)).toStrictEqual(["svg", "p"]);
  });
});
