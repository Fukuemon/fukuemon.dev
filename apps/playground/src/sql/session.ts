import type { DatabaseStatus, SqlResponse, Store } from "@fukuemon/sql-runtime";
import {
  type LoadPhase,
  type WorkerSqlDatabase,
  createBrowserDatabase,
} from "@fukuemon/sql-runtime/worker";

import type { ProjectLoad } from "../project/project";
import {
  type Workspace,
  type WorkspaceLoad,
  createSaver,
  createWorkspace,
} from "../workspace/workspace";

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

/**
 * SQL だけを動かすツールの、React の外の状態と操作。入力欄の SQL、実行中かどうか、DB を持つ。
 * 実行する処理は execute の 1 つにし、画面の実行のボタンのほかの呼び出し元も、これを呼ぶ。
 */
export type SqlSession = {
  status: Store<DatabaseStatus>;
  phase: Store<LoadPhase>;
  /** プロジェクトの、最初に開くファイルの名前。 */
  fileName: string;
  query: Store<string>;
  running: Store<boolean>;
  setQuery: (sql: string) => void;
  /** PGlite の読み込みを始める。 */
  load: () => Promise<void>;
  /** SQL を実行し、結果を返す。実行中に呼んだときは、実行せずに error を返す。 */
  execute: (sql: string) => Promise<SqlResponse>;
  /** IndexedDB を読めず、入力欄の SQL を保存できないときは false である。 */
  canSave: boolean;
  /** 最後の保存が失敗したときは true である。 */
  saveFailed: Store<boolean>;
  /** IndexedDB に保存した SQL があるか。保存が通ると true に、消すと false になる。 */
  hasSaved: Store<boolean>;
  /** 待っている保存を捨て、保存した SQL を消し、入力欄を初期の SQL に戻す。消せないときは失敗し、入力欄を変えない。消している間の setQuery は無視し、reset を重ねて呼んだときは、同じ Promise を返す。 */
  reset: () => Promise<void>;
};

/** IndexedDB に保存する 1 件。入力欄の SQL を、変えるたびに丸ごと置き換える。 */
export type SqlRecord = { sql: string; version: string; savedAt: number };

/** IndexedDB から読んだ値が、保存のレコードの形か。形でない値は、保存した SQL が無いときと同じに扱う。 */
function isSqlRecord(value: unknown): value is SqlRecord {
  if (typeof value !== "object" || value === null) return false;
  const { sql, version } = value as Partial<Record<keyof SqlRecord, unknown>>;
  return typeof sql === "string" && typeof version === "string";
}

export type SqlPersistence = {
  saved: WorkspaceLoad<SqlRecord>;
  storage: Workspace<SqlRecord>;
  now?: () => number;
};

const noStorage: Workspace<SqlRecord> = {
  load: async () => ({ kind: "empty" }),
  save: async () => undefined,
  clear: async () => undefined,
};

type SqlProject = Extract<ProjectLoad<"sql">, { kind: "opened" }>["project"];

export function createSqlSession(
  project: SqlProject,
  createDatabase: (initialSql?: string) => WorkerSqlDatabase = createBrowserDatabase,
  { saved, storage, now = Date.now }: SqlPersistence = {
    saved: { kind: "empty" },
    storage: noStorage,
  },
): SqlSession {
  const database = createDatabase(project.initialSql);
  const record = saved.kind === "saved" && isSqlRecord(saved.record) ? saved.record : undefined;
  // 保存してあったバージョンを引き継ぐ。初期ファイルのバージョンと違ったことを、保存しても消さない
  let version = record?.version ?? project.version;
  const initialQuery = project.files[project.open] ?? "";
  const query = createStore(record?.sql ?? initialQuery);
  const canSave = saved.kind !== "unavailable";
  const hasSaved = createStore(record !== undefined);
  // 保存が通ったときだけ、保存した SQL がある扱いにする
  const saver = createSaver({
    ...storage,
    save: (next) => storage.save(next).then(() => hasSaved.set(canSave)),
  });
  const running = createStore(false);
  // 消している間は、setQuery の保存を捨て、reset を重ねて呼んでも消す操作を 1 つにする
  let resetting: Promise<void> | undefined;
  return {
    status: database.status,
    phase: database.phase,
    fileName: project.open,
    query,
    running,
    setQuery: (sql) => {
      // エディタは、外から入力欄の値を置き換えたときも変更として通知する。同じ値を保存し直すと、戻した直後に保存が作り直される
      if (resetting || sql === query.getSnapshot()) return;
      query.set(sql);
      saver.save({ sql, version, savedAt: now() });
    },
    load: database.load,
    execute: async (sql) => {
      if (running.getSnapshot()) return { error: { message: "前の SQL を実行しています" }, ms: 0 };
      running.set(true);
      try {
        return await database.run(sql);
      } finally {
        running.set(false);
      }
    },
    canSave,
    saveFailed: saver.failed,
    hasSaved,
    reset: () => {
      resetting ??= saver
        .clear()
        .then(() => {
          version = project.version;
          hasSaved.set(false);
          query.set(initialQuery);
        })
        .finally(() => {
          resetting = undefined;
        });
      return resetting;
    },
  };
}

export type SqlSessionLoad =
  | { kind: "opened"; session: SqlSession }
  | { kind: "failed"; embedId: string };

/**
 * ページの URL のクエリから、プロジェクトと保存した SQL を読んで SqlSession を返す。埋め込みの ID ごとに 1 つの SqlSession を作る。
 * React の use に渡すので、同じ埋め込みの ID には、同じ Promise を返す。
 */
export function createSessionOpener(
  loadProject: (search: string) => Promise<ProjectLoad<"sql">>,
  create: (project: SqlProject, persistence: SqlPersistence) => SqlSession = (
    project,
    persistence,
  ) => createSqlSession(project, undefined, persistence),
  openWorkspace: (embedId: string | undefined) => Workspace<SqlRecord> = (embedId) =>
    createWorkspace("sql", embedId),
) {
  // loader は埋め込みの ID ごとに同じ Promise を返すので、その Promise をキーにする
  const opened = new WeakMap<Promise<ProjectLoad<"sql">>, Promise<SqlSessionLoad>>();
  return (search: string): Promise<SqlSessionLoad> => {
    const load = loadProject(search);
    const session =
      opened.get(load) ??
      load.then(async (result): Promise<SqlSessionLoad> => {
        if (result.kind === "failed") return result;
        const storage = openWorkspace(result.embedId);
        const saved = await storage.load();
        return { kind: "opened", session: create(result.project, { saved, storage }) };
      });
    opened.set(load, session);
    return session;
  };
}
