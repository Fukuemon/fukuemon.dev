import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import type { Root, RootContent } from "hast";
import { joinJa, rehypeJaLinebreak } from "./rehype-ja-linebreak";

const text = (n: Root | RootContent): string =>
  n.type === "text" ? n.value : "children" in n ? n.children.map(text).join("") : "";

function run(md: string): string {
  const tree = unified()
    .use(remarkParse)
    .use(remarkRehype)
    .runSync(unified().use(remarkParse).parse(md)) as Root;
  rehypeJaLinebreak()(tree);
  return text(tree);
}

describe("和文の間の改行", () => {
  it("句点の後の改行を消す", () => {
    expect(joinJa("書けます。\nデータ")).toBe("書けます。データ");
  });

  it("和文の字どうしの間の改行を消す", () => {
    expect(joinJa("書き\n込み")).toBe("書き込み");
  });

  it("句点の後なら、次が欧文でも消す", () => {
    expect(joinJa("増えます。\nWAL は")).toBe("増えます。WAL は");
  });

  it("和文と欧文の間の改行は空白として残す", () => {
    expect(joinJa("使うのは\nWAL です")).toBe("使うのは\nWAL です");
  });

  it("欧文どうしの間の改行は残す", () => {
    expect(joinJa("write\nahead")).toBe("write\nahead");
  });

  it("要素の直前の句点の後の改行を消す", () => {
    expect(run("増えます。\n`num_timed` は")).toBe("増えます。num_timed は");
  });

  it("コードの中の改行は残す", () => {
    expect(run("```\n-- 一行目。\n-- 二行目\n```")).toContain("一行目。\n-- 二行目");
  });
});
