import {
  BootError,
  type BootFailureReason,
  type BootOptions,
  type NodeRuntime,
  type ProcessHandle,
  ReadLimitError,
  type Store,
  bootNodeRuntime,
} from "@fukuemon/node-runtime";

import { type ProjectLoad, isEmbedId } from "../project/project";
import { type Workspace, type WorkspaceLoad, createWorkspace } from "../workspace/workspace";
import { SQL_PANE_QUERY, shellName } from "./messages";
import { type NodeRecord, type SaveRead, createRecordSaver, readSavedRecord } from "./record-saver";
import { RESTART_READ, SAVE_READ, isExcludedFromSave, filesForRestart } from "./save-rules";
import { createStore } from "./store";

export type NodeProject = Extract<ProjectLoad<"node">, { kind: "opened" }>["project"];

/** 起動した実行環境か、起動できなかった理由。 */
export type RuntimeResult =
  | { kind: "running"; runtime: NodeRuntime }
  | { kind: "unavailable"; reason: BootFailureReason };

/** DB を使うプロジェクトのときだけ、DB のプロセスと初期データの SQL を渡す。 */
const bootOptions = (project: NodeProject, files: Readonly<Record<string, string>>): BootOptions =>
  project.database === true
    ? {
        files,
        database: true,
        ...(project.initialSql !== undefined && { initialSql: project.initialSql }),
      }
    : { files };

/** 変更の通知を受けてから、作業ディレクトリを読むまでの時間（ms）。待つ間に来た通知は、1 回の保存にまとめる。 */
export const SAVE_DELAY_MS = 500;

/** 変更の通知が続くときに、最初の通知から保存までを待つ上限（ms）。 */
export const SAVE_MAX_DELAY_MS = 2_000;

/** 保存のためと起動し直すときに、作業ディレクトリを読み終えるのを待つ上限（ms）。 */
export const READ_TIMEOUT_MS = 5_000;

/** 実行のボタンで、前の起動のコマンドの終了を待つ上限（ms）。ポートが空くのを待つためである。 */
const STOP_TIMEOUT_MS = 2_000;

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
  /** 保存が失敗したときは true である。訪問者の変更の保存が通るか、初期の状態に戻すと false に戻る。書き直しの失敗だけで立ったときは、書き直しが通っても false に戻る。 */
  saveFailed: Store<boolean>;
  /** 最後に読んだ作業ディレクトリが、保存の上限を超えたときは true である。上限を下回って読めたときと、初期の状態に戻したときに false に戻る。 */
  overLimit: Store<boolean>;
  /** 最後に起動し直したときに作業ディレクトリを読めず、前に読んだときのファイルで起動したときは true である。起動し直しを始めるときと、初期の状態に戻したときに false に戻る。 */
  restartReadFailed: Store<boolean>;
  /** IndexedDB に保存したファイルがあるか。 */
  hasSaved: Store<boolean>;
  /** 保存したファイルの初期ファイルのバージョンが、プロジェクトのものと違うか。 */
  versionChanged: Store<boolean>;
  /** 起動のコマンドを起動できなかったときは true である。次に実行を始めたときと、起動し直したときに false に戻る。自動の実行と、実行のボタンの両方で立つ。 */
  commandFailed: Store<boolean>;
  /** 起動し直すか、初期の状態に戻している間は true である。 */
  busy: Store<boolean>;
  /** SQL のペインの入力欄の SQL。起動し直すときは残し、初期の状態に戻すと最初の SQL に戻る。 */
  sqlQuery: Store<string>;
  /** SQL のペインの入力欄の SQL を替える。訪問者の操作とみなして保存を予約する。レコードに SQL を入れるのは、DB を使うプロジェクトだけである。 */
  setSqlQuery: (sql: string) => void;
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
  /** 記事の埋め込みの ID。デフォルトのプロジェクト（記事から開いていないページ）では無い。 */
  embedId?: string;
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
  /** 変更の通知を受けたときと同じく、待ってから作業ディレクトリを読んで保存する。 */
  requestSave: () => void;
};

