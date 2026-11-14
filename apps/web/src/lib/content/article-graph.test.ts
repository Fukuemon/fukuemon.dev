import { describe, expect, it } from "vitest";
import { type ArticleGraphSource, assertContentGraph } from "./article-graph";

const article = (id: string, contentId: string, related: string[] = []): ArticleGraphSource => ({
  id,
  data: {
    contentId,
    title: `題 ${id}`,
    description: `説明 ${id}`,
    tags: ["検証"],
    status: "draft",
    publishedAt: new Date("2026-11-01"),
    format: "page",
    related,
  },
});

describe("assertContentGraph", () => {
  it("重複も誤りも無ければ throw しない", () => {
    expect(() =>
      assertContentGraph([article("a", "a", ["b"]), article("rdbms/b", "b")]),
    ).not.toThrow();
  });

  it("contentId が重複していたら、両方の原稿のパスを付けて throw する", () => {
    expect(() => assertContentGraph([article("a", "same"), article("rdbms/b", "same")])).toThrow(
      /contentId が重複しています: same \(.*articles\/a, .*articles\/rdbms\/b\)/,
    );
  });

  it("無い contentId を指す related は、書いた原稿のパスを付けて throw する", () => {
    expect(() => assertContentGraph([article("a", "a", ["missing"])])).toThrow(
      /related の参照先が存在しません: a -> missing \(.*articles\/a\)/,
    );
  });

  it("下書きを指す related は解決できる", () => {
    expect(() => assertContentGraph([article("a", "a", ["b"]), article("b", "b")])).not.toThrow();
  });

  it("related を両方向に書いたら、両方の原稿のパスを付けて throw する", () => {
    expect(() => assertContentGraph([article("a", "a", ["b"]), article("b", "b", ["a"])])).toThrow(
      /両方向に書いています/,
    );
  });
});
