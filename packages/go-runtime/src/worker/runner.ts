import {
  type GoExecution,
  type GoExit,
  type GoFiles,
  type GoRunner,
  type LoadPhase,
  type Store,
  moduleName,
  testPackages,
} from "../index";

/** ページから Web Worker に送る値。WASM はコンパイル済みの Module で渡し、Web Worker ではコンパイルしない。 */
export type ToWorker = {
  module: WebAssembly.Module;
  input: { files: GoFiles; module: string; mode: "run" | "test"; package: string };
};

export type FromWorker = { type: "output"; chunk: string } | { type: "exit"; code: number };

/** createGoRunner が使う Web Worker の操作。テストでは、同じ形の偽物を渡す。 */
export type WorkerLike = {
  postMessage: (message: ToWorker) => void;
  terminate: () => void;
  addEventListener: (type: "message" | "error", listener: (event: Event) => void) => void;
};

export type GoRunnerOptions = {
  /** Yaegi の WASM を取得し、コンパイルする。 */
  compile: () => Promise<WebAssembly.Module>;
  createWorker: () => WorkerLike;
};

const STOPPED = "Go の Web Worker が止まりました";

function createStore<T>(initial: T): Store<T> & { set: (value: T) => void } {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    subscribe: (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    getSnapshot: () => value,
    set: (next) => {
      value = next;
      for (const listener of listeners) listener();
    },
  };
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Yaegi を Web Worker で動かす GoRunner。WASM は、最初の load か実行で取得してコンパイルし、失敗したときは次の呼び出しで取得し直す。
 * 実行のたびに Web Worker と WASM のインスタンスを作り直す。testing.Main が os.Exit で終わり、インスタンスを使い回せないためである (ADR-0037)。
 */
export function createGoRunner({ compile, createWorker }: GoRunnerOptions): GoRunner {
  const phase = createStore<LoadPhase>({ kind: "idle" });
  let compiled: Promise<WebAssembly.Module> | undefined;

  const loadModule = (): Promise<WebAssembly.Module> => {
    if (compiled) return compiled;
    phase.set({ kind: "loading" });
    const loading = compile().then(
      (module) => {
        phase.set({ kind: "ready" });
        return module;
      },
      (error: unknown) => {
        compiled = undefined;
        phase.set({ kind: "failed", message: messageOf(error) });
        throw error;
      },
    );
    compiled = loading;
    return loading;
  };

  const execute = (
    run: (start: (input: ToWorker["input"]) => Promise<GoExit>) => Promise<GoExit>,
    onOutput: (chunk: string) => void,
  ): GoExecution => {
    let current: { resolve: (exit: GoExit) => void } | undefined;
    let stopped = false;
    let resolveStop: (exit: GoExit) => void = () => {};
    // 読み込み中に止めたときも、読み込みを待たずに終える
    const stoppedEarly = new Promise<GoExit>((resolve) => {
      resolveStop = resolve;
    });

    const start = async (input: ToWorker["input"]): Promise<GoExit> => {
      let module: WebAssembly.Module;
      try {
        module = await loadModule();
      } catch (error) {
        return { kind: "failed", message: `Yaegi を読み込めませんでした: ${messageOf(error)}` };
      }
      if (stopped) return { kind: "stopped" };
      return new Promise<GoExit>((resolve) => {
        const worker = createWorker();
        const finish = (exit: GoExit) => {
          worker.terminate();
          current = undefined;
          resolve(exit);
        };
        current = { resolve: finish };
        worker.addEventListener("message", (event) => {
          const message = (event as MessageEvent<FromWorker>).data;
          if (message.type === "output") onOutput(message.chunk);
          else finish({ kind: "exited", exitCode: message.code });
        });
        worker.addEventListener("error", (event) => {
          const detail = (event as ErrorEvent).message;
          finish({ kind: "failed", message: detail ? `${STOPPED}: ${detail}` : STOPPED });
        });
        worker.postMessage({ module, input });
      });
    };

    return {
      done: Promise.race([run(start), stoppedEarly]),
      stop: () => {
        stopped = true;
        current?.resolve({ kind: "stopped" });
        resolveStop({ kind: "stopped" });
      },
    };
  };

  return {
    phase,
    load: async () => {
      await loadModule().catch(() => undefined);
    },
    run: (files, onOutput) => {
      const module = moduleName(files);
      return execute((start) => start({ files, module, mode: "run", package: module }), onOutput);
    },
    test: (files, onOutput) => {
      const module = moduleName(files);
      const packages = testPackages(files, module);
      return execute(async (start) => {
        if (packages.length === 0) {
          onOutput("テストのファイル（_test.go）がありません\n");
          return { kind: "exited", exitCode: 0 };
        }
        let failed = false;
        for (const name of packages) {
          const exit = await start({ files, module, mode: "test", package: name });
          if (exit.kind !== "exited") return exit;
          failed ||= exit.exitCode !== 0;
          onOutput(`${exit.exitCode === 0 ? "ok  " : "FAIL"}\t${name}\n`);
        }
        return { kind: "exited", exitCode: failed ? 1 : 0 };
      }, onOutput);
    },
  };
}
