import { afterEach, describe, expect, it, vi } from "vitest";

import { createOutputLog } from "./output";
import { bootWithBackend } from "./runtime";
import { createStore } from "./store";
import { createFakeBackend } from "./test/fake-backend";
import { BootError, type NodeRuntime } from "./types";

const files = {
  "package.json": "{}",
  "index.js": "console.log(1)",
  "src/app.js": "",
};

async function boot() {
  const fake = createFakeBackend();
  const runtime = await bootWithBackend(fake.backend, { files });
  const created = fake.instances[0];
  if (!created) throw new Error("起動していない");
  return { fake, runtime, created };
}

const paths = (runtime: NodeRuntime) => runtime.files.tree.getSnapshot().map((entry) => entry.path);

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  vi.useRealTimers();
});

describe("bootWithBackend", () => {
  it("初期ファイルで起動し、ファイルのツリーを、ディレクトリを先に名前の順で返す", async () => {
    const { runtime } = await boot();
    expect(runtime.files.tree.getSnapshot()).toStrictEqual([
      { path: "src", kind: "directory" },
      { path: "src/app.js", kind: "file" },
      { path: "index.js", kind: "file" },
      { path: "package.json", kind: "file" },
    ]);
  });

  it("cross-origin isolation が無いときは、起動せずに not-isolated で失敗する", async () => {
    const fake = createFakeBackend({ supported: false });
    await expect(bootWithBackend(fake.backend, { files })).rejects.toMatchObject({
      reason: "not-isolated",
    });
    expect(fake.instances).toHaveLength(0);
  });

  it("実装の起動の失敗は、failed で失敗し、元の誤りを cause に持つ", async () => {
    const fake = createFakeBackend();
    const cause = new Error("boot");
    fake.failBoot(cause);
    const error = await bootWithBackend(fake.backend, { files }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BootError);
    expect(error).toMatchObject({ reason: "failed", cause });
  });

  it("上限までに起動しないときは、timeout で失敗し、後から起動した実行環境を破棄する", async () => {
    vi.useFakeTimers();
    const fake = createFakeBackend();
    const release = fake.holdBoot();
    const booting = bootWithBackend(fake.backend, { files }, 1000);
    const assertion = expect(booting).rejects.toMatchObject({ reason: "timeout" });
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;

    vi.useRealTimers();
    release();
    await flush();
    expect(fake.instances[0]?.state.tornDown).toBe(true);
  });

  it("ツリーを読めないときは、起動した実行環境を破棄して failed で失敗する", async () => {
    const fake = createFakeBackend();
    const boot = fake.backend.boot;
    fake.backend.boot = async (options) => {
      const instance = await boot(options);
      instance.files.list = async () => {
        throw new Error("readdir");
      };
      return instance;
    };
    await expect(bootWithBackend(fake.backend, { files })).rejects.toMatchObject({
      reason: "failed",
    });
    expect(fake.instances[0]?.state.tornDown).toBe(true);
  });
});

