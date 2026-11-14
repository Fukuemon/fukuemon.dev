import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";

import { PREVIEW_CONSOLE_MESSAGE, parseConsoleRecord } from "./console-records";
import { previewConsoleScript } from "./preview-console";

const TOOL_ORIGIN = "https://play.example";

/** プレビューの iframe に似せた環境でスクリプトを動かし、送ったメッセージと、元の console に渡った引数を返す。 */
function runInPreview(page: string, { framed = true, failing = false } = {}) {
  const posted: { message: unknown; origin: string }[] = [];
  const logged: unknown[][] = [];
  class Node {
    nodeName = "#text";
  }
  class Element extends Node {
    localName = "div";
    id = "app";
    classList = ["a", "b"];
  }
  class Window {}
  const window = new Window() as Window & { parent: unknown };
  const postMessage = (message: unknown, origin: string) => {
    if (failing) throw new Error("DataCloneError");
    posted.push({ message: structuredClone(message), origin });
  };
  window.parent = framed ? { postMessage } : window;
  const console = Object.fromEntries(
    ["debug", "log", "info", "warn", "error"].map((level) => [
      level,
      (...args: unknown[]) =>
        logged.push(JSON.parse(JSON.stringify([level, ...args])) as unknown[]),
    ]),
  );
  runInNewContext(`${previewConsoleScript(TOOL_ORIGIN)}\n${page}`, {
    window,
    console,
    Node,
    Element,
    Window,
  });
  return { posted, logged };
}

describe("previewConsoleScript", () => {
  it("console.* の呼び出しを、ツールのページの origin に送り、元の console も呼ぶ", () => {
    const { posted, logged } = runInPreview(`console.warn("w", { a: 1 });`);
    expect(posted).toHaveLength(1);
    expect(posted[0]?.origin).toBe(TOOL_ORIGIN);
    expect(posted[0]?.message).toMatchObject({ type: PREVIEW_CONSOLE_MESSAGE, level: "warn" });
    expect(parseConsoleRecord(posted[0]?.message)?.args).toStrictEqual([
      { kind: "string", value: "w" },
      { kind: "object", entries: [{ key: "a", value: { kind: "number", value: 1 } }] },
    ]);
    expect(logged).toStrictEqual([["warn", "w", { a: 1 }]]);
  });

  it("DOM の要素とウィンドウを、文字にして送る", () => {
    const { posted } = runInPreview(`console.log(new Element(), new Node(), window);`);
    expect(parseConsoleRecord(posted[0]?.message)?.args).toStrictEqual([
      { kind: "text", value: "<div#app.a.b>" },
      { kind: "text", value: "#text" },
      { kind: "text", value: "Window" },
    ]);
  });

  it("iframe の外で開いたページでは、console を包まない", () => {
    const { posted, logged } = runInPreview(`console.log("x");`, { framed: false });
    expect(posted).toStrictEqual([]);
    expect(logged).toStrictEqual([["log", "x"]]);
  });

  it("送るのに失敗しても、元の console を呼ぶ", () => {
    const { logged } = runInPreview(`console.error("e");`, { failing: true });
    expect(logged).toStrictEqual([["error", "e"]]);
  });

  it("ページのグローバルに名前を足さない", () => {
    const context = {
      window: { parent: { postMessage: () => undefined } },
      console: { log: () => undefined },
      module: { exports: "page" },
    };
    runInNewContext(previewConsoleScript(TOOL_ORIGIN), context);
    expect(Object.keys(context)).toStrictEqual(["window", "console", "module"]);
    expect(context.module.exports).toBe("page");
  });
});
