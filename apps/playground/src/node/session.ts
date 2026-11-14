import {
  BootError,
  type BootFailureReason,
  type BootOptions,
  type FileContents,
  type NodeRuntime,
  type ProcessHandle,
  type ReadAllOptions,
  type Store,
  bootNodeRuntime,
} from "@fukuemon/node-runtime";

import { type ProjectLoad, isEmbedId, isSafeFilePath } from "../project/project";
import {
  type Workspace,
  type WorkspaceLoad,
  createSaver,
  createWorkspace,
} from "../workspace/workspace";
import { shellName } from "./messages";

export type NodeProject = Extract<ProjectLoad<"node">, { kind: "opened" }>["project"];

/** 起動した実行環境か、起動できなかった理由。 */
export type RuntimeResult =
  | { kind: "running"; runtime: NodeRuntime }
  | { kind: "unavailable"; reason: BootFailureReason };

/** IndexedDB に保存する 1 件。作業ディレクトリのファイルの一式を、丸ごと置き換える。 */
export type NodeRecord = { files: Record<string, string>; version: string; savedAt: number };

/** 保存しないファイルの規則。起動し直すときの files.readAll にも同じ値を渡す (apps/playground/DesignDoc.md)。 */
export const SAVE_RULES: ReadAllOptions = { exclude: ["node_modules"], maxBytes: 1_048_576 };

/** 変更の通知を受けてから、作業ディレクトリを読むまでの時間（ms）。待つ間に来た通知は、1 回の保存にまとめる。 */
export const SAVE_DELAY_MS = 500;

/** 起動し直すときに、作業ディレクトリを読み終えるのを待つ上限（ms）。 */
export const RESTART_READ_TIMEOUT_MS = 5_000;

/** 実行のボタンで、前の起動のコマンドの終了を待つ上限（ms）。ポートが空くのを待つためである。 */
export const STOP_TIMEOUT_MS = 2_000;

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
      if (Object.is(next, value)) return;
      value = next;
      for (const listener of listeners) listener();
    },
  };
}

const isExcluded = (path: string) =>
  path.split("/").some((segment) => SAVE_RULES.exclude.includes(segment));

/**
 * IndexedDB から読んだ値が、保存のレコードの形か。形でない値は、保存したファイルが無いときと同じに扱う。
 * パスは、プロジェクトの JSON と同じ規則で確かめる。WebContainers の mount に、作業ディレクトリの外を指すパスを渡さないためである。
 */
export function isNodeRecord(value: unknown): value is NodeRecord {
  if (typeof value !== "object" || value === null) return false;
  const { files, version } = value as Partial<Record<keyof NodeRecord, unknown>>;
  return (
    typeof version === "string" &&
    typeof files === "object" &&
    files !== null &&
    Object.entries(files).every(
      ([path, contents]) => isSafeFilePath(path) && typeof contents === "string",
    )
  );
}

/** files.readAll の結果のうち、保存するファイルのパスと中身。テキストとして読めないものと、規則に合わないパスは除く。 */
export function savedFiles(entries: readonly FileContents[]): Record<string, string> {
  const files: Record<string, string> = {};
  for (const { path, text } of entries) {
    if (text !== null && isSafeFilePath(path)) files[path] = text;
  }
  return files;
}

const sameFiles = (a: Record<string, string>, b: Record<string, string> | undefined) =>
  b !== undefined &&
  Object.keys(a).length === Object.keys(b).length &&
  Object.entries(a).every(([path, text]) => Object.hasOwn(b, path) && b[path] === text);

