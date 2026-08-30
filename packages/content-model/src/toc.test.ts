import { describe, expect, it } from "vitest";
import { buildToc, type Heading } from "./toc.js";

const h = (slug: string, text = slug, depth = 2): Heading => ({ depth, slug, text });

describe("buildToc", () => {
  it("h2 が無ければ空", () => {
    expect(buildToc("本文", [h("a", "a", 3)])).toStrictEqual([]);
  });

  it("見出しが無ければ空", () => {
    expect(buildToc("## 一\n\n本文", [])).toStrictEqual([]);
  });

  it("章の本文量を weight にする", () => {
    const md = "## 一\n\nあいうえお\n\n## 二\n\nあ";
    const toc = buildToc(md, [h("一"), h("二")]);
    expect(toc[0]?.weight).toBe(5);
    expect(toc[1]?.weight).toBe(1);
  });

  it("見出しの行そのものを数えない", () => {
    const toc = buildToc("## とても長い見出しの文字列\n\nあ", [h("一")]);
    expect(toc[0]?.weight).toBe(1);
  });

  it("コードフェンスの中身を数えない", () => {
    const md = "## 一\n\nあ\n\n```sql\nselect * from very_long_table_name_here;\n```";
    expect(buildToc(md, [h("一")])[0]?.weight).toBe(1);
  });

  it("最初の h2 より前の本文を数えない", () => {
    const md = "前書きの長い文章です\n\n## 一\n\nあ";
    expect(buildToc(md, [h("一")])[0]?.weight).toBe(1);
  });

  it("h3 で章を区切らない", () => {
    // あ(1) + ### 小見出し(8) + いう(2) = 11。h3 の行そのものも本文量に数える
    const md = "## 一\n\nあ\n\n### 小見出し\n\nいう";
    expect(buildToc(md, [h("一")])[0]?.weight).toBe(11);
  });

  it("見出しより章が少なければ weight は 0 になる", () => {
    const toc = buildToc("## 一\n\nあ", [h("一"), h("二")]);
    expect(toc[1]?.weight).toBe(0);
  });

  it("本文に h2 が 1 つも無ければ weight は 0", () => {
    // 見出しの一覧は h2 を主張するが本文には無い、という食い違いでも落ちない
    expect(buildToc("本文だけ", [h("一")])[0]?.weight).toBe(0);
  });

  it("slug と text をそのまま渡す", () => {
    const toc = buildToc("## 一\n\nあ", [h("sec-1", "第 1 章")]);
    expect(toc[0]).toStrictEqual({ slug: "sec-1", text: "第 1 章", weight: 1 });
  });

  it("フェンスが閉じていなくても落ちない", () => {
    expect(() => buildToc("## 一\n\n```sql\nselect 1;", [h("一")])).not.toThrow();
  });
});
