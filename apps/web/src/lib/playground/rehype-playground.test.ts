import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import type { Element, Root } from "hast";
import type { PlaygroundProject, PlaygroundTool } from "@fukuemon/playground-project";
import { buttonClassName } from "@fukuemon/ui/button-class-name";
import { isNodeEmbed, rehypePlayground } from "./rehype-playground";

const ORIGIN = "https://play.example";
const ARTICLE = "/site/articles/series-a/intro.md";

function project(tool: PlaygroundTool): PlaygroundProject {
  const common = { version: "v", files: { "a.txt": "" }, open: "a.txt" };
  return tool === "node" ? { tool, ...common, start: [] } : { tool, ...common };
}

type Run = { contentId?: unknown; path?: string };

function run(md: string, tools: Record<string, PlaygroundTool>, opts: Run = {}) {
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
  const contentId = "contentId" in opts ? opts.contentId : "intro";
  const path = "path" in opts ? opts.path : ARTICLE;
  rehypePlayground({ origin: ORIGIN, readProject: read })(tree, {
    path,
    data: { astro: { frontmatter: { contentId } } },
  });
  return { tree, dirs };
}

const fence = (name: string) => `\`\`\`playground\n${name}\n\`\`\``;
const first = (tree: Root) => tree.children.find((n): n is Element => n.type === "element");

const embed = (tool: PlaygroundTool, title: string, name: string): Element => ({
  type: "element",
  tagName: "div",
  properties: {
    className: ["playground-embed"],
    dataPlaygroundEmbed: "",
    dataPlaygroundTool: tool,
    dataPlaygroundSrc: `${ORIGIN}/${tool}/?project=intro/${name}`,
    dataPlaygroundTitle: title,
  },
  children: [
    {
      type: "element",
      tagName: "button",
      properties: {
        type: "button",
        className: [
          ...buttonClassName({ variant: "secondary", size: "M" }).split(" "),
          "playground-embed-open",
        ],
      },
      children: [{ type: "text", value: `${title}を開きます` }],
    },
  ],
});

describe("実行環境の埋め込みの置き換え", () => {
  it.each([
    ["node", "Node の実行環境"],
    ["sql", "SQL のツール"],
    ["go", "Go のツール"],
  ] as const)("%s のフェンスを、iframe の URL を持つ要素とボタンに置き換える", (tool, title) => {
    expect(first(run(fence("x"), { x: tool }).tree)).toStrictEqual(embed(tool, title, "x"));
  });

  it("プロジェクトを、記事の Markdown があるディレクトリの playground/<名前>/ から読む", () => {
    expect(run(fence("server"), { server: "node" }).dirs).toStrictEqual([
      "/site/articles/series-a/playground/server",
    ]);
  });

  it("ほかの言語のフェンスは変えない", () => {
    expect(first(run("```js\nserver\n```", {}).tree)?.tagName).toBe("pre");
  });

  it.each([
    ["名前の形が違う", fence("Bad_Name"), {}, "埋め込みの名前の形が違う"],
    ["同じ名前を 2 回埋め込む", `${fence("x")}\n\n${fence("x")}`, {}, "重なっている"],
    ["プロジェクトのディレクトリが無い", fence("missing"), {}, "無い"],
    ["contentId が無い", fence("x"), { contentId: null }, "contentId が無い"],
    ["記事のパスが分からない", fence("x"), { path: undefined }, "記事のパスが分からない"],
  ] as const)("%s ときは失敗する", (_, md, opts: Run, message) => {
    expect(() => run(md, { x: "sql" }, opts)).toThrow(message);
  });

  it("SQL のツールだけの記事には、別の origin の画像を置ける", () => {
    expect(() =>
      run(`![a](https://cdn.example/a.png)\n\n${fence("x")}`, { x: "sql" }),
    ).not.toThrow();
  });
});

describe("Node の実行環境を埋め込む記事のチェック", () => {
  it.each([
    ["Markdown の画像", "![a](https://cdn.example/a.png)", "https://cdn.example/a.png"],
    [
      "直に書いた iframe",
      '<iframe src="https://embed.example/x"></iframe>',
      "https://embed.example/x",
    ],
    ["プロトコルを省いた src", '<img src="//cdn.example/b.png">', "//cdn.example/b.png"],
    [
      "srcset の 2 つ目の候補",
      '<img src="/a.png" srcset="/a.png 1x, https://cdn.example/a2.png 2x">',
      "https://cdn.example/a2.png",
    ],
    [
      "video の poster",
      '<video poster="https://cdn.example/p.png"></video>',
      "https://cdn.example/p.png",
    ],
  ])("%s が別の origin を指すと失敗する", (_, html, url) => {
    expect(() => run(`${html}\n\n${fence("x")}`, { x: "node" })).toThrow(url);
  });

  it("同じ origin の画像は置ける", () => {
    expect(() =>
      run(`![a](/figures/a.svg)\n\n<img srcset="/a.png 1x, /b.png 2x">\n\n${fence("x")}`, {
        x: "node",
      }),
    ).not.toThrow();
  });

  it("SQL か Go のツールを一緒に埋め込むと失敗する", () => {
    expect(() => run(`${fence("x")}\n\n${fence("y")}`, { x: "node", y: "go" })).toThrow(
      "SQL か Go のツールを、同じ記事に埋め込めない",
    );
  });
});

describe("Node の実行環境を埋め込む要素の判定", () => {
  const paragraph: Element = {
    type: "element",
    tagName: "p",
    properties: { dataPlaygroundTool: "node" },
    children: [],
  };

  it.each([
    ["Node の埋め込み", embed("node", "Node の実行環境", "x"), true],
    ["SQL の埋め込み", embed("sql", "SQL のツール", "x"), false],
    ["埋め込みの印の無い要素", paragraph, false],
  ] as const)("%s を %s にする", (_, el, expected) => {
    expect(isNodeEmbed(el)).toBe(expected);
  });
});
