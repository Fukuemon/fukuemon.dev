import { describe, expect, it } from "vitest";

import { exitLabel, lineKind, progressLabel, shortcutOf } from "./output";

describe("lineKind", () => {
  it.each([
    ["--- PASS: TestA (0.00s)", "pass"],
    ["    --- PASS: TestA/sub (0.00s)", "pass"],
    ["PASS", "pass"],
    ["ok  \tplay/greet", "pass"],
    ["--- FAIL: TestB (0.00s)", "fail"],
    ["FAIL\tplay", "fail"],
    ["FAIL", "fail"],
    ["main.go:9:14: cannot convert", "error"],
    ["panic: boom", "error"],
    ["=== RUN   TestA", "run"],
    ["こんにちは", "plain"],
    ["PASSWORD", "plain"],
  ])("%s は %s", (line, kind) => {
    expect(lineKind(line)).toBe(kind);
  });
});

describe("shortcutOf", () => {
  const key = (
    key: string,
    modifiers: Partial<Record<"metaKey" | "ctrlKey" | "shiftKey" | "altKey", boolean>>,
  ) => ({
    key,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...modifiers,
  });

  it.each([
    ["⌘ と Enter", key("Enter", { metaKey: true }), "run"],
    ["Ctrl と Enter", key("Enter", { ctrlKey: true }), "run"],
    ["⌘ と Shift と Enter", key("Enter", { metaKey: true, shiftKey: true }), "test"],
    ["Ctrl と .", key(".", { ctrlKey: true }), "stop"],
    ["Enter だけ", key("Enter", {}), undefined],
    ["Alt を足した Ctrl と Enter", key("Enter", { ctrlKey: true, altKey: true }), undefined],
    ["Ctrl と Shift と .", key(".", { ctrlKey: true, shiftKey: true }), undefined],
    ["Ctrl と s", key("s", { ctrlKey: true }), undefined],
  ])("%s は %s", (_, event, expected) => {
    expect(shortcutOf(event)).toBe(expected);
  });
});

describe("progressLabel", () => {
  it("実行していないときは出さず、読み込み中と実行中とテスト中で文を変える", () => {
    expect(progressLabel({ kind: "ready" }, false, "run")).toBeUndefined();
    expect(progressLabel({ kind: "loading" }, true, "run")).toBe("Yaegi を読み込んでいます");
    expect(progressLabel({ kind: "ready" }, true, "run")).toBe("実行しています");
    expect(progressLabel({ kind: "ready" }, true, "test")).toBe("テストを実行しています");
  });
});

describe("exitLabel", () => {
  it("終わり方ごとの文にする", () => {
    expect(exitLabel(undefined)).toBeUndefined();
    expect(exitLabel({ kind: "exited", exitCode: 2 })).toBe("終了コード 2");
    expect(exitLabel({ kind: "stopped" })).toBe("止めました");
    expect(exitLabel({ kind: "timeout" })).toBe("時間の上限で止めました");
    expect(exitLabel({ kind: "failed", message: "読めない" })).toBe("読めない");
  });
});
