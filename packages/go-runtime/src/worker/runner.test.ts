import { describe, expect, it, vi } from "vitest";

import type { GoExit } from "../index";
import { type FromWorker, type ToWorker, type WorkerLike, createGoRunner } from "./runner";

type FakeWorker = WorkerLike & {
  sent: ToWorker[];
  terminated: boolean;
  emit: (message: FromWorker) => void;
  fail: (message: string) => void;
};

function fakeWorker(): FakeWorker {
  const worker: FakeWorker = {
    sent: [],
    terminated: false,
    postMessage: (message) => worker.sent.push(message),
    terminate: () => {
      worker.terminated = true;
    },
    onmessage: null,
    onerror: null,
    emit: (data) => worker.onmessage?.(new MessageEvent("message", { data })),
    fail: (message) =>
      worker.onerror?.(Object.assign(new Event("error"), { message }) as ErrorEvent),
  };
  return worker;
}

const module = {} as WebAssembly.Module;
const files = {
  "go.mod": "module example.com/app\n",
  "main.go": "package main",
  "a/a_test.go": "package a",
  "main_test.go": "package main",
};

function setup(compile: () => Promise<WebAssembly.Module> = () => Promise.resolve(module)) {
  const workers: FakeWorker[] = [];
  const runner = createGoRunner({
    compile,
    createWorker: () => {
      const worker = fakeWorker();
      workers.push(worker);
      return worker;
    },
  });
  return { runner, workers };
}

const nextWorker = async (workers: FakeWorker[], index: number) => {
  await vi.waitFor(() => expect(workers[index]).toBeDefined());
  return workers[index]!;
};

