import type { GoExecution, GoExit, GoRunner, LoadPhase, Store } from "@fukuemon/go-runtime";
import { createBrowserGoRunner } from "@fukuemon/go-runtime/worker";

import type { ProjectLoad } from "../project/project";
import { type Workspace, type WorkspaceLoad, createWorkspace } from "../workspace/workspace";
import {
  type Change,
  type FileEntry,
  type GoWorkspace,
  createDirectory,
  listEntries,
  normalizePath,
  remove,
  rename,
  writeFile,
} from "./files";

type GoProject = Extract<ProjectLoad<"go">, { kind: "opened" }>["project"];

/** IndexedDB に保存する 1 件。ファイルとディレクトリの一式を、丸ごと置き換える。 */
export type GoRecord = GoWorkspace & { version: string; savedAt: number };

/** 出力の欄の中身。実行するたびに空にしてから書く。 */
export type GoOutput = {
  kind: "run" | "test" | undefined;
  text: string;
  /** 上限を超えて、出力の後ろを捨てたか。 */
  truncated: boolean;
  /** 実行中は undefined である。 */
  exit: GoExit | { kind: "timeout" } | undefined;
};

/** 実行の結果。busy は、ほかの実行が終わっていないことを表す。 */
type GoResult =
  | { kind: "busy" }
  | {
      kind: "done";
      exit: NonNullable<GoOutput["exit"]>;
      output: string;
      truncated: boolean;
    };

type RunOptions = { timeoutMs?: number };

/**
 * Go を動かすツールの、React の外の状態と操作。ファイル、実行中かどうか、出力を持つ。
 * 実行する処理は run と test の 2 つにし、画面のボタンのほかの呼び出し元（AI からの操作）も、これを呼ぶ。
 */
export type GoSession = {
  embedId: string | undefined;
  /** 最初に開くファイル。 */
  open: string;
  workspace: Store<GoWorkspace>;
  /** Yaegi を読み込んでいる間も true である。 */
  running: Store<boolean>;
  phase: Store<LoadPhase>;
  output: Store<GoOutput>;
  /** IndexedDB を読めず、ファイルを保存できないときは false である。 */
  canSave: boolean;
  list: (path?: string) => FileEntry[];
  /** ファイルの中身。無いパスとディレクトリは undefined を返す。 */
  read: (path: string) => string | undefined;
  write: (path: string, contents: string) => Change;
  createDirectory: (path: string) => Change;
  rename: (from: string, to: string) => Change;
  remove: (path: string) => Change;
  load: () => Promise<void>;
  run: (options?: RunOptions) => Promise<GoResult>;
  test: (options?: RunOptions) => Promise<GoResult>;
  /** 実行中の run か test を止める。 */
  stop: () => void;
};

/** 出力の欄に持つ文字数の上限。超えた分は捨てる。 */
export const OUTPUT_LIMIT = 1_000_000;

type WritableStore<T> = Store<T> & { set: (value: T) => void };