describe("files", () => {
  it("ファイルを作ると、ツリーに出る", async () => {
    const { runtime } = await boot();
    await runtime.files.write("src/new.js", "1");
    expect(paths(runtime)).toContain("src/new.js");
    expect(await runtime.files.read("src/new.js")).toBe("1");
  });

  it("ディレクトリを作ると、ツリーにディレクトリとして出る", async () => {
    const { runtime } = await boot();
    await runtime.files.createDirectory("lib");
    expect(runtime.files.tree.getSnapshot()).toContainEqual({ path: "lib", kind: "directory" });
  });

  it("名前を変えると、ディレクトリの下のファイルも、新しいパスで出る", async () => {
    const { runtime } = await boot();
    await runtime.files.rename("src", "app");
    expect(paths(runtime)).toStrictEqual(["app", "app/app.js", "index.js", "package.json"]);
  });

  it("削除すると、ツリーから消える", async () => {
    const { runtime } = await boot();
    await runtime.files.remove("src");
    expect(paths(runtime)).toStrictEqual(["index.js", "package.json"]);
  });

  it("コマンドが作ったファイルも、変更の通知を受けてツリーに出る", async () => {
    const { runtime, created } = await boot();
    created.files.putFromCommand("out.txt", "");
    await flush();
    expect(paths(runtime)).toContain("out.txt");
  });

  it("node_modules の下は、パッケージのディレクトリまでを出し、中身を出さない", async () => {
    const { runtime, created } = await boot();
    created.files.putFromCommand("node_modules/cookie/index.js", "");
    created.files.putFromCommand("node_modules/@types/node/index.d.ts", "");
    created.files.putFromCommand("node_modules/.package-lock.json", "");
    await flush();
    expect(paths(runtime).filter((path) => path.startsWith("node_modules"))).toStrictEqual([
      "node_modules",
      "node_modules/@types",
      "node_modules/@types/node",
      "node_modules/cookie",
      "node_modules/.package-lock.json",
    ]);
  });

  it("入れ子の node_modules の下も、パッケージのディレクトリまでにする", async () => {
    const { runtime, created } = await boot();
    created.files.putFromCommand("src/node_modules/a/index.js", "");
    await flush();
    expect(paths(runtime)).toContain("src/node_modules/a");
    expect(paths(runtime)).not.toContain("src/node_modules/a/index.js");
  });

  it("変更の通知を、changes の購読者に渡す", async () => {
    const { runtime, created } = await boot();
    const onChange = vi.fn();
    const unsubscribe = runtime.files.changes.subscribe(onChange);
    created.files.putFromCommand("a.txt", "");
    unsubscribe();
    created.files.putFromCommand("b.txt", "");
    expect(onChange.mock.calls).toStrictEqual([[["a.txt"]]]);
  });

  it("ツリーが変わらない通知では、同じ参照を返す", async () => {
    const { runtime } = await boot();
    const before = runtime.files.tree.getSnapshot();
    await runtime.files.write("index.js", "changed");
    expect(runtime.files.tree.getSnapshot()).toBe(before);
  });

  it("読み直している間に通知が来たときは、終わってからもう 1 度読み直す", async () => {
    const { runtime, created } = await boot();
    const callsBefore = created.files.api.listCalls;
    created.files.putFromCommand("a.txt", "");
    created.files.putFromCommand("b.txt", "");
    created.files.putFromCommand("c.txt", "");
    await flush();
    expect(paths(runtime)).toEqual(expect.arrayContaining(["a.txt", "b.txt", "c.txt"]));
    // ルートと src の 2 回の list が、1 回の読み直しに当たる。3 つの通知を、2 回の読み直しにまとめる
    expect(created.files.api.listCalls - callsBefore).toBe(4);
  });

  it("読み直しが失敗したときは、前のツリーを残す", async () => {
    const { runtime, created } = await boot();
    const before = runtime.files.tree.getSnapshot();
    created.files.api.list = async () => {
      throw new Error("readdir");
    };
    created.files.putFromCommand("a.txt", "");
    await flush();
    expect(runtime.files.tree.getSnapshot()).toBe(before);
  });
});

