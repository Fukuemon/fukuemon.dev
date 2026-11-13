import type { DatabaseStatus, SqlResponse, Store } from "@fukuemon/sql-runtime";
import {
  type LoadPhase,
  type WorkerSqlDatabase,
  createBrowserDatabase,
} from "@fukuemon/sql-runtime/worker";

import type { ProjectLoad } from "../project/project";

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
};

type SqlProject = Extract<ProjectLoad<"sql">, { kind: "opened" }>["project"];

export function createSqlSession(
  project: SqlProject,
  createDatabase: (initialSql?: string) => WorkerSqlDatabase = createBrowserDatabase,
): SqlSession {
  const database = createDatabase(project.initialSql);
  const query = createStore(project.files[project.open] ?? "");
  const running = createStore(false);
  return {
    status: database.status,
    phase: database.phase,
    fileName: project.open,
    query,
    running,
    setQuery: query.set,
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
  };
}

export type SqlSessionLoad =
  | { kind: "opened"; session: SqlSession }
  | { kind: "failed"; embedId: string };

/**
 * ページの URL のクエリから、プロジェクトを読んで SqlSession を返す。埋め込みの ID ごとに 1 つの SqlSession を作る。
 * React の use に渡すので、同じ埋め込みの ID には、同じ Promise を返す。
 */
export function createSessionOpener(
  loadProject: (search: string) => Promise<ProjectLoad<"sql">>,
  create: (project: SqlProject) => SqlSession = (project) => createSqlSession(project),
) {
  // loader は埋め込みの ID ごとに同じ Promise を返すので、その Promise をキーにする
  const opened = new WeakMap<Promise<ProjectLoad<"sql">>, Promise<SqlSessionLoad>>();
  return (search: string): Promise<SqlSessionLoad> => {
    const load = loadProject(search);
    const cached = opened.get(load);
    if (cached) return cached;
    const session = load.then(
      (result): SqlSessionLoad =>
        result.kind === "failed" ? result : { kind: "opened", session: create(result.project) },
    );
    opened.set(load, session);
    return session;
  };
}