export function createNodeSession({
  project,
  saved,
  storage,
  embedId,
  boot = bootNodeRuntime,
  now = Date.now,
}: NodeSessionOptions): NodeSession {
  const { record, needsRewrite } = readSavedRecord(saved);
  const canSave = saved.kind !== "unavailable";
  // 記事から開いていないページ（デフォルトのプロジェクト）では、記事の初期ファイルが変わったとは出さない
  const versionChanged = createStore(
    record !== undefined && embedId !== undefined && record.version !== project.version,
  );
  const busy = createStore(false);
  const commandFailed = createStore(false);
  const restartReadFailed = createStore(false);
  const sqlQuery = createStore(record?.sql ?? SQL_PANE_QUERY);
  let bootFiles: Readonly<Record<string, string>> = record?.files ?? project.files;
  let lastRead: Record<string, string> | undefined;
  const recordSaver = createRecordSaver({
    storage,
    record,
    needsRewrite,
    canSave,
    projectVersion: project.version,
    now,
    ...(project.database === true && { sql: sqlQuery.getSnapshot }),
  });
  const { persist, rewriteIfUnsaved } = recordSaver;

  /** 保存のために作業ディレクトリを読む。読めなかったときは undefined を返す。 */
  const readForSave = async (runtime: NodeRuntime): Promise<SaveRead | undefined> => {
    try {
      // 読み込みが終わらないと、次の保存が始まらないので、上限で諦める
      const entries = await withTimeout(runtime.files.readAll(SAVE_READ), READ_TIMEOUT_MS);
      return { kind: "read", entries };
    } catch (error) {
      if (error instanceof ReadLimitError) return { kind: "over-limit" };
      console.error("保存のために作業ディレクトリを読めない", error);
      return undefined;
    }
  };

  /**
   * 変更の通知を受けて作業ディレクトリを読み、保存する。返す関数で止める。saveNow のときは、通知を待たずに 1 回読む。
   * 止めた後（起動し直す途中）に終わった読み込みは捨てる。起動し直す前に読んだファイルや、戻した初期の状態を、古い中身で書き換えないためである。
   */
  const watchForSave = (
    instance: Instance,
    runtime: NodeRuntime,
    { saveNow = false }: { saveNow?: boolean } = {},
  ) => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let firstChange: number | undefined;
    let reading = false;
    let again = false;
    // 結果を使う読み込みは 1 本ずつにする。古い読み込みが後に終わって、古い中身で保存し直さないためである。上限で諦めた読み込みは止まらずに動くが、結果は捨てる
    const save = async () => {
      timer = undefined;
      firstChange = undefined;
      if (reading) {
        again = true;
        return;
      }
      reading = true;
      try {
        do {
          again = false;
          const read = await readForSave(runtime);
          if (read && !stopped) {
            // 起動し直すときに読めなかったら、この結果で起動する。保存しないディレクトリは読んでいないので、入らない
            if (read.kind === "read") lastRead = filesForRestart(read.entries);
            persist(read);
          } else if (!stopped) {
            rewriteIfUnsaved();
          }
        } while (again && !stopped);
      } finally {
        reading = false;
      }
    };
    // 書き込みが続いても、最初の通知から SAVE_MAX_DELAY_MS のうちに保存する
    const schedule = () => {
      if (stopped || !instance.touched) return;
      const at = Date.now();
      firstChange ??= at;
      clearTimeout(timer);
      const wait = Math.min(SAVE_DELAY_MS, firstChange + SAVE_MAX_DELAY_MS - at);
      timer = setTimeout(() => void save(), Math.max(0, wait));
    };
    const unsubscribe = runtime.files.changes.subscribe((paths) => {
      if (!instance.touched) return;
      if (paths.every(isExcludedFromSave)) {
        rewriteIfUnsaved();
        return;
      }
      schedule();
    });
    if (saveNow) void save();
    return {
      stop: () => {
        stopped = true;
        clearTimeout(timer);
        unsubscribe();
      },
      request: schedule,
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
  let sqlChangedWhileRelaunching = false;

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
      requestSave: () => undefined,
    };
    current = instance;
    return (async (): Promise<RuntimeResult> => {
      try {
        const runtime = await boot(bootOptions(project, files));
        instance.runtime = runtime;
        const watcher = watchForSave(instance, runtime);
        instance.stopSaving = watcher.stop;
        instance.requestSave = watcher.request;
        // 起動し直す間に替えた SQL は、前の実行環境の保存が止まっていて保存できていないので、起動した後に保存する
        if (sqlChangedWhileRelaunching) {
          sqlChangedWhileRelaunching = false;
          instance.touched = true;
          watcher.request();
        }
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
    if (!old.runtime) {
      rewriteIfUnsaved();
      return { files: bootFiles, touched: old.touched };
    }
    // 続けて読めなかったときも、案内を出し直す
    restartReadFailed.set(false);
    try {
      const entries = await withTimeout(old.runtime.files.readAll(RESTART_READ), READ_TIMEOUT_MS);
      const files = filesForRestart(entries);
      lastRead = files;
      if (old.touched) persist({ kind: "read", entries });
      return { files, touched: old.touched };
    } catch (error) {
      console.error("起動し直す前に作業ディレクトリを読めない", error);
      restartReadFailed.set(true);
      rewriteIfUnsaved();
      return { files: lastRead ?? bootFiles, touched: old.touched };
    }
  };

  const clearSaved = async (old: Instance) => {
    try {
      await recordSaver.clear();
    } catch (error) {
      // 消せなかったときは、前の実行環境で保存を続ける。待っていた保存は捨てたので、今の中身を書き直す
      // 読み込みを待たずに失敗を返す。待つと、読み込みが終わるまで busy が戻らない
      if (old.runtime) {
        const watcher = watchForSave(old, old.runtime, { saveNow: old.touched });
        old.stopSaving = watcher.stop;
        old.requestSave = watcher.request;
      }
      throw error;
    }
  };

  const toInitialState = async () => {
    lastRead = undefined;
    versionChanged.set(false);
    restartReadFailed.set(false);
    sqlQuery.set(SQL_PANE_QUERY);
    // 戻す前に替えた SQL は、最初の SQL で上書きしたので保存しない
    sqlChangedWhileRelaunching = false;
    return { files: project.files, touched: false };
  };

  return {
    project,
    runtime: runtimeStore,
    canSave,
    saveFailed: recordSaver.saveFailed,
    overLimit: recordSaver.overLimit,
    restartReadFailed,
    hasSaved: recordSaver.hasSaved,
    versionChanged,
    busy,
    commandFailed,
    sqlQuery,
    setSqlQuery: (sql) => {
      if (sql === sqlQuery.getSnapshot()) return;
      sqlQuery.set(sql);
      current.touched = true;
      if (busy.getSnapshot()) sqlChangedWhileRelaunching = true;
      current.requestSave();
    },
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
        embedId: result.embedId,
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