describe("processes", () => {
  it("start は、名前を付けて一覧に入れ、終了すると終了コードを持つ", async () => {
    const { runtime, created } = await boot();
    const handle = await runtime.processes.start("node", ["index.js"], { name: "server" });
    expect(runtime.processes.list.getSnapshot()).toStrictEqual([
      { id: handle.id, name: "server", status: { kind: "running" } },
    ]);
    created.processes[0]?.finish(0);
    expect(await handle.exit).toBe(0);
    expect(runtime.processes.list.getSnapshot()[0]?.status).toStrictEqual({
      kind: "exited",
      code: 0,
    });
  });

  it("名前を渡さないときは、コマンドと引数を名前にする", async () => {
    const { runtime } = await boot();
    await runtime.processes.start("npm", ["install"]);
    expect(runtime.processes.list.getSnapshot()[0]?.name).toBe("npm install");
  });

  it("startShell は、シェルを起動して一覧に入れる", async () => {
    const { runtime, created } = await boot();
    await runtime.processes.startShell({ terminal: { cols: 100, rows: 30 } });
    expect(created.processes[0]).toMatchObject({
      command: "jsh",
      terminal: { cols: 100, rows: 30 },
    });
    expect(runtime.processes.list.getSnapshot()[0]?.name).toBe("シェル");
  });

  it("出力を、今までの出力の read と、追加の出力の subscribe で渡す", async () => {
    const { runtime, created } = await boot();
    const handle = await runtime.processes.start("node", ["index.js"]);
    created.processes[0]?.emit("a");
    const onChunk = vi.fn();
    handle.output.subscribe(onChunk);
    created.processes[0]?.emit("b");
    expect(handle.output.read()).toBe("ab");
    expect(onChunk.mock.calls).toStrictEqual([["b"]]);
  });

  it("get は、起動したプロセスを id で返す", async () => {
    const { runtime } = await boot();
    const handle = await runtime.processes.start("node", []);
    expect(runtime.processes.get(handle.id)).toBe(handle);
    expect(runtime.processes.get("missing")).toBeUndefined();
  });

  it("入力、端末の大きさ、kill を、実装のプロセスに渡す", async () => {
    const { runtime, created } = await boot();
    const handle = await runtime.processes.startShell();
    handle.write("ls\r");
    handle.resize({ cols: 120, rows: 40 });
    handle.kill();
    expect(created.processes[0]).toMatchObject({
      written: ["ls\r"],
      terminal: { cols: 120, rows: 40 },
    });
    expect(await handle.exit).toBe(130);
  });

  it("実装の exit が失敗したときは、終了コード 1 で終了したことにする", async () => {
    const { runtime, created } = await boot();
    const handle = await runtime.processes.start("node", []);
    created.processes[0]?.fail(new Error("crash"));
    expect(await handle.exit).toBe(1);
    expect(runtime.processes.list.getSnapshot()[0]?.status).toStrictEqual({
      kind: "exited",
      code: 1,
    });
  });

  it("終了した後の出力は、記録しない", async () => {
    const { runtime, created } = await boot();
    const handle = await runtime.processes.start("node", []);
    created.processes[0]?.finish(0);
    await handle.exit;
    await flush();
    created.processes[0]?.emit("late");
    expect(handle.output.read()).toBe("");
  });
});

describe("ports", () => {
  it("実装が知らせたポートを、store で返す", async () => {
    const { runtime, created } = await boot();
    const port = { port: 3000, url: "https://a", sandbox: "allow-scripts", allow: "" };
    created.emitPorts([port]);
    expect(runtime.ports.getSnapshot()).toStrictEqual([port]);
  });
});

describe("dispose", () => {
  it("実装を破棄し、通知の購読を外す。2 回呼んでも 1 回だけ破棄する", async () => {
    const { runtime, created } = await boot();
    const teardown = vi.spyOn(created.instance, "teardown");
    await Promise.all([runtime.dispose(), runtime.dispose()]);
    expect(teardown).toHaveBeenCalledTimes(1);
    expect(created.files.watchers()).toBe(0);
    expect(created.portListeners()).toBe(0);
  });

  it("破棄した後の通知では、ツリーを読み直さない", async () => {
    const { runtime, created } = await boot();
    const before = runtime.files.tree.getSnapshot();
    const write = created.files.api.writeFile;
    await runtime.dispose();
    await write("late.txt", "");
    await flush();
    expect(runtime.files.tree.getSnapshot()).toBe(before);
  });

  it("HTTP とコンソールの記録は、空の store を返す", async () => {
    const { runtime } = await boot();
    expect(runtime.httpExchanges.getSnapshot()).toStrictEqual([]);
    expect(runtime.consoleEntries.getSnapshot()).toStrictEqual([]);
  });
});

describe("createOutputLog", () => {
  it("上限を超えたときは、古い側から捨てる", () => {
    const log = createOutputLog(5);
    log.append("abc");
    log.append("defg");
    expect(log.read()).toBe("cdefg");
  });
});

describe("createStore", () => {
  it("同じ値を入れたときは、通知しない", () => {
    const store = createStore(1);
    const onChange = vi.fn();
    store.subscribe(onChange);
    store.set(1);
    store.set(2);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe(2);
  });
});
