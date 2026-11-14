import { describe, expect, it, vi } from "vitest";

import {
  childPath,
  isWithin,
  nameError,
  nameErrorInRuntime,
  nameOf,
  projectEntries,
  renamedPath,
  toTreeNodes,
} from "./tree";

describe("toTreeNodes", () => {
  it("パスの一覧を、ディレクトリの下に入れた木にし、一覧の順を保つ", () => {
    expect(
      toTreeNodes([
        { path: "src", kind: "directory" },
        { path: "src/lib", kind: "directory" },
        { path: "src/lib/a.js", kind: "file" },
        { path: "src/b.js", kind: "file" },
        { path: "index.js", kind: "file" },
      ]),
    ).toStrictEqual([
      {
        id: "src",
        label: "src",
        children: [
          { id: "src/lib", label: "lib", children: [{ id: "src/lib/a.js", label: "a.js" }] },
          { id: "src/b.js", label: "b.js" },
        ],
      },
      { id: "index.js", label: "index.js" },
    ]);
  });

  it("空のディレクトリは、空の children を持つ", () => {
    expect(toTreeNodes([{ path: "empty", kind: "directory" }])).toStrictEqual([
      { id: "empty", label: "empty", children: [] },
    ]);
  });
});

describe("projectEntries", () => {
  it("初期ファイルのパスから、ディレクトリを先に、名前の順に並べた一覧を作る", () => {
    expect(projectEntries({ "b.js": "", "src/lib/a.js": "", "a.js": "" })).toStrictEqual([
      { path: "src", kind: "directory" },
      { path: "src/lib", kind: "directory" },
      { path: "a.js", kind: "file" },
      { path: "b.js", kind: "file" },
      { path: "src/lib/a.js", kind: "file" },
    ]);
  });
});

describe("childPath", () => {
  it.each([
    [undefined, "a.js", "a.js"],
    ["src", "a.js", "src/a.js"],
  ])("%s の下の %s は %s", (parent, name, expected) => {
    expect(childPath(parent, name)).toBe(expected);
  });
});

describe("renamedPath", () => {
  it.each([
    ["a.js", "b.js", "b.js"],
    ["src/lib/a.js", "b.js", "src/lib/b.js"],
  ])("%s の名前を %s にすると %s", (path, name, expected) => {
    expect(renamedPath(path, name)).toBe(expected);
  });
});

describe("isWithin", () => {
  it.each([
    ["src", "src", true],
    ["src/a.js", "src", true],
    ["srcx/a.js", "src", false],
    ["a.js", "src", false],
  ])("%s は %s の下か: %s", (path, base, expected) => {
    expect(isWithin(path, base)).toBe(expected);
  });
});

describe("nameOf", () => {
  it.each([
    ["index.js", "index.js"],
    ["src/lib/a.js", "a.js"],
  ])("%s の名前は %s", (path, expected) => {
    expect(nameOf(path)).toBe(expected);
  });
});

describe("nameError", () => {
  const existing = new Set(["index.js", "src"]);

  it.each([
    ["新しい名前", "a.js", "a.js", undefined],
    [
      "同じパスの項目がある名前",
      "index.js",
      "index.js",
      "index.js は既にあります。別の名前にしてください。",
    ],
    [
      "/ を含む名前",
      "a/b.js",
      "a/b.js",
      "名前に / を含めることと、. と .. だけの名前にすることはできません。",
    ],
    [
      ". だけの名前",
      ".",
      ".",
      "名前に / を含めることと、. と .. だけの名前にすることはできません。",
    ],
    [
      ".. だけの名前",
      "..",
      "src/..",
      "名前に / を含めることと、. と .. だけの名前にすることはできません。",
    ],
  ])("%s", (_, name, path, expected) => {
    expect(nameError(name, path, existing)).toBe(expected);
  });
});

describe("nameErrorInRuntime", () => {
  const existing = new Set(["index.js"]);
  const paths = new Set(["node_modules/cookie/index.js"]);
  const exists = async (path: string) => paths.has(path);

  it("ツリーの一覧にある項目は、実行環境に問い合わせずに断る", async () => {
    const ask = vi.fn(exists);
    expect(await nameErrorInRuntime("index.js", "index.js", existing, ask)).toBe(
      "index.js は既にあります。別の名前にしてください。",
    );
    expect(ask).not.toHaveBeenCalled();
  });

  it("ツリーに出さない node_modules の下の項目は、実行環境で確かめて断る", async () => {
    expect(
      await nameErrorInRuntime("index.js", "node_modules/cookie/index.js", existing, exists),
    ).toBe("node_modules/cookie/index.js は既にあります。別の名前にしてください。");
  });

  it("同じパスが無いときは、断らない", async () => {
    expect(
      await nameErrorInRuntime("new.js", "node_modules/cookie/new.js", existing, exists),
    ).toBeUndefined();
  });

  it("実行環境に問い合わせられないときは、確定せずに理由を返す", async () => {
    const failing = async () => {
      throw new Error("ENOENT");
    };
    expect(await nameErrorInRuntime("a.js", "a.js", existing, failing)).toBe(
      "a.js が既にあるかを確かめられませんでした。もう一度試してください。",
    );
  });
});