const withTimeout = <T>(promise: Promise<T>, ms: number) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${ms} ms で終わらない`)), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });

/** Node の実行環境のページの、React の外の状態と操作。起動の Promise、保存、実行のボタン、起動し直す操作、初期の状態に戻す操作を持つ。 */
export type NodeSession = {
  project: NodeProject;
  /** 実行環境の起動の Promise。起動し直すと、新しい Promise に替わる。 */
  runtime: Store<Promise<RuntimeResult>>;
  /** IndexedDB を読めず、ファイルを保存できないときは false である。 */
  canSave: boolean;
  /** 最後の保存が失敗したときは true である。 */
  saveFailed: Store<boolean>;
  /** IndexedDB に保存したファイルがあるか。 */
  hasSaved: Store<boolean>;
  /** 保存したファイルの初期ファイルのバージョンが、プロジェクトのものと違うか。 */
  versionChanged: Store<boolean>;
  /** 起動し直すか、初期の状態に戻している間は true である。 */
  busy: Store<boolean>;
  /** npm install の後に、起動のコマンドを実行する。前に実行した起動のコマンドが動いていれば、止めてから実行する。 */
  run: () => Promise<void>;
  /** 作業ディレクトリのファイルを読んでから、実行環境を起動し直す。起動のコマンドは実行しない。 */
  restart: () => Promise<void>;
  /** 保存したファイルを消し、初期ファイルで起動し直す。初めて開いたときと同じく、起動のコマンドも実行する。消せないときは失敗し、起動し直さない。 */
  reset: () => Promise<void>;
};

export type NodeSessionOptions = {
  project: NodeProject;
  saved: WorkspaceLoad<NodeRecord>;
  storage: Workspace<NodeRecord>;
  boot?: (options: BootOptions) => Promise<NodeRuntime>;
  now?: () => number;
};

/** 起動した 1 つの実行環境と、その上で起動したもの。 */
type Instance = {
  runtime?: NodeRuntime;
  /** npm install の終了コード。npm install を起動できなかったときは undefined である。 */
  install?: Promise<number | undefined>;
  commands: ProcessHandle[];
  stopSaving: () => void;
};

export function createNodeSession({
  project,
  saved,
  storage,
  boot = bootNodeRuntime,
  now = Date.now,
}: NodeSessionOptions): NodeSession {
  const record = saved.kind === "saved" && isNodeRecord(saved.record) ? saved.record : undefined;
  const canSave = saved.kind !== "unavailable";
  const saver = createSaver(storage);
  const hasSaved = createStore(record !== undefined);
  const versionChanged = createStore(record !== undefined && record.version !== project.version);
  const busy = createStore(false);
  // 保存してあったバージョンを引き継ぐ。初期ファイルのバージョンと違ったことを、保存しても消さない
  let version = record?.version ?? project.version;
  let bootFiles: Readonly<Record<string, string>> = record?.files ?? project.files;
  let lastRead: Record<string, string> | undefined;
  let lastSaved = record?.files;
  // 訪問者が操作する前の変更は保存しない。自動の npm install が書く package-lock.json だけで、保存したファイルがある扱いにしないためである
  let touched = record !== undefined;
  const touch = () => {
    touched = true;
  };

  const persist = (files: Record<string, string>) => {
    lastRead = files;
    if (sameFiles(files, lastSaved)) return;
    lastSaved = files;
    saver.save({ files, version, savedAt: now() });
    if (canSave) hasSaved.set(true);
  };

  const watchForSave = (runtime: NodeRuntime) => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = async () => {
      const entries = await runtime.files.readAll(SAVE_RULES).catch((error: unknown) => {
        console.error("保存のために作業ディレクトリを読めない", error);
        return undefined;
      });
      if (entries && !stopped) persist(savedFiles(entries));
    };
    const unsubscribe = runtime.files.changes.subscribe((paths) => {
      if (!touched || paths.every(isExcluded)) return;
      clearTimeout(timer);
      timer = setTimeout(() => void save(), SAVE_DELAY_MS);
    });
    return () => {
      stopped = true;
      clearTimeout(timer);
      unsubscribe();
    };
  };

  // 画面に渡す実行環境。訪問者の操作を通る関数を包み、操作の後の変更から保存する
  const touchHandles = new WeakMap<ProcessHandle, ProcessHandle>();
  const touching = (handle: ProcessHandle) => {
    const wrapped = touchHandles.get(handle) ?? {
      ...handle,
      write: (data: string) => {
        touch();
        handle.write(data);
      },
    };
    touchHandles.set(handle, wrapped);
    return wrapped;
  };
  const afterTouch =
    <A extends unknown[], R>(operation: (...args: A) => R) =>
    (...args: A) => {
      touch();
      return operation(...args);
    };
  const forVisitor = (runtime: NodeRuntime): NodeRuntime => ({
    ...runtime,
    files: {
      ...runtime.files,
      write: afterTouch(runtime.files.write),
      createDirectory: afterTouch(runtime.files.createDirectory),
      rename: afterTouch(runtime.files.rename),
      remove: afterTouch(runtime.files.remove),
    },
    processes: {
      ...runtime.processes,
      get: (id) => {
        const handle = runtime.processes.get(id);
        return handle && touching(handle);
      },
      start: async (...args) => touching(await runtime.processes.start(...args)),
      startShell: async (...args) => touching(await runtime.processes.startShell(...args)),
    },
  });

  const startCommands = async (instance: Instance, runtime: NodeRuntime) => {
    for (const { command, args, name } of project.start) {
      instance.commands.push(await runtime.processes.start(command, args, { name }));
    }
  };

  /** シェル、npm install の順に起動する。autoStart のときは、npm install が 0 で終わった後に、起動のコマンドを実行する。 */
  const startup = async (instance: Instance, runtime: NodeRuntime, autoStart: boolean) => {
    await runtime.processes.startShell({ name: shellName([]) });
    const install = runtime.processes.start("npm", ["install"], { name: "npm install" });
    instance.install = install.then(
      (handle) => handle.exit,
      () => undefined,
    );
    if ((await (await install).exit) !== 0 || !autoStart) return;
    await startCommands(instance, runtime);
  };

  let current: Instance = { commands: [], stopSaving: () => undefined };

  const launch = (files: Readonly<Record<string, string>>, autoStart: boolean) => {
    const instance: Instance = { commands: [], stopSaving: () => undefined };
    current = instance;
    return (async (): Promise<RuntimeResult> => {
      try {
        const runtime = await boot({ files });
        instance.runtime = runtime;
        instance.stopSaving = watchForSave(runtime);
        void startup(instance, runtime, autoStart).catch((error: unknown) => {
          console.error("プロセスを起動できない", error);
        });
        return { kind: "running", runtime: forVisitor(runtime) };
      } catch (error) {
        console.error("実行環境を起動できない", error);
        return {
          kind: "unavailable",
          reason: error instanceof BootError ? error.reason : "failed",
        };
      }
    })();
  };

  // 保存したファイルがあるとき（再訪）は、起動のコマンドを、訪問者が実行のボタンを押してから実行する (ADR-0051)
  const runtimeStore = createStore(launch(bootFiles, record === undefined));

  /** 今の実行環境を破棄し、files が返すファイルで起動し直す。起動し直している間は busy にする。 */
  const relaunch = async (
    files: (old: Instance) => Promise<Readonly<Record<string, string>>>,
    autoStart: boolean,
    before: () => Promise<void> = async () => undefined,
  ) => {
    if (busy.getSnapshot()) return;
    busy.set(true);
    try {
      // 起動の途中で破棄すると、後から起動した実行環境が残るので、起動を待ってから破棄する
      await runtimeStore.getSnapshot();
      const old = current;
      old.stopSaving();
      try {
        await before();
      } catch (error) {
        if (old.runtime) old.stopSaving = watchForSave(old.runtime);
        throw error;
      }
      bootFiles = await files(old);
      await old.runtime?.dispose().catch((error: unknown) => {
        console.error("実行環境を破棄できない", error);
      });
      const next = launch(bootFiles, autoStart);
      runtimeStore.set(next);
      await next;
    } finally {
      busy.set(false);
    }
  };

  const readWorkdir = async (old: Instance) => {
    if (!old.runtime) return bootFiles;
    try {
      return savedFiles(
        await withTimeout(old.runtime.files.readAll(SAVE_RULES), RESTART_READ_TIMEOUT_MS),
      );
    } catch (error) {
      console.error("起動し直す前に作業ディレクトリを読めない", error);
      return lastRead ?? bootFiles;
    }
  };

  const initialFiles = async () => {
    touched = false;
    version = project.version;
    lastRead = undefined;
    lastSaved = undefined;
    hasSaved.set(false);
    versionChanged.set(false);
    return project.files;
  };

  return {
    project,
    runtime: runtimeStore,
    canSave,
    saveFailed: saver.failed,
    hasSaved,
    versionChanged,
    busy,
    run: async () => {
      const instance = current;
      const runtime = instance.runtime;
      if (!runtime || busy.getSnapshot()) return;
      touch();
      await instance.install;
      const previous = instance.commands.splice(0);
      for (const handle of previous) handle.kill();
      await withTimeout(Promise.all(previous.map((handle) => handle.exit)), STOP_TIMEOUT_MS).catch(
        () => undefined,
      );
      if (current === instance) await startCommands(instance, runtime);
    },
    restart: () => relaunch(readWorkdir, false),
    reset: () => relaunch(initialFiles, true, saver.clear),
  };
}

export type NodeSessionLoad =
  | { kind: "opened"; session: NodeSession }
  | { kind: "failed"; embedId: string };

/**
 * ページの URL のクエリから、プロジェクトと保存したファイルを並べて読み、NodeSession を返す。埋め込みの ID ごとに 1 つの NodeSession を作る。
 * React の use に渡すので、同じ埋め込みの ID には、同じ Promise を返す。
 */
export function createNodeSessionOpener(
  loadProject: (search: string) => Promise<ProjectLoad<"node">>,
  openWorkspace: (embedId: string | undefined) => Workspace<NodeRecord> = (embedId) =>
    createWorkspace("node", embedId),
  create: (options: NodeSessionOptions) => NodeSession = createNodeSession,
) {
  const opened = new WeakMap<Promise<ProjectLoad<"node">>, Promise<NodeSessionLoad>>();
  return (search: string): Promise<NodeSessionLoad> => {
    const load = loadProject(search);
    const existing = opened.get(load);
    if (existing) return existing;
    const embedId = new URLSearchParams(search).get("project") ?? undefined;
    // 形に合わない埋め込みの ID では、プロジェクトを開けないので、IndexedDB も読まない
    const workspace =
      embedId === undefined || isEmbedId(embedId) ? openWorkspace(embedId) : undefined;
    const saved = workspace?.load();
    const session = load.then(async (result): Promise<NodeSessionLoad> => {
      if (result.kind === "failed") return result;
      const storage = workspace ?? openWorkspace(result.embedId);
      return {
        kind: "opened",
        session: create({
          project: result.project,
          saved: await (saved ?? storage.load()),
          storage,
        }),
      };
    });
    opened.set(load, session);
    return session;
  };
}
