import { describe, expect, it, vi } from "vitest";

import { createOutputLog } from "./output";
import { createStore } from "./store";
import { bootFake, flush } from "./test/fake-backend";

describe("processes", () => {
  it("start は、名前を付けて、動いているプロセスとして一覧に入れる", async () => {
    const { runtime } = await bootFake();
    const handle = await runtime.processes.start("node", ["index.js"], { name: "server" });
    expect(runtime.processes.list.getSnapshot()).toStrictEqual([
      { id: handle.id, kind: "command", name: "server", status: { kind: "running" } },
    ]);
  });

  it("終了したプロセスは、一覧で終了コードを持つ", async () => {
    const { runtime, created } = await bootFake();
    const handle = await runtime.processes.start("node", ["index.js"], { name: "server" });
    created.processes[0]?.finish(0);
    await handle.exit;
    expect(runtime.processes.list.getSnapshot()).toStrictEqual([
      { id: handle.id, kind: "command", name: "server", status: { kind: "exited", code: 0 } },
    ]);
  });

  it("名前を渡さないときは、コマンドと引数を名前にする", async () => {
    const { runtime } = await bootFake();
    await runtime.processes.start("npm", ["install"]);
    expect(runtime.processes.list.getSnapshot()[0]?.name).toBe("npm install");
  });

  it("startShell は、シェルとして一覧に入れる", async () => {
    const { runtime } = await bootFake();
    await runtime.processes.startShell({ name: "シェル" });
    expect(runtime.processes.list.getSnapshot()[0]?.kind).toBe("shell");
  });

  it("startShell は、端末の大きさを渡して、シェルを起動する", async () => {
    const { runtime, created } = await bootFake();
    await runtime.processes.startShell({ terminal: { cols: 100, rows: 30 } });
    expect([created.processes[0]?.command, created.processes[0]?.terminal]).toStrictEqual([
      "jsh",
      { cols: 100, rows: 30 },
    ]);
  });

  it("名前を渡さないシェルは、シェルの名前で一覧に入れる", async () => {
    const { runtime } = await bootFake();
    await runtime.processes.startShell();
    expect(runtime.processes.list.getSnapshot()[0]?.name).toBe("シェル");
  });

  it("出力を、今までの出力の read で渡す", async () => {
    const { runtime, created } = await bootFake();
    const handle = await runtime.processes.start("node", ["index.js"]);
    created.processes[0]?.emit("a");
    created.processes[0]?.emit("b");
    expect(handle.output.read()).toBe("ab");
  });

  it("購読した後の出力だけを、subscribe で渡す", async () => {
    const { runtime, created } = await bootFake();
    const handle = await runtime.processes.start("node", ["index.js"]);
    created.processes[0]?.emit("a");
    const onChunk = vi.fn();
    handle.output.subscribe(onChunk);
    created.processes[0]?.emit("b");
    expect(onChunk.mock.calls).toStrictEqual([["b"]]);
  });

  it.each([
    ["起動したプロセスの id", true],
    ["無い id", false],
  ])("get は、%s で、プロセスを返すか: %s", async (_, known) => {
    const { runtime } = await bootFake();
    const handle = await runtime.processes.start("node", []);
    expect(runtime.processes.get(known ? handle.id : "missing")).toBe(known ? handle : undefined);
  });

  it("入力と端末の大きさを、実装のプロセスに渡す", async () => {
    const { runtime, created } = await bootFake();
    const handle = await runtime.processes.startShell();
    handle.write("ls\r");
    handle.resize({ cols: 120, rows: 40 });
    expect([created.processes[0]?.written, created.processes[0]?.terminal]).toStrictEqual([
      ["ls\r"],
      { cols: 120, rows: 40 },
    ]);
  });

  it("kill を、実装のプロセスに渡す", async () => {
    const { runtime } = await bootFake();
    const handle = await runtime.processes.startShell();
    handle.kill();
    expect(await handle.exit).toBe(130);
  });

  it("実装の exit が失敗したときは、終了コード 1 で終了したことにする", async () => {
    const { runtime, created } = await bootFake();
    const handle = await runtime.processes.start("node", []);
    created.processes[0]?.fail(new Error("crash"));
    expect(await handle.exit).toBe(1);
  });

  it("終了した後の出力は、記録しない", async () => {
    const { runtime, created } = await bootFake();
    const handle = await runtime.processes.start("node", []);
    created.processes[0]?.finish(0);
    await handle.exit;
    await flush();
    created.processes[0]?.emit("late");
    expect(handle.output.read()).toBe("");
  });
});

describe("createOutputLog", () => {
  it("上限を超えたときは、古い側から捨てる", () => {
    const log = createOutputLog(5);
    log.append("abc");
    log.append("defg");
    expect(log.read()).toBe("cdefg");
  });

  it("上限の 2 倍を超えて足しても、読むと上限の文字数にする", () => {
    const log = createOutputLog(3);
    for (const chunk of ["ab", "cd", "ef", "gh"]) log.append(chunk);
    expect(log.read()).toBe("fgh");
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
  });
});
