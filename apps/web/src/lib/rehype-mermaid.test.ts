import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import type { Element, Root } from "hast";
import { rehypeMermaid } from "./rehype-mermaid";

function run(md: string): Root {
  const tree = unified()
    .use(remarkParse)
    .use(remarkRehype)
    .runSync(unified().use(remarkParse).parse(md)) as Root;
  rehypeMermaid()(tree);
  return tree;
}

const tags = (tree: Root) =>
  tree.children.filter((n): n is Element => n.type === "element").map((n) => n.tagName);

const FENCE = "```mermaid\nflowchart LR\n  A[索引] --> B[ヒープ]\n```";

describe("mermaid のフェンスの置き換え", () => {
  it("mermaid のフェンスを pre ごと svg に置き換える", () => {
    expect(tags(run(FENCE))).toStrictEqual(["svg"]);
  });

  it("svg に Pele の class を付けたまま残す", () => {
    const svg = run(FENCE).children[0] as Element;
    expect(svg.properties.className).toStrictEqual(["pele", "pele-flowchart"]);
  });

  it("ラベルの文字を svg の中に残す", () => {
    expect(JSON.stringify(run(FENCE))).toContain("ヒープ");
  });

  it("入れ子の要素の中のフェンスも置き換える", () => {
    const quote = run(`> ${FENCE.replaceAll("\n", "\n> ")}`).children[0] as Element;
    expect(
      quote.children.filter((n): n is Element => n.type === "element").map((n) => n.tagName),
    ).toStrictEqual(["svg"]);
  });

  it("図ごとに id の接頭辞を変え、1 つのページで id を重ねない", () => {
    const titled = "```mermaid\nflowchart LR\n  accTitle: 図\n  A --> B\n```";
    const html = JSON.stringify(run(`${titled}\n\n${titled}`));
    expect([html.includes("mermaid-0-title"), html.includes("mermaid-1-title")]).toStrictEqual([
      true,
      true,
    ]);
  });
});

describe("置き換えないもの", () => {
  it.each([
    ["ほかの言語のフェンス", "```sql\nselect 1;\n```"],
    ["言語の無いフェンス", "```\nflowchart LR\n```"],
    ["インラインのコード", "`mermaid`"],
  ])("%s は残す", (_, md) => {
    expect(tags(run(md))).not.toContain("svg");
  });

  it("code の中の文字でないノードを図の元に含めない", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "pre",
          properties: {},
          children: [
            {
              type: "element",
              tagName: "code",
              properties: { className: ["language-mermaid"] },
              children: [
                { type: "text", value: "flowchart LR\n  A --> B\n" },
                { type: "comment", value: "A --> C" },
              ],
            },
          ],
        },
      ],
    };
    rehypeMermaid()(tree);
    expect(JSON.stringify(tree)).not.toContain('"dataId":"C"');
  });

  it("code を含まない pre は残す", () => {
    const tree: Root = {
      type: "root",
      children: [{ type: "element", tagName: "pre", properties: {}, children: [] }],
    };
    rehypeMermaid()(tree);
    expect(tags(tree)).toStrictEqual(["pre"]);
  });
});

it("構文の誤った図はビルドを失敗させる", () => {
  expect(() => run("```mermaid\nflowchart LR\n  A[ --> \n```")).toThrow();
});
