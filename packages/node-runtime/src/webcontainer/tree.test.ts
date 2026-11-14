import { describe, expect, it } from "vitest";

import { toTree } from "./tree";

describe("toTree", () => {
  it("パスを、ディレクトリの下に入れた木にする", () => {
    expect(toTree({ "index.js": "a", "src/lib/b.js": "b" })).toStrictEqual({
      "index.js": { file: { contents: "a" } },
      src: { directory: { lib: { directory: { "b.js": { file: { contents: "b" } } } } } },
    });
  });

  it("Object.prototype の名前のディレクトリを、継承した値として読まずに作る", () => {
    // own の constructor を持つオブジェクトは toStrictEqual で比べられないので、組の一覧で比べる
    expect(Object.entries(toTree({ "constructor/a.js": "a" }))).toStrictEqual([
      ["constructor", { directory: { "a.js": { file: { contents: "a" } } } }],
    ]);
  });

  it("ファイルの名前のパスの下に、ファイルを置けない", () => {
    expect(() => toTree({ a: "x", "a/b.js": "y" })).toThrow("a はディレクトリではない");
  });
});
