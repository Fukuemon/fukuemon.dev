import { describe, expect, it } from "vitest";
import { tcy } from "./tate";

const upright = (s: string) =>
  tcy(s)
    .filter((p) => p.upright)
    .map((p) => p.text);

describe("tcy", () => {
  it("和文だけなら塊は 1 つで、正立させない", () => {
    expect(tcy("最近の更新")).toEqual([{ text: "最近の更新", upright: false }]);
  });

  it("3 文字までの略語を正立させる", () => {
    expect(upright("WAL と肥大化")).toEqual(["WAL"]);
  });

  it("4 文字以上の欧文は横倒しのまま残す", () => {
    expect(upright("OpenTelemetry の経路")).toEqual([]);
  });

  it("長い語と短い語が混ざっても、短い語だけを拾う", () => {
    const parts = tcy("OpenTelemetry と WAL");
    expect(parts.map((p) => p.text)).toEqual(["OpenTelemetry と ", "WAL"]);
    expect(parts.map((p) => p.upright)).toEqual([false, true]);
  });

  it("数字を正立させる", () => {
    expect(upright("3 箇所")).toEqual(["3"]);
  });

  it("区切り記号をまたがない", () => {
    expect(upright("3.5 秒")).toEqual(["3", "5"]);
  });

  it("先頭が欧文でも塊の順序が崩れない", () => {
    expect(tcy("WAL の話")).toEqual([
      { text: "WAL", upright: true },
      { text: " の話", upright: false },
    ]);
  });

  it("空文字では塊を作らない", () => {
    expect(tcy("")).toEqual([]);
  });
});
