import { afterEach, describe, expect, it, vi } from "vitest";

import { bootFake, flush, treePaths } from "./test/fake-backend";
import { ReadLimitError } from "./types";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("files", () => {
  it("ファイルを作ると、ツリーに出る", async () => {
    const { runtime } = await bootFake();
    await runtime.files.write("src/new.js", "1");
    expect(treePaths(runtime)).toContain("src/new.js");
  });

  it("書いたファイルを読むと、書いた中身を返す", async () => {
    const { runtime } = await bootFake();
    await runtime.files.write("src/new.js", "1");
    expect(await runtime.files.read("src/new.js")).toBe("1");
  });

  it("ディレクトリを作ると、ツリーにディレクトリとして出る", async () => {
    const { runtime } = await bootFake();
    await runtime.files.createDirectory("lib");
    expect(runtime.files.tree.getSnapshot()).toContainEqual({ path: "lib", kind: "directory" });
  });

  it("名前を変えると、ディレクトリの下のファイルも、新しいパスで出る", async () => {
    const { runtime } = await bootFake();
    await runtime.files.rename("src", "app");
    expect(treePaths(runtime)).toStrictEqual(["app", "app/app.js", "index.js", "package.json"]);
  });

  it("削除すると、ツリーから消える", async () => {
    const { runtime } = await bootFake();
    await runtime.files.remove("src");
    expect(treePaths(runtime)).toStrictEqual(["index.js", "package.json"]);
  });

  it("コマンドが作ったファイルも、変更の通知を受けてツリーに出る", async () => {
    const { runtime, created } = await bootFake();
    created.files.putFromCommand("out.txt", "");
    await flush();
    expect(treePaths(runtime)).toContain("out.txt");
  });

  it("node_modules の下は、パッケージのディレクトリまでを出し、中身を出さない", async () => {
    const { runtime, created } = await bootFake();
    created.files.putFromCommand("node_modules/cookie/index.js", "");
    created.files.putFromCommand("node_modules/@types/node/index.d.ts", "");
    created.files.putFromCommand("node_modules/.package-lock.json", "");
    await flush();
    expect(treePaths(runtime).filter((path) => path.startsWith("node_modules"))).toStrictEqual([
      "node_modules",
      "node_modules/@types",
      "node_modules/@types/node",
      "node_modules/cookie",
      "node_modules/.package-lock.json",
    ]);
  });

  it("入れ子の node_modules の下も、パッケージのディレクトリまでにする", async () => {
    const { runtime, created } = await bootFake();
    created.files.putFromCommand("src/node_modules/a/index.js", "");
    await flush();
    expect(treePaths(runtime).filter((path) => path.includes("node_modules"))).toStrictEqual([
      "src/node_modules",
      "src/node_modules/a",
    ]);
  });

  it("変更の通知を、changes の購読者に、購読している間だけ渡す", async () => {
    const { runtime, created } = await bootFake();
    const onChange = vi.fn();
    const unsubscribe = runtime.files.changes.subscribe(onChange);
    created.files.putFromCommand("a.txt", "");
    unsubscribe();
    created.files.putFromCommand("b.txt", "");
    expect(onChange.mock.calls).toStrictEqual([[["a.txt"]]]);
  });

  it("ツリーが変わらない通知では、同じ参照を返す", async () => {
    const { runtime } = await bootFake();
    const before = runtime.files.tree.getSnapshot();
    await runtime.files.write("index.js", "changed");
    expect(runtime.files.tree.getSnapshot()).toBe(before);
  });

  it("読み直している間に来た通知は、まとめて 1 回で読み直す", async () => {
    const { created } = await bootFake();
    const callsBefore = created.files.api.listCalls;
    created.files.putFromCommand("a.txt", "");
    created.files.putFromCommand("b.txt", "");
    created.files.putFromCommand("c.txt", "");
    await flush();
    // ルートと src の 2 回の list が、1 回の読み直しに当たる。3 つの通知を、2 回の読み直しにまとめる
    expect(created.files.api.listCalls - callsBefore).toBe(4);
  });

  it("まとめて読み直したツリーに、全ての通知のファイルが出る", async () => {
    const { runtime, created } = await bootFake();
    created.files.putFromCommand("a.txt", "");
    created.files.putFromCommand("b.txt", "");
    await flush();
    expect(treePaths(runtime)).toEqual(expect.arrayContaining(["a.txt", "b.txt"]));
  });

  it("読み直しが失敗したときは、前のツリーを残す", async () => {
    const { runtime, created } = await bootFake();
    const before = runtime.files.tree.getSnapshot();
    created.files.api.list = async () => {
      throw new Error("readdir");
    };
    created.files.putFromCommand("a.txt", "");
    await flush();
    expect(runtime.files.tree.getSnapshot()).toBe(before);
  });

  it("既にあるファイルに書くときは、操作の後に読み直さない", async () => {
    const { runtime, created } = await bootFake();
    const callsBefore = created.files.api.listCalls;
    await runtime.files.write("index.js", "changed");
    await flush();
    // 書き込みの通知による 1 回（ルートと src の 2 回の list）だけになる
    expect(created.files.api.listCalls - callsBefore).toBe(2);
  });

  it("node_modules のパッケージの中身だけの通知では、読み直さない", async () => {
    const { created } = await bootFake();
    created.files.putFromCommand("node_modules/cookie/index.js", "");
    await flush();
    const callsBefore = created.files.api.listCalls;
    created.files.putFromCommand("node_modules/cookie/lib/a.js", "");
    await flush();
    expect(created.files.api.listCalls - callsBefore).toBe(0);
  });

  it("通知が続いても、操作は自分の後の 1 回の読み直しで終わる", async () => {
    const { runtime, created } = await bootFake();
    const list = created.files.api.list;
    let notified = 0;
    // 読み直すたびに、コマンドがファイルを作り続ける
    created.files.api.list = async (directory) => {
      if (directory === "" && notified < 20) created.files.putFromCommand(`n${notified++}.txt`, "");
      return list(directory);
    };
    await runtime.files.createDirectory("dir");
    expect(notified).toBeLessThan(20);
  });

  it("ツリーの購読者が投げても、操作は成功として終わる", async () => {
    const { runtime } = await bootFake();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    runtime.files.tree.subscribe(() => {
      throw new Error("listener");
    });
    await expect(runtime.files.write("new.js", "")).resolves.toBeUndefined();
  });

  it("読み直しの途中で破棄しても、待っている操作は終わる", async () => {
    const { runtime, created } = await bootFake();
    const list = created.files.api.list;
    created.files.api.list = (directory) =>
      directory === "" ? new Promise(() => undefined) : list(directory);
    const pending = runtime.files.createDirectory("dir");
    await flush();
    await runtime.dispose();
    await expect(pending).resolves.toBeUndefined();
  });

  it("ツリーの購読者が投げても、次の通知で読み直す", async () => {
    const { runtime, created } = await bootFake();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const unsubscribe = runtime.files.tree.subscribe(() => {
      throw new Error("listener");
    });
    created.files.putFromCommand("a.txt", "");
    await flush();
    unsubscribe();
    created.files.putFromCommand("b.txt", "");
    await flush();
    expect(treePaths(runtime)).toContain("b.txt");
  });
});

