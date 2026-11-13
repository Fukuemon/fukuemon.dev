import { describe, expect, it } from "vitest";

import {
  type Change,
  baseName,
  createFile,
  joinPath,
  parentOf,
  type GoFileSet,
  createDirectory,
  kindOf,
  listEntries,
  normalizePath,
  remove,
  rename,
  toTree,
  writeFile,
} from "./files";

const fileSet: GoFileSet = {
  files: { "main.go": "m", "greet/greet.go": "g", "greet/greet_test.go": "t" },
  directories: ["empty"],
};

const ok = (change: Change): GoFileSet => {
  if (!change.ok) throw new Error(change.reason);
  return change.fileSet;
};

describe("normalizePath", () => {
  it.each([
    ["./a/b.go", "a/b.go"],
    ["/a/", "a"],
    [" a.go ", "a.go"],
  ])("%s は %s にする", (input, expected) => {
    expect(normalizePath(input)).toBe(expected);
  });

  it.each([[""], ["a/../b"], ["a//b"], ["a\\b"], ["."]])("%s はパスにしない", (input) => {
    expect(normalizePath(input)).toBeUndefined();
  });
});

describe("listEntries と kindOf", () => {
  it("ファイルの親と、作ったディレクトリを、パスの順で並べる", () => {
    expect(listEntries(fileSet)).toStrictEqual([
      { path: "empty", kind: "directory" },
      { path: "greet", kind: "directory" },
      { path: "greet/greet.go", kind: "file" },
      { path: "greet/greet_test.go", kind: "file" },
      { path: "main.go", kind: "file" },
    ]);
    expect(listEntries(fileSet, "greet").map((e) => e.path)).toStrictEqual([
      "greet/greet.go",
      "greet/greet_test.go",
    ]);
    expect([
      kindOf(fileSet, "greet"),
      kindOf(fileSet, "main.go"),
      kindOf(fileSet, "x"),
    ]).toStrictEqual(["directory", "file", undefined]);
  });

  it("作ったディレクトリの親も、ディレクトリとして並べる", () => {
    expect(kindOf({ files: {}, directories: ["a/b"] }, "a")).toBe("directory");
  });
});

describe("writeFile", () => {
  it("無いファイルを作り、親のディレクトリも一覧に出す", () => {
    const next = ok(writeFile(fileSet, "x/y.go", "y"));
    expect(next.files["x/y.go"]).toBe("y");
    expect(kindOf(next, "x")).toBe("directory");
  });

  it("あるファイルを上書きする", () => {
    expect(ok(writeFile(fileSet, "main.go", "new")).files["main.go"]).toBe("new");
  });

  it.each([
    ["greet", "「greet」はディレクトリです"],
    ["main.go/x.go", "「main.go」はファイルなので、その下に作れません"],
    ["../x", "「../x」はファイルのパスにできません"],
  ])("%s には書かない", (path, reason) => {
    expect(writeFile(fileSet, path, "")).toStrictEqual({ ok: false, reason });
  });
});

describe("createFile", () => {
  it("空のファイルを作る", () => {
    expect(ok(createFile(fileSet, "greet/new.go")).files["greet/new.go"]).toBe("");
  });

  it.each([
    ["main.go", "「main.go」は既にあります"],
    ["", "「」はファイルのパスにできません"],
  ])("%s には作らず、既にあるファイルの中身を消さない", (path, reason) => {
    expect(createFile(fileSet, path)).toStrictEqual({ ok: false, reason });
  });
});

describe("パスの関数", () => {
  it.each([
    [joinPath(undefined, "a.go"), "a.go"],
    [joinPath("d", "a.go"), "d/a.go"],
    [parentOf("d/e/a.go"), "d/e"],
    [parentOf("a.go"), undefined],
    [baseName("d/e/a.go"), "a.go"],
  ])("%s は %s", (actual, expected) => {
    expect(actual).toBe(expected);
  });
});

describe("createDirectory", () => {
  it("空のディレクトリを作る", () => {
    expect(ok(createDirectory(fileSet, "new")).directories).toStrictEqual(["empty", "new"]);
  });

  it.each([
    ["greet", "「greet」は既にあります"],
    ["", "「」はディレクトリのパスにできません"],
  ])("%s は作らない", (path, reason) => {
    expect(createDirectory(fileSet, path)).toStrictEqual({ ok: false, reason });
  });
});

describe("rename", () => {
  it("ディレクトリの名前を変えると、下のファイルとディレクトリも移す", () => {
    const next = ok(rename({ ...fileSet, directories: ["greet/sub"] }, "greet", "hello"));
    expect(Object.keys(next.files).sort()).toStrictEqual([
      "hello/greet.go",
      "hello/greet_test.go",
      "main.go",
    ]);
    expect(next.directories).toStrictEqual(["hello/sub"]);
  });

  it("同じ名前にするときは、何も変えない", () => {
    expect(rename(fileSet, "main.go", "main.go")).toStrictEqual({
      ok: true,
      fileSet,
      path: "main.go",
      from: "main.go",
    });
  });

  it.each([
    ["nope", "a", "「nope」はありません"],
    ["main.go", "../a", "「../a」は名前にできません"],
    ["greet", "greet/inner", "ディレクトリを、自分の下に移せません"],
    ["main.go", "greet", "「greet」は既にあります"],
  ])("%s を %s にはしない", (from, to, reason) => {
    expect(rename(fileSet, from, to)).toStrictEqual({ ok: false, reason });
  });
});

describe("remove", () => {
  it("ディレクトリを消すと、下のファイルも消し、親のディレクトリは一覧に残す", () => {
    const nested: GoFileSet = { files: { "a/b/c.go": "c" }, directories: ["a/b/d"] };
    const next = ok(remove(nested, "a/b"));
    expect(next).toStrictEqual({ files: {}, directories: ["a"] });
  });

  it("ファイルを消す", () => {
    expect(Object.keys(ok(remove(fileSet, "main.go")).files)).not.toContain("main.go");
  });

  it("無いパスは消さない", () => {
    expect(remove(fileSet, "nope")).toStrictEqual({ ok: false, reason: "「nope」はありません" });
  });
});

describe("変更の結果のパス", () => {
  it("正規化した後のパスを返し、rename は移す前のパスも返す", () => {
    const created = writeFile(fileSet, "./x/y.go/", "");
    const moved = rename(fileSet, "/greet/", "hello/");
    expect(created.ok && created.path).toBe("x/y.go");
    expect(moved.ok && [moved.from, moved.path]).toStrictEqual(["greet", "hello"]);
  });
});

describe("toTree", () => {
  it("各階層で、ディレクトリを先に、名前の順で並べる", () => {
    expect(toTree(fileSet)).toStrictEqual([
      { id: "empty", label: "empty", children: [] },
      {
        id: "greet",
        label: "greet",
        children: [
          { id: "greet/greet.go", label: "greet.go" },
          { id: "greet/greet_test.go", label: "greet_test.go" },
        ],
      },
      { id: "main.go", label: "main.go" },
    ]);
  });
});
