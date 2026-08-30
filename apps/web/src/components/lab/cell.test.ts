import { describe, expect, it } from "vitest";
import { cellText } from "./cell";

describe("cellText", () => {
  it("null と undefined を NULL にする", () => {
    expect(cellText(null)).toBe("NULL");
    expect(cellText(undefined)).toBe("NULL");
  });

  it("Date を秒までの表記にする", () => {
    expect(cellText(new Date("2026-08-30T03:04:05.678Z"))).toBe("2026-08-30 03:04:05");
  });

  it("文字列をそのまま返す", () => {
    expect(cellText("a b")).toBe("a b");
  });

  it("空文字を NULL にしない", () => {
    expect(cellText("")).toBe("");
  });

  it("数値・bigint・真偽値を文字にする", () => {
    expect(cellText(1.5)).toBe("1.5");
    expect(cellText(10n)).toBe("10");
    expect(cellText(false)).toBe("false");
  });

  it("配列とオブジェクトを JSON にする", () => {
    expect(cellText([1, 2])).toBe("[1,2]");
    expect(cellText({ a: 1 })).toBe('{"a":1}');
  });

  it("循環参照でも落ちず、型名を出す", () => {
    const o: Record<string, unknown> = {};
    o.self = o;
    expect(cellText(o)).toBe("[object Object]");
  });

  it("JSON にできない値でも落ちない", () => {
    expect(cellText(() => 1)).toBe("[object Function]");
  });
});
