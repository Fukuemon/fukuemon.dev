import type { PGliteInterface } from "@electric-sql/pglite";

import { type SqlError, type SqlResponse, keepLastRows, runSql, toSqlError } from "../index";

export type ToWorker =
  | { type: "init"; initialSql?: string }
  | { type: "run"; id: number; sql: string };

export type FromWorker =
  | { type: "seeding" }
  | { type: "ready" }
  | { type: "init-failed"; error: SqlError }
  | { type: "response"; id: number; response: SqlResponse };

type Database = Pick<PGliteInterface, "exec">;

/**
 * Web Worker の中で、メインスレッドからのメッセージを受けて PGlite を動かす。
 * init で PGlite を作り、初期データの SQL を実行してから ready を返す。run は init の後に実行する。
 */
export function createHandler(
  create: () => Promise<Database>,
  post: (message: FromWorker) => void,
) {
  let database: Promise<Database | undefined> | undefined;
  return async (message: ToWorker): Promise<void> => {
    if (message.type === "init") {
      database = boot(create, message.initialSql, post);
      return;
    }
    const pg = await database;
    const response: SqlResponse = pg
      ? keepLastRows(await runSql(pg, message.sql))
      : { error: { message: "DB を起動していません" }, ms: 0 };
    try {
      post({ type: "response", id: message.id, response });
    } catch (error) {
      // 結果に複製できない値があると、postMessage が投げる。投げたままだと、メインスレッドの run が解決しない
      post({
        type: "response",
        id: message.id,
        response: { error: toSqlError(error), ms: response.ms },
      });
    }
  };
}

async function boot(
  create: () => Promise<Database>,
  initialSql: string | undefined,
  post: (message: FromWorker) => void,
): Promise<Database | undefined> {
  let pg: Database;
  try {
    pg = await create();
  } catch (error) {
    post({ type: "init-failed", error: toSqlError(error) });
    return undefined;
  }
  if (initialSql !== undefined) {
    post({ type: "seeding" });
    const response = await runSql(pg, initialSql);
    if ("error" in response) {
      const message = `初期データの SQL が失敗しました: ${response.error.message}`;
      post({ type: "init-failed", error: { ...response.error, message } });
      return undefined;
    }
  }
  post({ type: "ready" });
  return pg;
}
