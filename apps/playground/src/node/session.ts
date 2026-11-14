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
  isExcludedPath,
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
const SAVE_RULES: ReadAllOptions = { exclude: ["node_modules"], maxBytes: 1_048_576 };

/** 変更の通知を受けてから、作業ディレクトリを読むまでの時間（ms）。待つ間に来た通知は、1 回の保存にまとめる。 */
export const SAVE_DELAY_MS = 500;

/** 変更の通知が続くときに、最初の通知から保存までを待つ上限（ms）。 */
export const SAVE_MAX_DELAY_MS = 2_000;

/** 保存のためと起動し直すときに、作業ディレクトリを読み終えるのを待つ上限（ms）。 */
export const READ_TIMEOUT_MS = 5_000;

/** 実行のボタンで、前の起動のコマンドの終了を待つ上限（ms）。ポートが空くのを待つためである。 */
const STOP_TIMEOUT_MS = 2_000;

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

const isExcluded = (path: string) => isExcludedPath(path, SAVE_RULES.exclude);

/**
 * IndexedDB から読んだ値が、保存のレコードの形か。形でない値は、保存したファイルが無いときと同じに扱う。
 * パスは、プロジェクトの JSON と同じ規則で確かめる。WebContainers の mount に、作業ディレクトリの外を指すパスを渡さないためである。
 */
function isNodeRecord(value: unknown): value is NodeRecord {
  if (typeof value !== "object" || value === null) return false;
  const { files, version } = value as Partial<Record<keyof NodeRecord, unknown>>;
  return (
    typeof version === "string" &&
    typeof files === "object" &&
    files !== null &&
    Object.entries(files).every(
      ([path, contents]) => isSafeFilePath(path) && typeof contents === "string",
    ) &&
    !hasFileAsDirectory(Object.keys(files))
  );
}