describe("createGoRunner", () => {
  it("load は 1 度だけコンパイルし、段階を ready にする", async () => {
    const compile = vi.fn(() => Promise.resolve(module));
    const { runner } = setup(compile);
    expect(runner.phase.getSnapshot()).toStrictEqual({ kind: "idle" });
    const loading = runner.load();
    expect(runner.phase.getSnapshot()).toStrictEqual({ kind: "loading" });
    await Promise.all([loading, runner.load()]);
    expect(runner.phase.getSnapshot()).toStrictEqual({ kind: "ready" });
    expect(compile).toHaveBeenCalledTimes(1);
  });

  it("コンパイルに失敗したら failed を返し、次の呼び出しで取得し直す", async () => {
    const compile = vi
      .fn<() => Promise<WebAssembly.Module>>()
      .mockRejectedValueOnce(new Error("404"))
      .mockResolvedValue(module);
    const { runner, workers } = setup(compile);
    const failed: GoExit = await runner.run(files, () => {}).done;
    expect(failed).toStrictEqual({ kind: "failed", message: "Yaegi を読み込めませんでした: 404" });
    expect(runner.phase.getSnapshot()).toStrictEqual({ kind: "failed", message: "404" });
    expect(workers).toHaveLength(0);
    await runner.load();
    expect(runner.phase.getSnapshot()).toStrictEqual({ kind: "ready" });
    expect(compile).toHaveBeenCalledTimes(2);
  });

  it("run は module の名前を付けて送り、出力と終了コードを返す", async () => {
    const { runner, workers } = setup();
    const output: string[] = [];
    const execution = runner.run(files, (chunk) => output.push(chunk));
    const worker = await nextWorker(workers, 0);
    expect(worker.sent[0]).toStrictEqual({
      module,
      input: { files, module: "example.com/app", mode: "run", package: "example.com/app" },
    });
    worker.emit({ type: "output", chunk: "hello\n" });
    worker.emit({ type: "exit", code: 3 });
    expect(await execution.done).toStrictEqual({ kind: "exited", exitCode: 3 });
    expect(output).toStrictEqual(["hello\n"]);
    expect(worker.terminated).toBe(true);
  });

  it("stop は Web Worker を終了させ、stopped を返す。次の実行は新しい Web Worker で動く", async () => {
    const { runner, workers } = setup();
    const first = runner.run(files, () => {});
    const worker = await nextWorker(workers, 0);
    first.stop();
    expect(await first.done).toStrictEqual({ kind: "stopped" });
    expect(worker.terminated).toBe(true);
    const second = runner.run(files, () => {});
    (await nextWorker(workers, 1)).emit({ type: "exit", code: 0 });
    expect(await second.done).toStrictEqual({ kind: "exited", exitCode: 0 });
  });

  it("読み込み中に止めたときは、読み込みを待たずに stopped を返し、Web Worker を作らない", async () => {
    let finish: (value: WebAssembly.Module) => void = () => {};
    const { runner, workers } = setup(() => new Promise((resolve) => (finish = resolve)));
    const execution = runner.run(files, () => {});
    execution.stop();
    expect(await execution.done).toStrictEqual({ kind: "stopped" });
    finish(module);
    await runner.load();
    expect(workers).toHaveLength(0);
  });

  it("Web Worker が異常終了したら failed を返す", async () => {
    const { runner, workers } = setup();
    const execution = runner.run(files, () => {});
    (await nextWorker(workers, 0)).fail("out of memory");
    expect(await execution.done).toStrictEqual({
      kind: "failed",
      message: "Go の Web Worker が止まりました: out of memory",
    });
  });

  it("test は package ごとに Web Worker を作り直し、package ごとの結果の行と、全体の終了コードを返す", async () => {
    const { runner, workers } = setup();
    const output: string[] = [];
    const execution = runner.test(files, (chunk) => output.push(chunk));
    const first = await nextWorker(workers, 0);
    expect(first.sent[0]?.input.package).toBe("example.com/app");
    first.emit({ type: "output", chunk: "--- FAIL: TestX\n" });
    first.emit({ type: "exit", code: 1 });
    const second = await nextWorker(workers, 1);
    expect(second.sent[0]?.input).toMatchObject({ mode: "test", package: "example.com/app/a" });
    second.emit({ type: "exit", code: 0 });
    expect(await execution.done).toStrictEqual({ kind: "exited", exitCode: 1 });
    expect(output).toStrictEqual([
      "--- FAIL: TestX\n",
      "FAIL\texample.com/app\n",
      "ok  \texample.com/app/a\n",
    ]);
  });

  it("test の途中で止めたら、残りの package を実行しない", async () => {
    const { runner, workers } = setup();
    const execution = runner.test(files, () => {});
    await nextWorker(workers, 0);
    execution.stop();
    expect(await execution.done).toStrictEqual({ kind: "stopped" });
    expect(workers).toHaveLength(1);
  });

  it("段階の変化を通知し、解除した後は通知しない", async () => {
    const { runner } = setup(() => Promise.reject(new Error("offline")));
    const onChange = vi.fn();
    const unsubscribe = runner.phase.subscribe(onChange);
    await runner.load();
    unsubscribe();
    await runner.load();
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("Error でない失敗も、段階の文にする", async () => {
    const { runner } = setup(() => Promise.reject("offline"));
    await runner.load();
    expect(runner.phase.getSnapshot()).toStrictEqual({ kind: "failed", message: "offline" });
  });

  it("理由の無い異常終了は、止まったことだけを文にする", async () => {
    const { runner, workers } = setup();
    const execution = runner.run(files, () => {});
    (await nextWorker(workers, 0)).fail("");
    expect(await execution.done).toStrictEqual({
      kind: "failed",
      message: "Go の Web Worker が止まりました",
    });
  });

  it("Web Worker が WASM を動かせなかったと知らせたら、failed を返す", async () => {
    const { runner, workers } = setup();
    const execution = runner.run(files, () => {});
    (await nextWorker(workers, 0)).emit({ type: "crashed", message: "bad module" });
    expect(await execution.done).toStrictEqual({
      kind: "failed",
      message: "Go の Web Worker が止まりました: bad module",
    });
  });

  it("Web Worker を作れないときは、failed を返す", async () => {
    const runner = createGoRunner({
      compile: () => Promise.resolve(module),
      createWorker: () => {
        throw new Error("blocked");
      },
    });
    expect(await runner.run(files, () => {}).done).toStrictEqual({
      kind: "failed",
      message: "Go の Web Worker が止まりました: blocked",
    });
  });

  it("Web Worker に送れないときは、Web Worker を終了させて failed を返す", async () => {
    const worker = fakeWorker();
    worker.postMessage = () => {
      throw new Error("DataCloneError");
    };
    const runner = createGoRunner({
      compile: () => Promise.resolve(module),
      createWorker: () => worker,
    });
    const exit = await runner.run(files, () => {}).done;
    expect([exit, worker.terminated]).toStrictEqual([
      { kind: "failed", message: "Go の Web Worker が止まりました: DataCloneError" },
      true,
    ]);
  });

  it("テストのファイルが無いときは、Web Worker を作らずに 0 で終える", async () => {
    const { runner, workers } = setup();
    const output: string[] = [];
    const exit = await runner.test({ "main.go": "package main" }, (c) => output.push(c)).done;
    expect(exit).toStrictEqual({ kind: "exited", exitCode: 0 });
    expect(output).toStrictEqual(["テストのファイル（_test.go）がありません\n"]);
    expect(workers).toHaveLength(0);
  });
});
