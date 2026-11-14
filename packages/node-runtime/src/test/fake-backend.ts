import {
  type BackendFiles,
  type BackendInstance,
  type BackendProcess,
  type DirectoryItem,
  PathNotFoundError,
  type RuntimeBackend,
} from "../backend";
import { bootWithBackend } from "../runtime";
import type { NodeRuntime, OpenPort, TerminalSize } from "../types";

/** テストから操作するプロセス。出力を流し、終了させる。 */
export type FakeProcess = BackendProcess & {
  command: string;
  args: readonly string[];
  terminal: TerminalSize | undefined;
  written: string[];
  emit: (chunk: string) => void;
  finish: (code: number) => void;
  fail: (error: unknown) => void;
};

function createFakeProcess(
  command: string,
  args: readonly string[],
  terminal: TerminalSize | undefined,
): FakeProcess {
  const listeners = new Set<(chunk: string) => void>();
  let finish: (code: number) => void = () => undefined;
  let fail: (error: unknown) => void = () => undefined;
  const exit = new Promise<number>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  const process: FakeProcess = {
    command,
    args,
    terminal,
    written: [],
    output: {
      subscribe: (onChunk) => {
        listeners.add(onChunk);
        return () => listeners.delete(onChunk);
      },
    },
    write: (data) => process.written.push(data),
    resize: (size) => {
      process.terminal = size;
    },
    kill: () => finish(130),
    exit,
    emit: (chunk) => {
      for (const listener of listeners) listener(chunk);
    },
    finish: (code) => finish(code),
    fail: (error) => fail(error),
  };
  return process;
}

/** メモリの上のファイル。ディレクトリは、パスの集合で持つ。 */
function createFakeFiles(initial: Readonly<Record<string, string>>) {
  const files = new Map<string, Uint8Array>();
  const directories = new Set<string>();
  /** ファイルでもディレクトリでもないもの（リンク）のパス。中身は files に持つ。 */
  const others = new Set<string>();
  const listeners = new Set<(paths: readonly string[]) => void>();
  const encoder = new TextEncoder();

  const addParents = (path: string) => {
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) directories.add(parts.slice(0, i).join("/"));
  };
  const notify = (paths: readonly string[]) => {
    for (const listener of listeners) listener(paths);
  };
  const putFile = (path: string, contents: string | Uint8Array) => {
    addParents(path);
    files.set(path, typeof contents === "string" ? encoder.encode(contents) : contents);
  };
  const within = (path: string, root: string) => path === root || path.startsWith(`${root}/`);

  for (const [path, contents] of Object.entries(initial)) putFile(path, contents);

  const api: BackendFiles & { listCalls: number } = {
    listCalls: 0,
    list: async (directory) => {
      api.listCalls++;
      if (directory !== "" && !directories.has(directory)) {
        throw new PathNotFoundError(`ENOENT: ${directory}`);
      }
      const prefix = directory === "" ? "" : `${directory}/`;
      const children = new Map<string, DirectoryItem>();
      for (const path of directories) {
        if (
          path.startsWith(prefix) &&
          !path.slice(prefix.length).includes("/") &&
          path !== directory
        ) {
          children.set(path, { name: path.slice(prefix.length), kind: "directory" });
        }
      }
      for (const path of files.keys()) {
        if (path.startsWith(prefix) && !path.slice(prefix.length).includes("/")) {
          children.set(path, {
            name: path.slice(prefix.length),
            kind: others.has(path) ? "other" : "file",
          });
        }
      }
      return [...children.values()];
    },
    readFile: async (path) => {
      const contents = files.get(path);
      if (!contents) throw new PathNotFoundError(`ENOENT: ${path}`);
      return contents;
    },
    writeFile: async (path, contents) => {
      putFile(path, contents);
      notify([path]);
    },
    mkdir: async (path) => {
      addParents(path);
      directories.add(path);
      notify([path]);
    },
    rename: async (from, to) => {
      // 回している間に足したパスを、もう 1 度回さないように、先に配列へ写す
      for (const [path, contents] of Array.from(files)) {
        if (within(path, from)) {
          files.delete(path);
          putFile(to + path.slice(from.length), contents);
          if (others.delete(path)) others.add(to + path.slice(from.length));
        }
      }
      for (const path of Array.from(directories)) {
        if (within(path, from)) {
          directories.delete(path);
          directories.add(to + path.slice(from.length));
        }
      }
      notify([from, to]);
    },
    remove: async (path) => {
      for (const file of files.keys()) {
        if (within(file, path)) {
          files.delete(file);
          others.delete(file);
        }
      }
      for (const directory of directories)
        if (within(directory, path)) directories.delete(directory);
      notify([path]);
    },
    watch: (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
  };
  return {
    api,
    /** 実行環境の中のコマンドがファイルを作ったときと同じく、操作の関数を通さずに書いて、通知を出す。 */
    putFromCommand: (path: string, contents: string | Uint8Array) => {
      putFile(path, contents);
      notify([path]);
    },
    /** シェルでシンボリックリンクを作ったときと同じく、一覧で other になる項目を作って、通知を出す。contents は指す先の中身である。 */
    putLink: (path: string, contents: string) => {
      putFile(path, contents);
      others.add(path);
      notify([path]);
    },
    watchers: () => listeners.size,
  };
}

