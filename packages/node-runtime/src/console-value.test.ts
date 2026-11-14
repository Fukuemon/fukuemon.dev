import { createRequire } from "node:module";
import { types } from "node:util";

import { describe, expect, it } from "vitest";

import { parseConsoleRecord } from "./console-records";

const { toConsoleValues } = createRequire(import.meta.url)("./guest/console-value.cjs") as {
  toConsoleValues: (
    args: unknown[],
    describe: (value: unknown) => string | undefined,
    isNativeError?: (value: unknown) => boolean,
  ) => unknown[];
};

const copy = (...args: unknown[]) => toConsoleValues(args, () => undefined);
/** Node の preload と同じく、isNativeError を渡して写す。 */
const copyInNode = (...args: unknown[]) =>
  toConsoleValues(
    args,
    () => undefined,
    (value) => types.isNativeError(value),
  );

/** 写した値を JSON で運んでから、読む側で読む。 */
const roundTrip = (...args: unknown[]) =>
  parseConsoleRecord(JSON.parse(JSON.stringify({ level: "log", time: 1, args: copy(...args) })));

const wide = (width: number, depth: number): unknown =>
  depth === 0 ? 1 : Array.from({ length: width }, () => wide(width, depth - 1));

class NamelessBytes extends Uint8Array {}
Object.defineProperty(NamelessBytes, "name", { value: "" });
class NamelessView extends DataView<ArrayBuffer> {}
Object.defineProperty(NamelessView, "name", { value: "" });

