import { describe, expect, it } from "vitest";

import { type Selection, initialSelection, selectionReducer } from "./selection";

const state = (overrides: Partial<Selection> = {}): Selection => ({
  ...initialSelection("index.js"),
  ...overrides,
});

describe("selectionReducer", () => {
  it("最初は、プロジェクトの open のファイルを開いて選ぶ", () => {
    expect(initialSelection("index.js")).toStrictEqual({
      treeItem: "index.js",
      openFiles: ["index.js"],
      activeFile: "index.js",
    });
  });

  it("ツリーでファイルを選ぶと、タブに足して選ぶ", () => {
    expect(
      selectionReducer(state(), { type: "select-item", path: "a.js", isFile: true }),
    ).toMatchObject({
      treeItem: "a.js",
      openFiles: ["index.js", "a.js"],
      activeFile: "a.js",
    });
  });

  it("開いているファイルを選び直しても、タブを増やさない", () => {
    const next = selectionReducer(state(), { type: "select-item", path: "index.js", isFile: true });
    expect(next.openFiles).toStrictEqual(["index.js"]);
  });

  it("ツリーでディレクトリを選んでも、タブは変えない", () => {
    expect(
      selectionReducer(state(), { type: "select-item", path: "src", isFile: false }),
    ).toStrictEqual({
      ...state(),
      treeItem: "src",
    });
  });

  it("タブを選ぶと、ツリーでもそのファイルを選ぶ", () => {
    const opened = state({ openFiles: ["index.js", "a.js"] });
    expect(selectionReducer(opened, { type: "select-tab", path: "a.js" })).toMatchObject({
      activeFile: "a.js",
      treeItem: "a.js",
    });
  });

  it("選んでいるタブを閉じると、同じ位置のタブを選ぶ。最後のタブなら、1 つ前を選ぶ", () => {
    const opened = state({ openFiles: ["a.js", "b.js", "c.js"], activeFile: "b.js" });
    expect(selectionReducer(opened, { type: "close-tab", path: "b.js" })).toMatchObject({
      openFiles: ["a.js", "c.js"],
      activeFile: "c.js",
    });
    const last = state({ openFiles: ["a.js", "b.js"], activeFile: "b.js" });
    expect(selectionReducer(last, { type: "close-tab", path: "b.js" }).activeFile).toBe("a.js");
  });

  it("選んでいないタブを閉じても、選んでいるタブは変えない。全て閉じると、選ぶタブが無くなる", () => {
    const opened = state({ openFiles: ["a.js", "b.js"], activeFile: "a.js" });
    expect(selectionReducer(opened, { type: "close-tab", path: "b.js" }).activeFile).toBe("a.js");
    expect(selectionReducer(state(), { type: "close-tab", path: "index.js" })).toMatchObject({
      openFiles: [],
      activeFile: undefined,
    });
  });

  it("名前を変えると、開いたファイルと選んだ項目を、新しいパスにする。ディレクトリの下も移す", () => {
    const opened = state({
      treeItem: "src",
      openFiles: ["src/a.js", "index.js"],
      activeFile: "src/a.js",
    });
    expect(selectionReducer(opened, { type: "renamed", from: "src", to: "lib" })).toMatchObject({
      treeItem: "lib",
      openFiles: ["lib/a.js", "index.js"],
      activeFile: "lib/a.js",
    });
  });

  it("削除すると、その下のファイルのタブを閉じ、選んだ項目を外す", () => {
    const opened = state({
      treeItem: "src",
      openFiles: ["src/a.js", "index.js"],
      activeFile: "src/a.js",
    });
    expect(selectionReducer(opened, { type: "removed", path: "src" })).toMatchObject({
      treeItem: undefined,
      openFiles: ["index.js"],
      activeFile: "index.js",
    });
  });

  it("関係の無いパスを削除しても、選んだものは変えない", () => {
    expect(selectionReducer(state(), { type: "removed", path: "src" })).toStrictEqual(state());
  });

  it("端末のタブとプレビューのタブを選ぶ", () => {
    const terminal = selectionReducer(state(), { type: "select-terminal", id: "2" });
    expect(selectionReducer(terminal, { type: "select-preview", port: 3001 })).toMatchObject({
      terminal: "2",
      preview: 3001,
    });
  });
});
