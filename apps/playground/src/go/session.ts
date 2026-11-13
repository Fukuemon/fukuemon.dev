import type { GoExecution, GoExit, GoRunner, LoadPhase, Store } from "@fukuemon/go-runtime";
import { createBrowserGoRunner } from "@fukuemon/go-runtime/worker";

import type { ProjectLoad } from "../project/project";
import { type Workspace, type WorkspaceLoad, createWorkspace } from "../workspace/workspace";
import {
  type Change,
  type FileEntry,
  type GoFileSet,
  createDirectory,
  createFile,
  listEntries,
  normalizePath,
  remove,
  rename,
  writeFile,
} from "./files";

type GoProject = Extract<ProjectLoad<"go">, { kind: "opened" }>["project"];

/** IndexedDB に保存する 1 件。ファイルとディレクトリの一式を、丸ごと置き換える。 */
export type GoRecord = GoFileSet & { version: string; savedAt: number };

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
  openPath: string;
  fileSet: Store<GoFileSet>;
  /** Yaegi を読み込んでいる間も true である。 */
  running: Store<boolean>;
  phase: Store<LoadPhase>;
  output: Store<GoOutput>;
  /** IndexedDB を読めず、ファイルを保存できないときは false である。 */
  canSave: boolean;
  /** 最後の保存が失敗したときは true である。次の保存が通ると false に戻る。 */
  saveFailed: Store<boolean>;
  list: (path?: string) => FileEntry[];
  /** ファイルの中身。無いパスとディレクトリは undefined を返す。 */
  read: (path: string) => string | undefined;
  /** ファイルを書く。無ければ作り、あれば上書きする。 */
  write: (path: string, contents: string) => Change;
  /** 空のファイルを作る。既にあるパスには作らない。 */
  createFile: (path: string) => Change;
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

/** 出力を溜めてから、出力の store に写すまでの間隔（ms）。出力のたびに全文を描き直さないためである。 */
const OUTPUT_FLUSH_MS = 50;

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

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isNormalPath = (path: string) => normalizePath(path) === path;

/**
 * IndexedDB から読んだ値が、保存のレコードの形か。形でない値は、保存したファイルが無いときと同じに扱う。
 * パスは、ファイルの操作が書くのと同じ、正規化した形だけを受ける。
 */
function isGoRecord(value: unknown): value is GoRecord {
  if (typeof value !== "object" || value === null) return false;
  const { files, directories, version } = value as Partial<Record<keyof GoRecord, unknown>>;
  return (
    typeof version === "string" &&
    typeof files === "object" &&
    files !== null &&
    Object.entries(files).every(
      ([path, contents]) => isNormalPath(path) && typeof contents === "string",
    ) &&
    isStringArray(directories) &&
    directories.every(isNormalPath)
  );
}

export type GoSessionOptions = {
  project: GoProject;
  embedId: string | undefined;
  saved: WorkspaceLoad<GoRecord>;
  storage: Workspace<GoRecord>;
  runner: GoRunner;
  now?: () => number;
};

