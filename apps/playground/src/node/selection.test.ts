import type { ProcessInfo } from "@fukuemon/node-runtime";
import { describe, expect, it } from "vitest";

import {
  type Selection,
  initialSelection,
  selectionReducer,
  shownFiles,
  shownProcess,
} from "./selection";

const state = (overrides: Partial<Selection> = {}): Selection => ({
  ...initialSelection("index.js"),
  ...overrides,
});

describe("initialSelection", () => {
  it("プロジェクトの open のファイルを開いて選ぶ", () => {
    expect(initialSelection("index.js")).toStrictEqual({
      treeItem: "index.js",
      openFiles: ["index.js"],
      activeFile: "index.js",
    });
  });
});

describe("selectionReducer", () => {
  it("ツリーでファイルを選ぶと、タブに足して選ぶ", () => {
    expect(
      selectionReducer(state(), { type: "select-item", path: "a.js", isFile: true }),
    ).toStrictEqual({ treeItem: "a.js", openFiles: ["index.js", "a.js"], activeFile: "a.js" });
  });

  it("開いているファイルを選び直しても、タブを増やさない", () => {
    expect(
      selectionReducer(state(), { type: "select-item", path: "index.js", isFile: true }),
    ).toStrictEqual(state());
  });

  it("ツリーでディレクトリを選んでも、タブは変えない", () => {
    expect(
      selectionReducer(state(), { type: "select-item", path: "src", isFile: false }),
    ).toStrictEqual({ ...state(), treeItem: "src" });
  });

  it("タブを選ぶと、ツリーでもそのファイルを選ぶ", () => {
    const opened = state({ openFiles: ["index.js", "a.js"] });
    expect(selectionReducer(opened, { type: "select-tab", path: "a.js" })).toStrictEqual({
      treeItem: "a.js",
      openFiles: ["index.js", "a.js"],
      activeFile: "a.js",
    });
  });

  it.each([
    [
      "真ん中の選んだタブは、同じ位置のタブを選ぶ",
      ["a.js", "b.js", "c.js"],
      "b.js",
      "b.js",
      "c.js",
    ],
    ["最後の選んだタブは、1 つ前を選ぶ", ["a.js", "b.js"], "b.js", "b.js", "a.js"],
    ["選んでいないタブは、選んだタブを変えない", ["a.js", "b.js"], "a.js", "b.js", "a.js"],
    ["最後の 1 つは、選ぶタブを無くす", ["a.js"], "a.js", "a.js", undefined],
  ])("タブを閉じると、%s", (_, openFiles, activeFile, closed, expected) => {
    const opened = state({ openFiles, activeFile });
    expect(selectionReducer(opened, { type: "close-tab", path: closed }).activeFile).toBe(expected);
  });

  it("名前を変えると、開いたファイルと選んだ項目を、新しいパスにする。ディレクトリの下も移す", () => {
    const opened = state({
      treeItem: "src",
      openFiles: ["src/a.js", "index.js"],
      activeFile: "src/a.js",
    });
    expect(selectionReducer(opened, { type: "renamed", from: "src", to: "lib" })).toStrictEqual({
      treeItem: "lib",
      openFiles: ["lib/a.js", "index.js"],
      activeFile: "lib/a.js",
    });
  });

  it("選んでいない項目の名前を変えると、その項目を選ぶ。開いたファイルは変えない", () => {
    const opened = state({ treeItem: "index.js", openFiles: ["index.js"], activeFile: "index.js" });
    expect(
      selectionReducer(opened, { type: "renamed", from: "package.json", to: "pkg.json" }),
    ).toStrictEqual({
      treeItem: "pkg.json",
      openFiles: ["index.js"],
      activeFile: "index.js",
    });
  });

  it("削除すると、その下のファイルのタブを閉じ、選んだ項目を外す", () => {
    const opened = state({
      treeItem: "src",
      openFiles: ["src/a.js", "index.js"],
      activeFile: "src/a.js",
    });
    expect(selectionReducer(opened, { type: "removed", path: "src" })).toStrictEqual({
      treeItem: undefined,
      openFiles: ["index.js"],
      activeFile: "index.js",
    });
  });

  it("関係の無いパスを削除しても、選んだものは変えない", () => {
    expect(selectionReducer(state(), { type: "removed", path: "src" })).toStrictEqual(state());
  });

  it("端末のタブを選ぶ", () => {
    expect(selectionReducer(state(), { type: "select-terminal", id: "2" })).toStrictEqual({
      ...state(),
      terminal: "2",
    });
  });

  it("プレビューのタブを選ぶ", () => {
    expect(selectionReducer(state(), { type: "select-preview", port: 3001 })).toStrictEqual({
      ...state(),
      preview: 3001,
    });
  });

  it("HTTP の一覧の通信を選ぶ", () => {
    expect(selectionReducer(state(), { type: "select-exchange", id: "3" })).toStrictEqual({
      ...state(),
      exchange: "3",
    });
  });
});

const proc = (id: string, status: ProcessInfo["status"]): ProcessInfo => ({
  id,
  kind: "command",
  name: id,
  status,
});

describe("shownProcess", () => {
  const running = proc("server", { kind: "running" });
  const passed = proc("build", { kind: "exited", code: 0 });
  const failed = proc("install", { kind: "exited", code: 1 });

  it("選んだプロセスを出す", () => {
    expect(shownProcess([running, failed], "server")).toBe(running);
  });

  it.each([
    ["選んでいないとき", undefined],
    ["選んだプロセスが一覧に無いとき", "gone"],
  ])("%s は、0 でない終了コードで終わったプロセスを出す", (_, selected) => {
    expect(shownProcess([running, passed, failed], selected)).toBe(failed);
  });

  it("0 でない終了コードのプロセスが無いときは、先頭のプロセスを出す", () => {
    expect(shownProcess([running, passed], undefined)).toBe(running);
  });

  it("プロセスが無いときは、出さない", () => {
    expect(shownProcess([], undefined)).toBeUndefined();
  });
});

describe("shownFiles", () => {
  const file = (path: string) => ({ path, kind: "file" as const });

  it("ツリーから消えたファイルのタブを出さず、選んだタブが消えたときは先頭のタブを選ぶ", () => {
    expect(
      shownFiles({ openFiles: ["a.js", "b.js", "c.js"], activeFile: "b.js" }, [
        file("a.js"),
        file("c.js"),
      ]),
    ).toStrictEqual({ openFiles: ["a.js", "c.js"], activeFile: "a.js" });
  });

  it("選んだタブが残るときは、選んだタブを変えない", () => {
    expect(
      shownFiles({ openFiles: ["a.js", "b.js"], activeFile: "b.js" }, [file("b.js")]),
    ).toStrictEqual({ openFiles: ["b.js"], activeFile: "b.js" });
  });

  it("ツリーを読む前は、開いたファイルを全て出す", () => {
    expect(shownFiles({ openFiles: ["a.js"], activeFile: "a.js" }, undefined)).toStrictEqual({
      openFiles: ["a.js"],
      activeFile: "a.js",
    });
  });

  it("全てのタブが消えたときは、選ぶタブを無くす", () => {
    expect(shownFiles({ openFiles: ["a.js"], activeFile: "a.js" }, [])).toStrictEqual({
      openFiles: [],
      activeFile: undefined,
    });
  });
});
