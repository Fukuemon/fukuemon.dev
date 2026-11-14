import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import type { Element, Root } from "hast";
import type { PlaygroundProject, PlaygroundTool } from "@fukuemon/playground-project";
import { rehypePlayground } from "./rehype-playground";

const ORIGIN = "https://play.example";
const ARTICLE = "/site/articles/series-a/intro.md";

function project(tool: PlaygroundTool): PlaygroundProject {
  const common = { version: "v", files: { "a.txt": "" }, open: "a.txt" };
  return tool === "node" ? { tool, ...common, start: [] } : { tool, ...common };
}

function run(md: string, tools: Record<string, PlaygroundTool>, contentId: unknown = "intro") {
  const dirs: string[] = [];
  const tree = unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true })
    .runSync(unified().use(remarkParse).parse(md)) as Root;
  const read = (dir: string) => {
    dirs.push(dir);
    const tool = tools[dir.split("/").at(-1) as string];
    if (tool === undefined) throw new Error(`無い: ${dir}`);
    return project(tool);
  };
  rehypePlayground({ origin: ORIGIN, readProject: read })(tree, {
    path: ARTICLE,
    data: { astro: { frontmatter: { contentId } } },
  });
  return { tree, dirs };
}

const fence = (name: string) => `\`\`\`playground\n${name}\n\`\`\``;
const first = (tree: Root) => tree.children.find((n): n is Element => n.type === "element");

describe("実行環境の埋め込みの置き換え", () => {
  it("フェンスを、iframe の URL を持つ要素とボタンに置き換える", () => {
    const embed = first(run(fence("server"), { server: "node" }).tree) as Element;
    expect(embed.tagName).toBe("div");
    expect(embed.properties.dataPlaygroundTool).toBe("node");
    expect(embed.properties.dataPlaygroundSrc).toBe(`${ORIGIN}/node/?project=intro/server`);
    const button = embed.children[0] as Element;
    expect(button.tagName).toBe("button");
    expect(button.children).toStrictEqual([{ type: "text", value: "Node の実行環境を開く" }]);
  });

  it("プロジェクトを、記事の Markdown があるディレクトリの playground/<名前>/ から読む", () => {
    expect(run(fence("server"), { server: "node" }).dirs).toStrictEqual([
      "/site/articles/series-a/playground/server",
    ]);
  });

  it.each([
    ["sql", "SQL のツールを開く"],
    ["go", "Go のツールを開く"],
  ] as const)("%s のツールのパスとボタンの文言にする", (tool, label) => {
    const embed = first(run(fence("x"), { x: tool }).tree) as Element;
    expect(embed.properties.dataPlaygroundSrc).toBe(`${ORIGIN}/${tool}/?project=intro/x`);
    expect(JSON.stringify(embed)).toContain(label);
  });

  it("ほかの言語のフェンスは変えない", () => {
    expect(first(run("```js\nserver\n```", {}).tree)?.tagName).toBe("pre");
  });

  it("名前の形が違うときは失敗する", () => {
    expect(() => run(fence("Bad_Name"), {})).toThrow("埋め込みの名前の形が違う");
  });

  it("同じ名前を 2 回埋め込むと失敗する", () => {
    expect(() => run(`${fence("x")}\n\n${fence("x")}`, { x: "sql" })).toThrow("重なっている");
  });

  it("プロジェクトのディレクトリが無いときは失敗する", () => {
    expect(() => run(fence("missing"), {})).toThrow("無い");
  });

  it("contentId が無いときは失敗する", () => {
    expect(() => run(fence("x"), { x: "sql" }, null)).toThrow("contentId が無い");
  });

  it("SQL のツールだけの記事には、別の origin の画像を置ける", () => {
    expect(() =>
      run(`![a](https://cdn.example/a.png)\n\n${fence("x")}`, { x: "sql" }),
    ).not.toThrow();
  });
});

describe("Node の実行環境を埋め込む記事のチェック", () => {
  it("別の origin の画像があると失敗する", () => {
    expect(() => run(`![a](https://cdn.example/a.png)\n\n${fence("x")}`, { x: "node" })).toThrow(
      "https://cdn.example/a.png",
    );
  });

  it("Markdown に直に書いた、別の origin の iframe があると失敗する", () => {
    const md = `<iframe src="https://embed.example/x"></iframe>\n\n${fence("x")}`;
    expect(() => run(md, { x: "node" })).toThrow("https://embed.example/x");
  });

  it("同じ origin の画像は置ける", () => {
    expect(() => run(`![a](/figures/a.svg)\n\n${fence("x")}`, { x: "node" })).not.toThrow();
  });

  it("SQL か Go のツールを一緒に埋め込むと失敗する", () => {
    expect(() => run(`${fence("x")}\n\n${fence("y")}`, { x: "node", y: "go" })).toThrow(
      "SQL か Go のツールを、同じ記事に埋め込めない",
    );
  });
});
