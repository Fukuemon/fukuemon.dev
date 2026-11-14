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
};

/** IndexedDB に保存する 1 件。入力欄の SQL を、変えるたびに丸ごと置き換える。 */
export type SqlRecord = { sql: string; version: string; savedAt: number };

/** IndexedDB から読んだ値が、保存のレコードの形か。形でない値は、保存した SQL が無いときと同じに扱う。 */
export function isSqlRecord(value: unknown): value is SqlRecord {
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
  const version = record?.version ?? project.version;
  const query = createStore(record?.sql ?? project.files[project.open] ?? "");
  const saver = createSaver(storage);
  const running = createStore(false);
  return {
    status: database.status,
    phase: database.phase,
    fileName: project.open,
    query,
    running,
    setQuery: (sql) => {
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
    canSave: saved.kind !== "unavailable",
    saveFailed: saver.failed,
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
