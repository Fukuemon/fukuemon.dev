import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import { parseConsoleRecord } from "./console-records";

const { toConsoleValues } = createRequire(import.meta.url)("./guest/console-value.cjs") as {
  toConsoleValues: (args: unknown[], describe: (value: unknown) => string | undefined) => unknown[];
};

const copy = (...args: unknown[]) => toConsoleValues(args, () => undefined);

/** 写した値を JSON で運んでから、読む側で読む。 */
const roundTrip = (...args: unknown[]) =>
  parseConsoleRecord(JSON.parse(JSON.stringify({ level: "log", time: 1, args: copy(...args) })));

const wide = (width: number, depth: number): unknown =>
  depth === 0 ? 1 : Array.from({ length: width }, () => wide(width, depth - 1));

describe("toConsoleValues", () => {
  it.each([
    ["Date", new Date(Date.UTC(2026, 10, 14)), "2026-11-14T00:00:00.000Z"],
    ["不正な Date", new Date(Number.NaN), "Invalid Date"],
    ["正規表現", /a+/g, "/a+/g"],
    ["型付き配列", new Uint8Array(3), "Uint8Array(3)"],
    ["DataView", new DataView(new ArrayBuffer(4)), "DataView(4)"],
    ["Promise", Promise.resolve(), "Promise"],
    ["WeakMap", new WeakMap(), "WeakMap"],
  ])("%sを文字にする", (_, value, expected) => {
    expect(copy(value)).toStrictEqual([{ kind: "text", value: expected }]);
  });

  it("Firefox と Safari の形の stack から、呼び出し元のフレームの行を写す", () => {
    const error = new Error("m");
    Object.defineProperty(error, "stack", { value: "run@https://a.example/app.js:1:2\n" });
    expect(copy(error)).toStrictEqual([
      { kind: "error", name: "Error", message: "m", stack: ["run@https://a.example/app.js:1:2"] },
    ]);
  });

  it("訪問者が定義した stack、Symbol.toStringTag の getter と、上書きした Map と Set のメソッドを呼ばない", () => {
    const touched: string[] = [];
    class Loud extends Error {
      override get stack() {
        touched.push("stack");
        return "";
      }
      get [Symbol.toStringTag]() {
        touched.push("tag");
        return "Loud";
      }
    }
    class LoudMap extends Map<unknown, unknown> {
      override entries(): MapIterator<[unknown, unknown]> {
        touched.push("entries");
        return super.entries();
      }
    }
    class LoudSet extends Set<unknown> {
      override values(): SetIterator<unknown> {
        touched.push("values");
        return super.values();
      }
    }
    copy(new Loud("x"), new LoudMap([[1, 2]]), new LoudSet([1]));
    expect(touched).toStrictEqual([]);
  });

  it("写せない値は、記録を止めずに印にする", () => {
    const broken = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("x");
        },
      },
    );
    expect(copy(broken, 1)).toStrictEqual([
      { kind: "text", value: "(写せない値)" },
      { kind: "number", value: "1" },
    ]);
  });

  it("101 個以上の引数は、100 個と残りの件数の印にする", () => {
    expect(copy(...Array.from({ length: 102 }, () => 0)).at(-1)).toStrictEqual({
      kind: "text",
      value: "…ほか 2 件",
    });
  });

  it("101 個以上の項目を持つ Map は、100 個と残りの件数の印にする", () => {
    const map = new Map(Array.from({ length: 101 }, (_, i) => [i, i]));
    expect(copy(map)).toHaveProperty(["0", "entries", "100"], {
      key: { kind: "text", value: "…" },
      value: { kind: "text", value: "…ほか 1 件" },
    });
  });

  it("101 個以上の項目を持つオブジェクトは、100 個と残りの件数の印にする", () => {
    const object = Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`k${i}`, i]));
    expect(copy(object)).toHaveProperty(["0", "entries", "100"], {
      key: "…",
      value: { kind: "text", value: "…ほか 1 件" },
    });
  });

  it("長い bigint は、上限で切る", () => {
    expect(copy(10n ** 10_001n)).toHaveProperty(["0", "value", "length"], 10_001);
  });
});

describe("写した値を、読む側が捨てない", () => {
  it.each([
    ["100×100 の配列", [wide(100, 2)]],
    ["幅の広い 3 段の入れ子", [wide(30, 3)]],
    ["101 個の引数", Array.from({ length: 101 }, () => ({ a: 1 }))],
    ["長い bigint", [10n ** 20_000n]],
    ["深い入れ子", [JSON.parse("[".repeat(20) + "]".repeat(20)) as unknown]],
    ["長い文字列の多い配列", [Array.from({ length: 100 }, () => "x".repeat(10_000))]],
    [
      "getter のプロパティの多いオブジェクトの配列",
      [
        Array.from({ length: 21 }, () =>
          Object.defineProperties(
            {},
            Object.fromEntries(
              Array.from({ length: 100 }, (_, i) => [`g${i}`, { enumerable: true, get: () => i }]),
            ),
          ),
        ),
      ],
    ],
    [
      "文字数を使い切った後の bigint",
      [...Array.from({ length: 27 }, () => "x".repeat(10_000)), 10n],
    ],
  ])("%s", (_, args) => {
    expect(roundTrip(...args)).toBeDefined();
  });
});
