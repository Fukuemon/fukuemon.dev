import { afterEach, describe, expect, it, vi } from "vitest";

import { bootFake, flush, treePaths } from "./test/fake-backend";

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
