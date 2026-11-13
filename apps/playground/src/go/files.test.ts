import { describe, expect, it } from "vitest";

import {
  type Change,
  type GoWorkspace,
  createDirectory,
  kindOf,
  listEntries,
  normalizePath,
  remove,
  rename,
  toTree,
  writeFile,
} from "./files";

const workspace: GoWorkspace = {
  files: { "main.go": "m", "greet/greet.go": "g", "greet/greet_test.go": "t" },
  directories: ["empty"],
};

const ok = (change: Change): GoWorkspace => {
  if (!change.ok) throw new Error(change.reason);
  return change.workspace;
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
    expect(listEntries(workspace)).toEqual([
      { path: "empty", kind: "directory" },
      { path: "greet", kind: "directory" },
      { path: "greet/greet.go", kind: "file" },
      { path: "greet/greet_test.go", kind: "file" },
      { path: "main.go", kind: "file" },
    ]);
    expect(listEntries(workspace, "greet").map((e) => e.path)).toEqual([
      "greet/greet.go",
      "greet/greet_test.go",
    ]);
    expect([
      kindOf(workspace, "greet"),
      kindOf(workspace, "main.go"),
      kindOf(workspace, "x"),
    ]).toEqual(["directory", "file", undefined]);
  });

  it("作ったディレクトリの親も、ディレクトリとして並べる", () => {
    expect(kindOf({ files: {}, directories: ["a/b"] }, "a")).toBe("directory");
  });
});

describe("writeFile", () => {
  it("無いファイルを作り、親のディレクトリも一覧に出す", () => {
    const next = ok(writeFile(workspace, "x/y.go", "y"));
    expect(next.files["x/y.go"]).toBe("y");
    expect(kindOf(next, "x")).toBe("directory");
  });

  it("あるファイルを上書きする", () => {
    expect(ok(writeFile(workspace, "main.go", "new")).files["main.go"]).toBe("new");
  });

  it.each([
    ["greet", "「greet」はディレクトリです"],
    ["main.go/x.go", "「main.go」はファイルなので、その下に作れません"],
    ["../x", "「../x」はファイルのパスにできません"],
  ])("%s には書かない", (path, reason) => {
    expect(writeFile(workspace, path, "")).toEqual({ ok: false, reason });
  });
});

describe("createDirectory", () => {
  it("空のディレクトリを作る", () => {
    expect(ok(createDirectory(workspace, "new")).directories).toEqual(["empty", "new"]);
  });

  it.each([
    ["greet", "「greet」は既にあります"],
    ["", "「」はディレクトリのパスにできません"],
  ])("%s は作らない", (path, reason) => {
    expect(createDirectory(workspace, path)).toEqual({ ok: false, reason });
  });
});

describe("rename", () => {
  it("ディレクトリの名前を変えると、下のファイルとディレクトリも移す", () => {
    const next = ok(rename({ ...workspace, directories: ["greet/sub"] }, "greet", "hello"));
    expect(Object.keys(next.files).sort()).toEqual([
      "hello/greet.go",
      "hello/greet_test.go",
      "main.go",
    ]);
    expect(next.directories).toEqual(["hello/sub"]);
  });

  it("同じ名前にするときは、何も変えない", () => {
    expect(rename(workspace, "main.go", "main.go")).toEqual({
      ok: true,
      workspace,
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
    expect(rename(workspace, from, to)).toEqual({ ok: false, reason });
  });
});

describe("remove", () => {
  it("ディレクトリを消すと、下のファイルも消し、親のディレクトリは一覧に残す", () => {
    const nested: GoWorkspace = { files: { "a/b/c.go": "c" }, directories: ["a/b/d"] };
    const next = ok(remove(nested, "a/b"));
    expect(next).toEqual({ files: {}, directories: ["a"] });
  });

  it("ファイルを消す", () => {
    expect(Object.keys(ok(remove(workspace, "main.go")).files)).not.toContain("main.go");
  });

  it("無いパスは消さない", () => {
    expect(remove(workspace, "nope")).toEqual({ ok: false, reason: "「nope」はありません" });
  });
});

describe("変更の結果のパス", () => {
  it("正規化した後のパスを返し、rename は移す前のパスも返す", () => {
    const created = writeFile(workspace, "./x/y.go/", "");
    const moved = rename(workspace, "/greet/", "hello/");
    expect(created.ok && created.path).toBe("x/y.go");
    expect(moved.ok && [moved.from, moved.path]).toEqual(["greet", "hello"]);
  });
});

describe("toTree", () => {
  it("各階層で、ディレクトリを先に、名前の順で並べる", () => {
    expect(toTree(workspace)).toEqual([
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
