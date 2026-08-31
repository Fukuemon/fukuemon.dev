import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import type { Root } from "mdast";
import type { Step } from "@fukuemon/content-model";
import { remarkLab, type Runners } from "./remark-lab";

/** 実物の登録表に依存しない。ここで試すのは差し替えの手順であって、登録の中身ではない */
const FIXTURE: Runners = {
  sql: { name: "SqlRunner", path: "~/x/SqlRunner", engine: "Postgres", kind: "pglite" },
};

/** mdast の型は MDX の独自ノードを知らない。走査のためだけに広げる */
type AnyNode = { type: string; name?: string; attributes?: { name: string; value: unknown }[] };
const nodes = (tree: Root): AnyNode[] => tree.children as unknown as AnyNode[];

function run(md: string, path = "/x/content/labs/a.mdx") {
  const tree = unified().use(remarkParse).parse(md) as Root;
  const fm: Record<string, unknown> = { contentId: "a" };
  const file = { path, data: { astro: { frontmatter: fm } } };
  remarkLab({ runners: FIXTURE })(tree, file);
  return { tree, steps: (fm.labSteps ?? []) as Step[], intro: fm.labHasIntro === true };
}

describe("手順の導出", () => {
  it("h2 を手順にし、番号を 0 から振る", () => {
    const { steps } = run("## 一\n\n本文\n\n## 二\n");
    expect(steps).toEqual([
      { index: 0, title: "一" },
      { index: 1, title: "二" },
    ]);
  });

  it("h2 が無ければ手順を 0 個にする", () => {
    expect(run("本文だけ\n").steps).toEqual([]);
  });

  it("h3 を手順にしない", () => {
    expect(run("### 小見出し\n").steps).toEqual([]);
  });

  it("フェンスの中の ## を手順にしない", () => {
    expect(run("```sh\n## これはコメント\n```\n").steps).toEqual([]);
  });

  it("見出し直後の Duration を秒にする", () => {
    expect(run("## 一\n\nDuration: 05:30\n").steps[0]?.duration).toBe(330);
  });

  it("Duration の段落を本文から取り除く", () => {
    const { tree } = run("## 一\n\nDuration: 01:00\n\n本文\n");
    const text = JSON.stringify(tree);
    expect(text).not.toContain("Duration:");
    expect(text).toContain("本文");
  });

  it("2 つ目の Duration は最初の値を上書きしない", () => {
    const { steps } = run("## 一\n\nDuration: 01:00\n\nDuration: 09:00\n");
    expect(steps[0]?.duration).toBe(60);
  });

  it("Duration が無ければ duration を持たせない", () => {
    expect(run("## 一\n\n本文\n").steps[0]?.duration).toBeUndefined();
  });
});

describe("はじめにの面", () => {
  it("最初の h2 より前に本文があれば true", () => {
    expect(run("前置き\n\n## 一\n").intro).toBe(true);
  });

  it("h2 で始まれば false", () => {
    expect(run("## 一\n\n本文\n").intro).toBe(false);
  });
});

describe("実行パネル", () => {
  it("```sql run を JSX へ差し替える", () => {
    const { tree } = run("## 一\n\n```sql run\nselect 1;\n```\n");
    const node = nodes(tree).find((n) => n.type === "mdxJsxFlowElement");
    expect(node?.name).toBe("SqlRunner");
  });

  it("run が無いフェンスは触らない", () => {
    const { tree } = run("```sql\nselect 1;\n```\n");
    expect(nodes(tree).some((n) => n.type === "mdxJsxFlowElement")).toBe(false);
  });

  it("対応する部品が無い言語は触らない", () => {
    const { tree } = run("```py run\nprint(1)\n```\n");
    expect(nodes(tree).some((n) => n.type === "mdxJsxFlowElement")).toBe(false);
  });

  it("部品の import を 1 度だけ足す", () => {
    const { tree } = run("```sql run\nselect 1;\n```\n\n```sql run\nselect 2;\n```\n");
    expect(nodes(tree).filter((n) => n.type === "mdxjsEsm")).toHaveLength(1);
  });

  it(".md に run を書いたらビルドを失敗させる", () => {
    expect(() => run("```sql run\nselect 1;\n```\n", "/x/content/labs/a.md")).toThrow(/\.mdx/);
  });

  it("最初の h2 より前のパネルは手順に属さない", () => {
    const { tree } = run("```sql run\nselect 1;\n```\n\n## 一\n");
    const node = nodes(tree).find((n) => n.type === "mdxJsxFlowElement");
    const attr = node?.attributes?.find((a) => a.name === "stepIndex");
    expect(JSON.stringify(attr?.value)).toContain("-1");
  });
});

