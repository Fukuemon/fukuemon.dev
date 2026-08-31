import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import type { Root } from "hast";
import { rehypeLabSteps } from "./rehype-lab-steps";

function run(md: string, path = "/x/content/labs/a.mdx") {
  const tree = unified()
    .use(remarkParse)
    .use(remarkRehype)
    .runSync(unified().use(remarkParse).parse(md)) as Root;
  rehypeLabSteps()(tree, { path });
  return tree;
}

const sections = (tree: Root) =>
  tree.children
    .filter((n) => n.type === "element" && n.tagName === "section")
    .map((n) => (n as { properties: Record<string, unknown> }).properties);

describe("面への畳み込み", () => {
  it("h2 ごとに section を作り、番号を 0 から振る", () => {
    const got = sections(run("## 一\n\n本文\n\n## 二\n"));
    expect(got.map((p) => p["data-step"])).toEqual(["0", "1"]);
    expect(got.map((p) => p["data-title"])).toEqual(["一", "二"]);
  });

  it("最初の h2 より前は -1 の面にする", () => {
    const got = sections(run("前置き\n\n## 一\n"));
    expect(got.map((p) => p["data-step"])).toEqual(["-1", "0"]);
    expect(got[0]?.["data-title"]).toBe("はじめに");
  });

  it("前置きが無ければ -1 の面を作らない", () => {
    expect(sections(run("## 一\n")).map((p) => p["data-step"])).toEqual(["0"]);
  });

  it("アンカー用の id を振る", () => {
    expect(sections(run("## 一\n")).map((p) => p.id)).toEqual(["step-0"]);
  });

  it("h2 が無ければ本文を 1 枚の -1 の面にする", () => {
    const got = sections(run("本文だけ\n"));
    expect(got.map((p) => p["data-step"])).toEqual(["-1"]);
  });

  it("見出しの中の装飾を取り除いて題を取る", () => {
    expect(sections(run("## `code` と **強調**\n"))[0]?.["data-title"]).toBe("code と 強調");
  });

  it("labs の外ではまとめない", () => {
    const tree = run("## 一\n", "/x/content/articles/a.md");
    expect(sections(tree)).toHaveLength(0);
  });

  it("本文のノードを取り除かない", () => {
    const tree = run("## 一\n\n本文\n\n## 二\n\n続き\n");
    const text = JSON.stringify(tree);
    expect(text).toContain("本文");
    expect(text).toContain("続き");
  });
});
