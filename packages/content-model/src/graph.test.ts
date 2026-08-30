import { describe, expect, it } from "vitest";
import {
  DanglingRelatedError,
  DuplicateContentIdError,
  buildContentGraph,
  type GraphInput,
} from "./graph.js";
import type { ContentRef } from "./types.js";

const ref = (contentId: string, over: Partial<ContentRef> = {}): ContentRef => ({
  contentId,
  type: "article",
  title: contentId,
  description: "",
  href: `/articles/${contentId}`,
  tags: ["postgres"],
  date: new Date("2026-01-01"),
  meta: [],
  ...over,
});

const input = (contentId: string, related: string[] = []): GraphInput => ({
  ref: ref(contentId),
  related,
});

describe("buildContentGraph", () => {
  it("空の入力から空のグラフを作る", () => {
    const g = buildContentGraph([]);
    expect(g.byId.size).toBe(0);
    expect(g.relatedOf.size).toBe(0);
  });

  it("contentId で引ける", () => {
    const g = buildContentGraph([input("a"), input("b")]);
    expect(g.byId.get("a")).toStrictEqual(ref("a"));
  });

  it("contentId が重複したら失敗する", () => {
    expect(() => buildContentGraph([input("a"), input("a")])).toThrow(DuplicateContentIdError);
  });

  it("重複した contentId をエラーに載せる", () => {
    try {
      buildContentGraph([input("a"), input("a")]);
      expect.unreachable("失敗するはず");
    } catch (e) {
      expect((e as DuplicateContentIdError).contentId).toBe("a");
    }
  });

  it("related の参照先が無ければ失敗する", () => {
    expect(() => buildContentGraph([input("a", ["missing"])])).toThrow(DanglingRelatedError);
  });

  it("どの参照が壊れたかをエラーに載せる", () => {
    try {
      buildContentGraph([input("a", ["missing"])]);
      expect.unreachable("失敗するはず");
    } catch (e) {
      expect((e as DanglingRelatedError).from).toBe("a");
      expect((e as DanglingRelatedError).to).toBe("missing");
    }
  });

  it("片方向に書いた related を双方向に導出する", () => {
    const g = buildContentGraph([input("a", ["b"]), input("b")]);
    expect(g.relatedOf.get("a")).toStrictEqual(["b"]);
    expect(g.relatedOf.get("b")).toStrictEqual(["a"]);
  });

  it("自分自身への参照は辺にしない", () => {
    const g = buildContentGraph([input("a", ["a"])]);
    expect(g.relatedOf.get("a")).toBeUndefined();
  });

  it("両側に書いても辺は重複しない", () => {
    const g = buildContentGraph([input("a", ["b"]), input("b", ["a"])]);
    expect(g.relatedOf.get("a")).toStrictEqual(["b"]);
    expect(g.relatedOf.get("b")).toStrictEqual(["a"]);
  });

  it("同じ相手を 2 回書いても辺は 1 本になる", () => {
    const g = buildContentGraph([input("a", ["b", "b"]), input("b")]);
    expect(g.relatedOf.get("a")).toStrictEqual(["b"]);
  });

  it("related を持たないものは relatedOf に現れない", () => {
    const g = buildContentGraph([input("a"), input("b")]);
    expect(g.relatedOf.has("a")).toBe(false);
  });

  it("3 件をまたぐ関係を導出する", () => {
    const g = buildContentGraph([input("a", ["b", "c"]), input("b"), input("c")]);
    expect(g.relatedOf.get("a")).toStrictEqual(["b", "c"]);
    expect(g.relatedOf.get("b")).toStrictEqual(["a"]);
    expect(g.relatedOf.get("c")).toStrictEqual(["a"]);
  });
});