export function createGoSession({
  project,
  embedId,
  saved,
  storage,
  runner,
  now = Date.now,
}: GoSessionOptions): GoSession {
  const initial: GoFileSet =
    saved.kind === "saved" && isGoRecord(saved.record)
      ? { files: saved.record.files, directories: saved.record.directories }
      : { files: project.files, directories: [] };
  const fileSet = createStore(initial);
  const saveFailed = createStore(false);
  // 保存してあったバージョンを引き継ぐ。初期ファイルのバージョンと違ったことを、保存しても消さない
  const version =
    saved.kind === "saved" && isGoRecord(saved.record) ? saved.record.version : project.version;
  const running = createStore(false);
  const output = createStore<GoOutput>({
    kind: undefined,
    text: "",
    truncated: false,
    exit: undefined,
  });
  let current: GoExecution | undefined;

  // 保存の途中に来た変更は、最新の 1 件だけを持ち、保存が終わってから書く。1 文字の入力ごとに書き込みを重ねないためである
  let saving = false;
  let queued: GoRecord | undefined;
  const persist = (record: GoRecord) => {
    if (saving) {
      queued = record;
      return;
    }
    saving = true;
    void storage
      .save(record)
      .then(
        () => saveFailed.set(false),
        () => saveFailed.set(true),
      )
      .finally(() => {
        saving = false;
        const next = queued;
        queued = undefined;
        if (next) persist(next);
      });
  };

  const apply = (change: Change): Change => {
    if (!change.ok) return change;
    fileSet.set(change.fileSet);
    persist({ ...change.fileSet, version, savedAt: now() });
    return change;
  };

  let pending = "";
  let flushTimer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    clearTimeout(flushTimer);
    flushTimer = undefined;
    const shown = output.getSnapshot();
    if (pending === "" || shown.truncated) {
      pending = "";
      return;
    }
    const text = shown.text + pending;
    pending = "";
    const truncated = text.length > OUTPUT_LIMIT;
    output.set({ ...shown, text: truncated ? text.slice(0, OUTPUT_LIMIT) : text, truncated });
  };

  const append = (chunk: string) => {
    if (output.getSnapshot().truncated) return;
    pending += chunk;
    if (output.getSnapshot().text.length + pending.length > OUTPUT_LIMIT) flush();
    else flushTimer ??= setTimeout(flush, OUTPUT_FLUSH_MS);
  };

  const execute = async (
    kind: "run" | "test",
    { timeoutMs }: RunOptions = {},
  ): Promise<GoResult> => {
    if (running.getSnapshot()) return { kind: "busy" };
    running.set(true);
    try {
      return await executeOnce(kind, timeoutMs);
    } finally {
      current = undefined;
      running.set(false);
    }
  };

  const executeOnce = async (
    kind: "run" | "test",
    timeoutMs: number | undefined,
  ): Promise<GoResult> => {
    output.set({ kind, text: "", truncated: false, exit: undefined });
    // 実行を始めたときのファイルの写しを渡す。実行中に書き換えても、実行しているコードは変わらない
    const files = fileSet.getSnapshot().files;
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
    let finished: GoExit;
    try {
      finished = await execution.done;
    } catch (error) {
      finished = {
        kind: "failed",
        message: error instanceof Error ? error.message : String(error),
      };
    } finally {
      clearTimeout(timer);
      flush();
    }
    const exit = timedOut ? ({ kind: "timeout" } as const) : finished;
    output.set({ ...output.getSnapshot(), exit });
    const { text, truncated } = output.getSnapshot();
    return { kind: "done", exit, output: text, truncated };
  };

  return {
    embedId,
    openPath: Object.hasOwn(initial.files, project.open)
      ? project.open
      : (Object.keys(initial.files).sort()[0] ?? project.open),
    fileSet,
    running,
    phase: runner.phase,
    output,
    canSave: saved.kind !== "unavailable",
    saveFailed,
    list: (path) =>
      listEntries(fileSet.getSnapshot(), path === undefined ? undefined : normalizePath(path)),
    read: (path) => {
      const normalized = normalizePath(path);
      const files = fileSet.getSnapshot().files;
      return normalized && Object.hasOwn(files, normalized) ? files[normalized] : undefined;
    },
    write: (path, contents) => apply(writeFile(fileSet.getSnapshot(), path, contents)),
    createFile: (path) => apply(createFile(fileSet.getSnapshot(), path)),
    createDirectory: (path) => apply(createDirectory(fileSet.getSnapshot(), path)),
    rename: (from, to) => apply(rename(fileSet.getSnapshot(), from, to)),
    remove: (path) => apply(remove(fileSet.getSnapshot(), path)),
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
            storage: workspace,
            runner: createRunner(),
          }),
        };
      });
    opened.set(load, session);
    return session;
  };
}