function createStore<T>(initial: T): WritableStore<T> {
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

export type GoSessionOptions = {
  project: GoProject;
  embedId: string | undefined;
  saved: WorkspaceLoad<GoRecord>;
  workspace: Workspace<GoRecord>;
  runner: GoRunner;
  now?: () => number;
};

export function createGoSession({
  project,
  embedId,
  saved,
  workspace: storage,
  runner,
  now = Date.now,
}: GoSessionOptions): GoSession {
  const initial: GoWorkspace =
    saved.kind === "saved"
      ? { files: saved.record.files, directories: saved.record.directories }
      : { files: project.files, directories: [] };
  const workspace = createStore(initial);
  const running = createStore(false);
  const output = createStore<GoOutput>({
    kind: undefined,
    text: "",
    truncated: false,
    exit: undefined,
  });
  let current: GoExecution | undefined;

  const apply = (change: Change): Change => {
    if (!change.ok) return change;
    workspace.set(change.workspace);
    void storage
      .save({ ...change.workspace, version: project.version, savedAt: now() })
      .catch(() => undefined);
    return change;
  };

  const append = (chunk: string) => {
    const shown = output.getSnapshot();
    if (shown.truncated) return;
    const text = shown.text + chunk;
    const truncated = text.length > OUTPUT_LIMIT;
    output.set({ ...shown, text: truncated ? text.slice(0, OUTPUT_LIMIT) : text, truncated });
  };

  const execute = async (
    kind: "run" | "test",
    { timeoutMs }: RunOptions = {},
  ): Promise<GoResult> => {
    if (running.getSnapshot()) return { kind: "busy" };
    running.set(true);
    output.set({ kind, text: "", truncated: false, exit: undefined });
    // 実行を始めたときのファイルの写しを渡す。実行中に書き換えても、実行しているコードは変わらない
    const files = workspace.getSnapshot().files;
    const execution = kind === "run" ? runner.run(files, append) : runner.test(files, append);
    current = execution;
    let timedOut = false;
    const timer =
      timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            timedOut = true;
            execution.stop();
          }, timeoutMs);
    const finished = await execution.done;
    clearTimeout(timer);
    current = undefined;
    const exit = timedOut ? ({ kind: "timeout" } as const) : finished;
    output.set({ ...output.getSnapshot(), exit });
    running.set(false);
    const { text, truncated } = output.getSnapshot();
    return { kind: "done", exit, output: text, truncated };
  };

  return {
    embedId,
    open: Object.hasOwn(initial.files, project.open)
      ? project.open
      : (Object.keys(initial.files).sort()[0] ?? project.open),
    workspace,
    running,
    phase: runner.phase,
    output,
    canSave: saved.kind !== "unavailable",
    list: (path) =>
      listEntries(workspace.getSnapshot(), path === undefined ? undefined : normalizePath(path)),
    read: (path) => {
      const normalized = normalizePath(path);
      const files = workspace.getSnapshot().files;
      return normalized && Object.hasOwn(files, normalized) ? files[normalized] : undefined;
    },
    write: (path, contents) => apply(writeFile(workspace.getSnapshot(), path, contents)),
    createDirectory: (path) => apply(createDirectory(workspace.getSnapshot(), path)),
    rename: (from, to) => apply(rename(workspace.getSnapshot(), from, to)),
    remove: (path) => apply(remove(workspace.getSnapshot(), path)),
    load: runner.load,
    run: (options) => execute("run", options),
    test: (options) => execute("test", options),
    stop: () => current?.stop(),
  };
}

export type GoSessionLoad =
  | { kind: "opened"; session: GoSession }
  | { kind: "failed"; embedId: string };

/**
 * ページの URL のクエリから、プロジェクトと保存したファイルを読んで GoSession を返す。埋め込みの ID ごとに 1 つの GoSession を作る。
 * React の use に渡すので、同じ埋め込みの ID には、同じ Promise を返す。
 */
export function createGoSessionOpener(
  loadProject: (search: string) => Promise<ProjectLoad<"go">>,
  openWorkspace: (embedId: string | undefined) => Workspace<GoRecord> = (embedId) =>
    createWorkspace("go", embedId),
  createRunner: () => GoRunner = createBrowserGoRunner,
) {
  const opened = new WeakMap<Promise<ProjectLoad<"go">>, Promise<GoSessionLoad>>();
  return (search: string): Promise<GoSessionLoad> => {
    const load = loadProject(search);
    const session =
      opened.get(load) ??
      load.then(async (result): Promise<GoSessionLoad> => {
        if (result.kind === "failed") return result;
        const workspace = openWorkspace(result.embedId);
        const saved = await workspace.load();
        return {
          kind: "opened",
          session: createGoSession({
            project: result.project,
            embedId: result.embedId,
            saved,
            workspace,
            runner: createRunner(),
          }),
        };
      });
    opened.set(load, session);
    return session;
  };
}
