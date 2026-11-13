import type { SqlResponse, Store } from "@fukuemon/sql-runtime";
import { type WorkerSqlDatabase, createBrowserDatabase } from "@fukuemon/sql-runtime/worker";

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
 * 画面の実行のボタンと、AI からの操作（#123）は、どちらも execute を呼ぶ。
 */
export type SqlSession = {
  database: WorkerSqlDatabase;
  query: Store<string>;
  running: Store<boolean>;
  setQuery: (sql: string) => void;
  /** PGlite の読み込みを始める。 */
  load: () => Promise<void>;
  /** SQL を実行し、結果を返す。実行中に呼んだときは、実行せずに error を返す。 */
  execute: (sql: string) => Promise<SqlResponse>;
};

export function createSqlSession(
  initialQuery: string,
  initialSql: string | undefined,
  createDatabase: (initialSql?: string) => WorkerSqlDatabase = createBrowserDatabase,
): SqlSession {
  const database = createDatabase(initialSql);
  const query = createStore(initialQuery);
  const running = createStore(false);
  return {
    database,
    query,
    running,
    setQuery: query.set,
    load: database.load,
    execute: async (sql) => {
      if (running.getSnapshot()) return { error: { message: "前の SQL を実行している" }, ms: 0 };
      running.set(true);
      try {
        return await database.run(sql);
      } finally {
        running.set(false);
      }
    },
  };
}

/** 埋め込みの ID ごとに 1 つの SqlSession を持つ。デフォルトのプロジェクトは、空の文字列をキーにする。 */
export function createSessionRegistry() {
  const sessions = new Map<string, SqlSession>();
  return (key: string, create: () => SqlSession): SqlSession => {
    const existing = sessions.get(key);
    if (existing) return existing;
    const session = create();
    sessions.set(key, session);
    return session;
  };
}