/** WebContainers の代わりに、テストが使う実装。起動した実行環境と、起動したプロセスを、テストから読める。 */
export function createFakeBackend(options: { supported?: boolean } = {}) {
  const instances: ReturnType<typeof createInstance>[] = [];
  const previewScripts: string[] = [];
  let bootGate: Promise<void> = Promise.resolve();
  let bootError: unknown;

  function createInstance(initial: Readonly<Record<string, string>>) {
    const files = createFakeFiles(initial);
    const processes: FakeProcess[] = [];
    const portListeners = new Set<(ports: readonly OpenPort[]) => void>();
    const messageListeners = new Set<(message: unknown, port: number) => void>();
    const state = { tornDown: false };
    const instance: BackendInstance = {
      files: files.api,
      spawn: async (command, args, spawnOptions = {}) => {
        const process = createFakeProcess(command, args, spawnOptions.terminal);
        processes.push(process);
        return process;
      },
      spawnShell: async (spawnOptions = {}) => {
        const process = createFakeProcess("jsh", [], spawnOptions.terminal);
        processes.push(process);
        return process;
      },
      ports: {
        subscribe: (onChange) => {
          portListeners.add(onChange);
          return () => portListeners.delete(onChange);
        },
      },
      previewMessages: {
        subscribe: (onMessage) => {
          messageListeners.add(onMessage);
          return () => messageListeners.delete(onMessage);
        },
      },
      teardown: async () => {
        state.tornDown = true;
      },
    };
    return {
      instance,
      files,
      processes,
      state,
      emitPorts: (ports: readonly OpenPort[]) => {
        for (const listener of portListeners) listener(ports);
      },
      portListeners: () => portListeners.size,
      emitPreviewMessage: (message: unknown, port: number) => {
        for (const listener of messageListeners) listener(message, port);
      },
      messageListeners: () => messageListeners.size,
    };
  }

  const backend: RuntimeBackend = {
    isSupported: () => options.supported ?? true,
    boot: async ({ files, previewScript }) => {
      await bootGate;
      if (bootError !== undefined) throw bootError;
      previewScripts.push(previewScript);
      const created = createInstance(files);
      instances.push(created);
      return created.instance;
    },
  };

  return {
    backend,
    instances,
    previewScripts,
    /** 返した関数を呼ぶまで、boot を終わらせない。 */
    holdBoot: () => {
      let release: () => void = () => undefined;
      bootGate = new Promise((resolve) => {
        release = resolve;
      });
      return release;
    },
    failBoot: (error: unknown) => {
      bootError = error;
    },
  };
}

export const initialFiles = {
  "package.json": "{}",
  "index.js": "console.log(1)",
  "src/app.js": "",
};

/** テスト用の実装で、initialFiles を持つ実行環境を起動する。 */
export async function bootFake() {
  const fake = createFakeBackend();
  const runtime = await bootWithBackend(fake.backend, { files: initialFiles });
  const created = fake.instances[0];
  if (!created) throw new Error("起動していない");
  return { fake, runtime, created };
}

export const treePaths = (runtime: NodeRuntime) =>
  runtime.files.tree.getSnapshot().map((entry) => entry.path);

export const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