describe("files.readAll", () => {
  const options = { exclude: ["node_modules"], maxBytes: 4 };

  it("作業ディレクトリのファイルを、パスと大きさと中身で、パスの順に返す", async () => {
    const { runtime } = await bootFake();
    expect(await runtime.files.readAll({ ...options, maxBytes: 100 })).toStrictEqual([
      { path: "index.js", kind: "file", size: 14, text: "console.log(1)" },
      { path: "package.json", kind: "file", size: 2, text: "{}" },
      { path: "src/app.js", kind: "file", size: 0, text: "" },
    ]);
  });

  it("exclude の名前に当たるディレクトリは、入れ子のものも読まない", async () => {
    const { runtime, created } = await bootFake();
    created.files.putFromCommand("node_modules/a/index.js", "");
    created.files.putFromCommand("src/node_modules/b/index.js", "");
    const paths = (await runtime.files.readAll(options)).map((file) => file.path);
    expect(paths).toStrictEqual(["index.js", "package.json", "src/app.js"]);
  });

  it.each([
    ["maxBytes を超えるファイル", "big.txt", "12345"],
    ["NUL を含むファイル", "nul.bin", new Uint8Array([0x61, 0])],
    ["UTF-8 として正しくないファイル", "bad.bin", new Uint8Array([0xff])],
  ])("%s は、text を null にして返す", async (_, path, contents) => {
    const { runtime, created } = await bootFake();
    created.files.putFromCommand(path, contents);
    const file = (await runtime.files.readAll(options)).find((entry) => entry.path === path);
    expect(file?.text).toBeNull();
  });

  it("ファイルでもディレクトリでもないもの（リンク）は、kind を other にして、指す先の中身を返す", async () => {
    const { runtime, created } = await bootFake();
    created.files.putLink("link.txt", "ab");
    const file = (await runtime.files.readAll(options)).find((entry) => entry.path === "link.txt");
    expect(file).toStrictEqual({ path: "link.txt", kind: "other", size: 2, text: "ab" });
  });

  it("ファイルでもディレクトリでもないもの（リンク）は、ツリーにファイルとして出す", async () => {
    const { runtime, created } = await bootFake();
    created.files.putLink("link.txt", "ab");
    await flush();
    const entry = runtime.files.tree.getSnapshot().find(({ path }) => path === "link.txt");
    expect(entry).toStrictEqual({ path: "link.txt", kind: "file" });
  });

  it("exclude に当たるものは、limit に数えない", async () => {
    const { runtime, created } = await bootFake();
    created.files.putFromCommand("node_modules/a/index.js", "1234567890");
    const files = await runtime.files.readAll({ ...options, limit: { files: 3, bytes: 16 } });
    expect(files).toHaveLength(3);
  });

  it.each([
    ["ファイルの数", { files: 2, bytes: 100 }],
    ["読んだ大きさの合計", { files: 100, bytes: 10 }],
  ])("%s が limit を超えると、ReadLimitError で失敗する", async (_, limit) => {
    const { runtime } = await bootFake();
    await expect(runtime.files.readAll({ ...options, limit })).rejects.toBeInstanceOf(
      ReadLimitError,
    );
  });

  it("limit を超えたら、残りのディレクトリの一覧を読まない", async () => {
    const { runtime, created } = await bootFake();
    for (const name of ["a", "b", "c"]) created.files.putFromCommand(`${name}/x/y/z.txt`, "");
    await flush();
    const countLists = async (read: () => Promise<unknown>) => {
      const before = created.files.api.listCalls;
      await read().catch(() => undefined);
      // 失敗した後も動いている枝が、一覧を読み始めるかを見る
      await new Promise((resolve) => setTimeout(resolve, 10));
      return created.files.api.listCalls - before;
    };
    // 子のディレクトリの一覧を、ルートのファイルを読み終えた後に返す
    const list = created.files.api.list;
    created.files.api.list = async (directory) => {
      if (directory !== "") await new Promise((resolve) => setTimeout(resolve, 0));
      return list(directory);
    };
    const all = await countLists(() => runtime.files.readAll(options));
    const limited = await countLists(() =>
      runtime.files.readAll({ ...options, limit: { files: 1, bytes: 100 } }),
    );
    // ルートのファイルを読んだ時点で超えるので、子のディレクトリの下の一覧を読まない
    expect(limited).toBeLessThan(all);
  });

  it("limit を超えたら、待っているファイルを読まない", async () => {
    const { runtime, created } = await bootFake();
    for (let i = 0; i < 100; i++) created.files.putFromCommand(`many/${i}.txt`, "");
    const readFile = vi.spyOn(created.files.api, "readFile");
    await expect(
      runtime.files.readAll({ ...options, limit: { files: 1, bytes: 100 } }),
    ).rejects.toBeInstanceOf(ReadLimitError);
    await new Promise((resolve) => setTimeout(resolve, 10));
    // 同時に読む数（32）と、超えるまでに読んだ分だけを読む
    expect(readFile.mock.calls.length).toBeLessThan(40);
  });

  it("同時に読むファイルの数より多いファイルも、limit が無ければ全てをパスの順に返す", async () => {
    const { runtime, created } = await bootFake();
    for (let i = 0; i < 100; i++)
      created.files.putFromCommand(`many/${String(i).padStart(3, "0")}`, "");
    const paths = (await runtime.files.readAll(options))
      .map(({ path }) => path)
      .filter((path) => path.startsWith("many/"));
    expect(paths).toStrictEqual(
      Array.from({ length: 100 }, (_, i) => `many/${String(i).padStart(3, "0")}`),
    );
  });

  it("同時に読むファイルは、32 個までである", async () => {
    const { runtime, created } = await bootFake();
    for (let i = 0; i < 100; i++) created.files.putFromCommand(`many/${i}.txt`, "");
    const readFile = created.files.api.readFile;
    let active = 0;
    let max = 0;
    created.files.api.readFile = async (path) => {
      active += 1;
      max = Math.max(max, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return readFile(path);
    };
    await runtime.files.readAll(options);
    expect(max).toBe(32);
  });

  it("同時に読むディレクトリの一覧も、ファイルと合わせて 32 個までである", async () => {
    const { runtime, created } = await bootFake();
    for (let i = 0; i < 100; i++) created.files.putFromCommand(`dirs/${i}/a.txt`, "");
    // ツリーの store が通知を受けて一覧を読み直すのを、数える前に終わらせる
    for (let i = 0; i < 10; i++) await flush();
    const { list, readFile } = created.files.api;
    let active = 0;
    let max = 0;
    const counted =
      <A extends unknown[], R>(operation: (...args: A) => Promise<R>) =>
      async (...args: A) => {
        active += 1;
        max = Math.max(max, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active -= 1;
        return operation(...args);
      };
    created.files.api.list = counted(list);
    created.files.api.readFile = counted(readFile);
    await runtime.files.readAll(options);
    expect(max).toBe(32);
  });

  it("limit の数と大きさちょうどなら、読み終える", async () => {
    const { runtime } = await bootFake();
    const files = await runtime.files.readAll({ ...options, limit: { files: 3, bytes: 16 } });
    expect(files).toHaveLength(3);
  });

  it("一覧を読んだ後に消えたファイルは、飛ばして返す", async () => {
    const { runtime, created } = await bootFake();
    const readFile = created.files.api.readFile;
    vi.spyOn(created.files.api, "readFile").mockImplementation((path) =>
      path === "index.js" ? Promise.reject(new Error("ENOENT")) : readFile(path),
    );
    const paths = (await runtime.files.readAll(options)).map((file) => file.path);
    expect(paths).toStrictEqual(["package.json", "src/app.js"]);
  });
});