describe("frontmatter の読み取り", () => {
  it("frontmatter が無くても落ちない", () => {
    const tree = unified().use(remarkParse).parse("## 一\n") as Root;
    expect(() =>
      remarkLab({ runners: FIXTURE })(tree, { path: "/x/content/labs/a.mdx" }),
    ).not.toThrow();
  });

  it("interactive.runtime を engine の表示名に使う", () => {
    const tree = unified().use(remarkParse).parse("```sql run\nselect 1;\n```\n") as Root;
    const fm: Record<string, unknown> = {
      contentId: "a",
      interactive: { level: "embedded", runtime: "pglite" },
    };
    remarkLab({ runners: FIXTURE })(tree, {
      path: "/x/content/labs/a.mdx",
      data: { astro: { frontmatter: fm } },
    });
    expect(JSON.stringify(tree)).toContain("Postgres");
  });

  it("setup を frontmatter の labBoot へ渡す", () => {
    const tree = unified().use(remarkParse).parse("```sql run\nselect 1;\n```\n") as Root;
    const fm: Record<string, unknown> = { contentId: "a", setup: "create table t (i int);" };
    remarkLab({ runners: FIXTURE })(tree, {
      path: "/x/content/labs/a.mdx",
      data: { astro: { frontmatter: fm } },
    });
    expect((fm.labBoot as { setup?: string }).setup).toBe("create table t (i int);");
  });

  it("setup と steps を島の props へ複製しない", () => {
    const tree = unified()
      .use(remarkParse)
      .parse(
        "## 一\n\n```sql run\nselect 1;\n```\n\n## 二\n\n```sql run\nselect 2;\n```\n",
      ) as Root;
    const fm: Record<string, unknown> = { contentId: "a", setup: "create table t (i int);" };
    remarkLab({ runners: FIXTURE })(tree, {
      path: "/x/content/labs/a.mdx",
      data: { astro: { frontmatter: fm } },
    });
    expect(JSON.stringify(tree)).not.toContain("create table t");
  });

  it("全手順の SQL を labBoot に 1 度だけ集める", () => {
    const tree = unified()
      .use(remarkParse)
      .parse(
        "## 一\n\n```sql run\nselect 1;\n```\n\n## 二\n\n```sql run\nselect 2;\n```\n",
      ) as Root;
    const fm: Record<string, unknown> = { contentId: "a" };
    remarkLab({ runners: FIXTURE })(tree, {
      path: "/x/content/labs/a.mdx",
      data: { astro: { frontmatter: fm } },
    });
    expect((fm.labBoot as { steps: unknown[] }).steps).toStrictEqual([
      { step: 0, sql: "select 1;" },
      { step: 1, sql: "select 2;" },
    ]);
  });
});

describe("labs の外", () => {
  it("記事では手順を渡さない", () => {
    const tree = unified().use(remarkParse).parse("## 一\n") as Root;
    const fm: Record<string, unknown> = {};
    remarkLab({ runners: FIXTURE })(tree, {
      path: "/x/content/articles/a.md",
      data: { astro: { frontmatter: fm } },
    });
    expect(fm.labSteps).toBeUndefined();
  });
});