describe("toConsoleValues", () => {
  it.each([
    ["Date", new Date(Date.UTC(2026, 10, 14)), "2026-11-14T00:00:00.000Z"],
    ["不正な Date", new Date(Number.NaN), "Invalid Date"],
    ["正規表現", /a+/g, "/a+/g"],
    ["型付き配列", new Uint8Array(3), "Uint8Array(3)"],
    ["DataView", new DataView(new ArrayBuffer(4)), "DataView(4)"],
    ["名前の無い型付き配列のクラス", new NamelessBytes(2), "TypedArray(2)"],
    ["名前の無い DataView のクラス", new NamelessView(new ArrayBuffer(4)), "DataView(4)"],
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

  it("値に直接定義した stack の getter、上書きした size、クラスの名前、正規表現の source と flags の getter を呼ばない", () => {
    const touched: string[] = [];
    const error = new Error("m");
    Object.defineProperty(error, "stack", {
      get() {
        touched.push("stack");
        return "";
      },
    });
    class SizedMap extends Map<unknown, unknown> {
      override get size() {
        touched.push("map size");
        return 0;
      }
    }
    class SizedSet extends Set<unknown> {
      override get size() {
        touched.push("set size");
        return 0;
      }
    }
    class Named {
      static get name() {
        touched.push("name");
        return "Named";
      }
    }
    class LoudRegExp extends RegExp {
      override get source() {
        touched.push("source");
        return "x";
      }
      override get flags() {
        touched.push("flags");
        return "";
      }
    }
    const values = copy(
      error,
      new SizedMap([[1, 2]]),
      new SizedSet([1]),
      new Named(),
      new LoudRegExp("a+", "gi"),
    );
    expect({ touched, values }).toStrictEqual({
      touched: [],
      values: [
        { kind: "error", name: "Error", message: "m" },
        {
          kind: "map",
          entries: [{ key: { kind: "number", value: "1" }, value: { kind: "number", value: "2" } }],
        },
        { kind: "set", items: [{ kind: "number", value: "1" }] },
        { kind: "object", entries: [] },
        { kind: "text", value: "/a+/gi" },
      ],
    });
  });

  describe("isNativeError を渡したとき（Node の preload）", () => {
    const ownStack = (error: object, get: () => string) =>
      Object.defineProperty(error, "stack", { configurable: true, get });

    it("組み込みの Error が自身に持つ stack の getter を呼び、呼び出し元のフレームの行を写す", () => {
      const error = ownStack(new Error("m"), () => "Error: m\n    at run (/app.js:1:2)");
      expect(copyInNode(error)).toStrictEqual([
        { kind: "error", name: "Error", message: "m", stack: ["at run (/app.js:1:2)"] },
      ]);
    });

    it("組み込みの Error が自身に持つ name と message の getter は呼ばない", () => {
      const touched: string[] = [];
      const error = new Error("m");
      for (const key of ["name", "message"]) {
        Object.defineProperty(error, key, {
          get() {
            touched.push(key);
            return "x";
          },
        });
      }
      copyInNode(error);
      expect(touched).toStrictEqual([]);
    });

    it("組み込みの Error でない値の自身の getter、継承した getter、例外を投げる getter からは stack を写さない", () => {
      const touched: string[] = [];
      const fake = ownStack(Object.create(Error.prototype) as object, () => {
        touched.push("fake");
        return "Error\n    at fake (/app.js:1:2)";
      });
      class Loud extends Error {
        override get stack() {
          touched.push("inherited");
          return "Error\n    at loud (/app.js:1:2)";
        }
      }
      const throwing = ownStack(new Error("t"), () => {
        throw new Error("boom");
      });
      // V8 は、作った Error に自身の stack を付けるので、消して継承した getter だけを残す
      const inherited = new Loud("l");
      Reflect.deleteProperty(inherited, "stack");
      const values = copyInNode(fake, inherited, throwing);
      expect({ touched, values }).toStrictEqual({
        touched: [],
        values: [
          { kind: "error", name: "Error", message: "" },
          { kind: "error", name: "Error", message: "l" },
          { kind: "error", name: "Error", message: "t" },
        ],
      });
    });
  });

  describe.each([
    ["isNativeError を渡さないとき", copy],
    ["isNativeError を渡したとき", copyInNode],
  ])("%s", (_, run) => {
    it("name か message が文字列のデータでも組み込みの getter でもない Error は、stack を読まず、訪問者のコードを動かさない", () => {
      const touched: string[] = [];
      const spy = (label: string) => ({
        toString() {
          touched.push(label);
          return "x";
        },
      });
      const own = new Error("m");
      Object.defineProperty(own, "message", {
        get() {
          touched.push("own");
          return "x";
        },
      });
      class Inherited extends Error {
        override get name() {
          touched.push("inherited");
          return "I";
        }
      }
      const object = new Error("m");
      Object.defineProperty(object, "message", { value: spy("message") });
      const objectName = new Error("m");
      Object.defineProperty(objectName, "name", { value: spy("name") });
      class InheritedObject extends Error {}
      Object.defineProperty(InheritedObject.prototype, "name", { value: spy("inheritedObject") });
      const values = run(own, new Inherited("m"), object, objectName, new InheritedObject("m"));
      expect({ touched, values }).toStrictEqual({
        touched: [],
        values: [
          { kind: "error", name: "Error", message: "" },
          { kind: "error", name: "Error", message: "m" },
          { kind: "error", name: "Error", message: "" },
          { kind: "error", name: "Error", message: "m" },
          { kind: "error", name: "Error", message: "m" },
        ],
      });
    });

    it("値の name が文字列でも、stack を自身に持つ鎖の上の Error の name が getter なら、stack を読まない", () => {
      const touched: string[] = [];
      const inner = new Error("m");
      Object.defineProperty(inner, "name", {
        get() {
          touched.push("shadowed");
          return "x";
        },
      });
      const shadowed = Object.create(inner, { name: { value: "E" } }) as object;
      expect({ touched, values: run(shadowed) }).toStrictEqual({
        touched: [],
        values: [{ kind: "error", name: "E", message: "m" }],
      });
    });

    it("name と message が文字列のデータの Error のサブクラスは、stack を読む", () => {
      class Named extends Error {}
      Object.defineProperty(Named.prototype, "name", { value: "Named" });
      expect(run(new Named("m"))).toStrictEqual([
        { kind: "error", name: "Named", message: "m", stack: expect.any(Array) },
      ]);
    });
  });

  it("bind した stack の getter と、配列の添字の getter を呼ばない", () => {
    const touched: string[] = [];
    const error = new Error("m");
    Object.defineProperty(error, "stack", {
      get: function () {
        touched.push("stack");
        return "";
      }.bind(null),
    });
    const array: unknown[] = [];
    Object.defineProperty(array, 0, {
      enumerable: true,
      get() {
        touched.push("index");
        return 1;
      },
    });
    expect({ touched, values: copy(error, array) }).toStrictEqual({
      touched: [],
      values: [
        { kind: "error", name: "Error", message: "m" },
        { kind: "array", length: 1, items: [{ kind: "text", value: "(...)" }] },
      ],
    });
  });

  it("DOMException の名前と文は、組み込みの getter で読む", () => {
    expect(copy(new DOMException("m", "AbortError"))).toStrictEqual([
      { kind: "error", name: "AbortError", message: "m", stack: expect.any(Array) },
    ]);
  });

  it("配列の穴は undefined として写す", () => {
    const holes: unknown[] = [];
    holes[1] = 1;
    expect(copy(holes)).toStrictEqual([
      { kind: "array", length: 2, items: [{ kind: "undefined" }, { kind: "number", value: "1" }] },
    ]);
  });

  it("型付き配列のクラスの名前も、上限で切る", () => {
    class Long extends Uint8Array {}
    Object.defineProperty(Long, "name", { value: "x".repeat(10_002) });
    expect(copy(new Long(1))).toHaveProperty(["0", "value", "length"], 10_001);
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

  it("101 個以上の要素を持つ配列は、100 個と残りの件数の印にし、元の長さを持つ", () => {
    const [array] = copy(Array.from({ length: 150 }, () => 0)) as [
      { length: number; items: unknown[] },
    ];
    expect({
      length: array.length,
      count: array.items.length,
      last: array.items.at(-1),
    }).toStrictEqual({ length: 150, count: 101, last: { kind: "text", value: "…ほか 50 件" } });
  });

  it("Proxy の配列の length が配列の長さに合わないときは、長さを 0 にして記録を残す", () => {
    const proxy = new Proxy([1, 2], {
      get: (target, key) => (key === "length" ? "2" : Reflect.get(target, key)),
    });
    expect(copy(proxy)).toStrictEqual([{ kind: "array", length: 0, items: [] }]);
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
    ["長さが上限の配列", [new Array(2 ** 32 - 1)]],
    ["101 個の引数", Array.from({ length: 101 }, () => ({ a: 1 }))],
    ["長い bigint", [10n ** 20_000n]],
    ["深い入れ子", [JSON.parse("[".repeat(20) + "]".repeat(20)) as unknown]],
    ["長い文字列の多い配列", [Array.from({ length: 100 }, () => "x".repeat(10_000))]],
    [
      "添字の getter の多い配列の配列",
      [
        Array.from({ length: 21 }, () =>
          Object.defineProperties(
            [],
            Object.fromEntries(
              Array.from({ length: 100 }, (_, i) => [i, { enumerable: true, get: () => i }]),
            ),
          ),
        ),
      ],
    ],
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
    [
      "文字数の残りが 1 のときの負の bigint",
      [...Array.from({ length: 26 }, () => "x".repeat(10_000)), "x".repeat(2143), -10n],
    ],
  ])("%s", (_, args) => {
    expect(roundTrip(...args)).toBeDefined();
  });
});