/** あるファイルのパスが、別のファイルのパスの途中のディレクトリになっているか（`a` と `a/b`）。そのファイルの一式は、作業ディレクトリに書けない。 */
function hasFileAsDirectory(paths: readonly string[]): boolean {
  const files = new Set(paths);
  return paths.some((path) => {
    const parts = path.split("/");
    return parts.slice(1).some((_, i) => files.has(parts.slice(0, i + 1).join("/")));
  });
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
  /** 起動のコマンドを起動できなかったときは true である。次に実行を始めたときと、起動し直したときに false に戻る。自動の実行と、実行のボタンの両方で立つ。 */
  commandFailed: Store<boolean>;
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
  /** シェルと npm install を起動し、npm install が終わると、その終了コードで解決する。起動できなかったときは undefined である。 */
  install: Promise<number | undefined>;
  commands: ProcessHandle[];
  /** 起動のコマンドの実行の列。自動の実行と、実行のボタンを、1 つずつ順に進める。 */
  commandQueue: Promise<void>;
  /** 訪問者が、この実行環境を操作したか。操作する前の変更は保存しない。 */
  touched: boolean;
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
  const hasSaved = createStore(record !== undefined);
  const versionChanged = createStore(record !== undefined && record.version !== project.version);
  const busy = createStore(false);
  const commandFailed = createStore(false);
  // 保存してあったバージョンを引き継ぐ。初期ファイルのバージョンと違ったことを、保存しても消さない
  let version = record?.version ?? project.version;
  let bootFiles: Readonly<Record<string, string>> = record?.files ?? project.files;
  let lastRead: Record<string, string> | undefined;
  let lastSaved = record?.files;
  // 保存が通ったときだけ、保存したファイルがある扱いにする。失敗したときは、次の変更で同じ中身も書き直す
  const saver = createSaver<NodeRecord>({
    ...storage,
    save: (next) =>
      storage.save(next).then(
        () => hasSaved.set(canSave),
        (error: unknown) => {
          lastSaved = undefined;
          throw error;
        },
      ),
  });

  const persist = (files: Record<string, string>) => {
    lastRead = files;
    if (sameFiles(files, lastSaved)) return;
    lastSaved = files;
    saver.save({ files, version, savedAt: now() });
  };

  const readForSave = async (runtime: NodeRuntime) => {
    // 読み込みが終わらないと、次の保存が始まらないので、上限で諦める
    const entries = await withTimeout(runtime.files.readAll(SAVE_RULES), READ_TIMEOUT_MS).catch(
      (error: unknown) => {
        console.error("保存のために作業ディレクトリを読めない", error);
        return undefined;
      },
    );
    return entries && savedFiles(entries);
  };

  const watchForSave = (instance: Instance, runtime: NodeRuntime) => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let firstChange: number | undefined;
    let reading = false;
    let again = false;
    // 読み込みは 1 本ずつにする。古い読み込みが後に終わって、古い中身で保存し直さないためである
    const save = async () => {
      timer = undefined;
      firstChange = undefined;
      if (reading) {
        again = true;
        return;
      }
      reading = true;
      do {
        again = false;
        const files = await readForSave(runtime);
        if (files && !stopped) persist(files);
      } while (again && !stopped);
      reading = false;
    };
    const unsubscribe = runtime.files.changes.subscribe((paths) => {
      if (!instance.touched || paths.every(isExcluded)) return;
      // 書き込みが続いても、最初の通知から SAVE_MAX_DELAY_MS のうちに保存する
      const at = Date.now();
      firstChange ??= at;
      clearTimeout(timer);
      const wait = Math.min(SAVE_DELAY_MS, firstChange + SAVE_MAX_DELAY_MS - at);
      timer = setTimeout(() => void save(), Math.max(0, wait));
    });
    return () => {
      stopped = true;
      clearTimeout(timer);
      unsubscribe();
    };
  };

  // 画面に渡す実行環境。訪問者の操作を通る関数を包み、操作の後の変更から保存する。印は、包んだ実行環境の instance にだけ付ける
  const forVisitor = (instance: Instance, runtime: NodeRuntime): NodeRuntime => {
    const touch = () => {
      instance.touched = true;
    };
    const handles = new WeakMap<ProcessHandle, ProcessHandle>();
    const touching = (handle: ProcessHandle) => {
      const wrapped = handles.get(handle) ?? {
        ...handle,
        write: (data: string) => {
          touch();
          handle.write(data);
        },
      };
      handles.set(handle, wrapped);
      return wrapped;
    };
    const afterTouch =
      <A extends unknown[], R>(operation: (...args: A) => R) =>
      (...args: A) => {
        touch();
        return operation(...args);
      };
    return {
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
    };
  };

  /** 前に起動した起動のコマンドを止め、ポートが空くのを待ってから、起動のコマンドを起動する。 */
  const startCommands = async (instance: Instance, runtime: NodeRuntime) => {
    const previous = instance.commands.splice(0);
    for (const handle of previous) handle.kill();
    await withTimeout(Promise.all(previous.map((handle) => handle.exit)), STOP_TIMEOUT_MS).catch(
      () => undefined,
    );
    if (current !== instance) return;
    for (const { command, args, name } of project.start) {
      instance.commands.push(await runtime.processes.start(command, args, { name }));
    }
  };

  /** 起動のコマンドの実行を列に足す。前の実行の失敗は、次の実行を止めない。 */
  const queueCommands = (instance: Instance, runtime: NodeRuntime) => {
    const run = instance.commandQueue.then(() => {
      commandFailed.set(false);
      return startCommands(instance, runtime);
    });
    instance.commandQueue = run.catch((error: unknown) => {
      console.error("起動のコマンドを実行できない", error);
      if (current === instance) commandFailed.set(true);
    });
    return run;
  };

  /** シェル、npm install の順に起動する。 */
  const startup = async (runtime: NodeRuntime) => {
    await runtime.processes.startShell({ name: shellName([]) });
    const install = await runtime.processes.start("npm", ["install"], { name: "npm install" });
    return install.exit;
  };

  let current: Instance;

  const launch = (
    files: Readonly<Record<string, string>>,
    { autoStart, touched }: { autoStart: boolean; touched: boolean },
  ) => {
    let installed: (code: number | undefined) => void = () => undefined;
    const instance: Instance = {
      install: new Promise((resolve) => (installed = resolve)),
      commands: [],
      commandQueue: Promise.resolve(),
      touched,
      stopSaving: () => undefined,
    };
    current = instance;
    return (async (): Promise<RuntimeResult> => {
      try {
        const runtime = await boot({ files });
        instance.runtime = runtime;
        instance.stopSaving = watchForSave(instance, runtime);
        void startup(runtime)
          .then(async (code) => {
            installed(code);
            if (code === 0 && autoStart) await queueCommands(instance, runtime);
          })
          .catch((error: unknown) => {
            installed(undefined);
            console.error("プロセスを起動できない", error);
          });
        return { kind: "running", runtime: forVisitor(instance, runtime) };
      } catch (error) {
        installed(undefined);
        console.error("実行環境を起動できない", error);
        return {
          kind: "unavailable",
          reason: error instanceof BootError ? error.reason : "failed",
        };
      }
    })();
  };

  // 保存したファイルがあるとき（再訪）は、起動のコマンドを、訪問者が実行のボタンを押してから実行する (ADR-0051)
  const runtimeStore = createStore(
    launch(bootFiles, { autoStart: record === undefined, touched: record !== undefined }),
  );

  /** 今の実行環境を破棄し、prepare が返すファイルで起動し直す。起動し直している間は busy にする。 */
  const relaunch = async (
    prepare: (
      old: Instance,
    ) => Promise<{ files: Readonly<Record<string, string>>; touched: boolean }>,
    autoStart: boolean,
    before: (old: Instance) => Promise<void> = async () => undefined,
  ) => {
    if (busy.getSnapshot()) return;
    busy.set(true);
    try {
      // 起動の途中で破棄すると、後から起動した実行環境が残るので、起動を待ってから破棄する
      await runtimeStore.getSnapshot();
      const old = current;
      old.stopSaving();
      await before(old);
      commandFailed.set(false);
      const { files, touched } = await prepare(old);
      bootFiles = files;
      await old.runtime?.dispose().catch((error: unknown) => {
        console.error("実行環境を破棄できない", error);
      });
      const next = launch(bootFiles, { autoStart, touched });
      runtimeStore.set(next);
      await next;
    } finally {
      busy.set(false);
    }
  };

  // 起動し直す直前の変更も残すため、読んだファイルを保存してから起動し直す
  const readWorkdir = async (old: Instance) => {
    if (!old.runtime) return { files: bootFiles, touched: old.touched };
    try {
      const files = savedFiles(
        await withTimeout(old.runtime.files.readAll(SAVE_RULES), READ_TIMEOUT_MS),
      );
      if (old.touched) persist(files);
      return { files, touched: old.touched };
    } catch (error) {
      console.error("起動し直す前に作業ディレクトリを読めない", error);
      return { files: lastRead ?? bootFiles, touched: old.touched };
    }
  };

  const clearSaved = async (old: Instance) => {
    try {
      await saver.clear();
    } catch (error) {
      // 消せなかったときは、前の実行環境で保存を続ける。待っていた保存は捨てたので、今の中身を書き直す
      lastSaved = undefined;
      if (old.runtime) {
        old.stopSaving = watchForSave(old, old.runtime);
        // 読み込みを待たずに失敗を返す。待つと、読み込みが終わるまで busy が戻らない
        if (old.touched) void readForSave(old.runtime).then((files) => files && persist(files));
      }
      throw error;
    }
  };

  const toInitialState = async () => {
    version = project.version;
    lastRead = undefined;
    lastSaved = undefined;
    hasSaved.set(false);
    versionChanged.set(false);
    return { files: project.files, touched: false };
  };

  return {
    project,
    runtime: runtimeStore,
    canSave,
    saveFailed: saver.failed,
    hasSaved,
    versionChanged,
    busy,
    commandFailed,
    run: async () => {
      // 起動の途中に押したときは、起動を待ってから実行する
      await runtimeStore.getSnapshot();
      const instance = current;
      const runtime = instance.runtime;
      if (!runtime || busy.getSnapshot()) return;
      instance.touched = true;
      await instance.install;
      await queueCommands(instance, runtime);
    },
    restart: () => relaunch(readWorkdir, false),
    reset: () => relaunch(toInitialState, true, clearSaved),
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
  // 形に合わない埋め込みの ID では、プロジェクトを開けないので、IndexedDB も読まない
  const readSaved = (search: string) => {
    const embedId = new URLSearchParams(search).get("project") ?? undefined;
    if (embedId !== undefined && !isEmbedId(embedId)) return undefined;
    const storage = openWorkspace(embedId);
    return { storage, saved: storage.load() };
  };
  const open = async (
    load: Promise<ProjectLoad<"node">>,
    early: ReturnType<typeof readSaved>,
  ): Promise<NodeSessionLoad> => {
    const result = await load;
    // 形に合わない埋め込みの ID では、project/ もプロジェクトを開けずに failed を返す
    if (result.kind === "failed" || !early)
      return { kind: "failed", embedId: result.embedId ?? "" };
    return {
      kind: "opened",
      session: create({
        project: result.project,
        saved: await early.saved,
        storage: early.storage,
      }),
    };
  };
  return (search: string): Promise<NodeSessionLoad> => {
    const load = loadProject(search);
    const session = opened.get(load) ?? open(load, readSaved(search));
    opened.set(load, session);
    return session;
  };
}
