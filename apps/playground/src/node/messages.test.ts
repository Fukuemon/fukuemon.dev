import type { ProcessInfo } from "@fukuemon/node-runtime";
import { toVsCodeTheme } from "@fukuemon/ui";
import { describe, expect, it } from "vitest";

import { languageOf } from "./language";
import { SUPPORTED_BROWSERS, bootFailureMessage, processLabel, shellName } from "./messages";
import { toXtermTheme } from "./terminal-theme";

const info = (name: string, status: ProcessInfo["status"] = { kind: "running" }): ProcessInfo => ({
  id: name,
  name,
  status,
});

describe("bootFailureMessage", () => {
  it.each(["not-isolated", "timeout", "failed"] as const)(
    "%s のときも、対応するブラウザを添える",
    (reason) => {
      expect(bootFailureMessage(reason).endsWith(SUPPORTED_BROWSERS)).toBe(true);
    },
  );
});

describe("processLabel", () => {
  it("終了したプロセスは、終了コードを添える", () => {
    expect(processLabel(info("npm install", { kind: "exited", code: 1 }))).toBe(
      "npm install（終了 1）",
    );
    expect(processLabel(info("サーバー"))).toBe("サーバー");
  });
});

describe("shellName", () => {
  it("最初のシェルは番号を付けず、2 つ目から番号を付ける", () => {
    expect(shellName([info("npm install")])).toBe("シェル");
    expect(shellName([info("シェル"), info("サーバー")])).toBe("シェル 2");
    expect(shellName([info("シェル"), info("シェル 2")])).toBe("シェル 3");
  });
});

describe("languageOf", () => {
  it.each([
    ["index.js", { kind: "javascript", jsx: false, typescript: false }],
    ["a.MJS", { kind: "javascript", jsx: false, typescript: false }],
    ["a.cjs", { kind: "javascript", jsx: false, typescript: false }],
    ["App.jsx", { kind: "javascript", jsx: true, typescript: false }],
    ["a.ts", { kind: "javascript", jsx: false, typescript: true }],
    ["a.mts", { kind: "javascript", jsx: false, typescript: true }],
    ["a.cts", { kind: "javascript", jsx: false, typescript: true }],
    ["App.tsx", { kind: "javascript", jsx: true, typescript: true }],
    ["package.json", { kind: "json" }],
    ["README.md", undefined],
    ["Makefile", undefined],
  ])("%s", (path, expected) => {
    expect(languageOf(path)).toStrictEqual(expected);
  });
});

describe("toXtermTheme", () => {
  it("端末の背景、文字、ANSI の 16 色を、VS Code の形式のテーマから写す", () => {
    const theme = toVsCodeTheme("light");
    const xterm = toXtermTheme(theme);
    expect(xterm.background).toBe(theme.colors["terminal.background"]);
    expect(xterm.foreground).toBe(theme.colors["terminal.foreground"]);
    expect(xterm.red).toBe(theme.colors["terminal.ansiRed"]);
    expect(xterm.brightWhite).toBe(theme.colors["terminal.ansiBrightWhite"]);
  });
});
