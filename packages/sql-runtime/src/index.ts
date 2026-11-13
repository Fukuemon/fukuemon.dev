import type { PGliteInterface } from "@electric-sql/pglite";

/** 値が変わったことを知らせ、今の値を返す。画面は useSyncExternalStore で読む。getSnapshot は、値が変わるまで同じ参照を返す。 */
export type Store<T> = {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => T;
};

export type DatabaseStatus = { kind: "ready" } | { kind: "stopped"; reason: string };

export type SqlError = { message: string; code?: string; position?: number };

export type SqlResult = {
  fields: readonly string[];
  rows: readonly (readonly unknown[])[];
  affectedRows: number;
  totalRows: number;
  truncated: boolean;
};

export type SqlResponse =
  | { results: readonly SqlResult[]; ms: number }
  | { error: SqlError; ms: number };

/** SQL を受け取って実行する DB。run は、SQL の失敗でも DB が止まっているときでも失敗せず、error を持つ値を返す。 */
export type SqlDatabase = {
  status: Store<DatabaseStatus>;
  run: (sql: string) => Promise<SqlResponse>;
};

export const MAX_ROWS = 100_000;

/**
 * PGlite で SQL を実行し、文ごとの結果を返す。
 * 複数の文は 1 回の simple query で送るので、Postgres が 1 つの暗黙のトランザクションとして扱い、1 つが失敗すると全部を取り消す。
 * 1 つの結果が MAX_ROWS 行を超えるときは、先頭の MAX_ROWS 行だけを返す。
 * 失敗したときは ROLLBACK を流す。SQL の中の BEGIN で始めたトランザクションが失敗したまま残ると、次の SQL が全て失敗するためである。
 */
export async function runSql(
  pg: Pick<PGliteInterface, "exec">,
  sql: string,
  now: () => number = () => performance.now(),
): Promise<SqlResponse> {
  const started = now();
  try {
    const results = await pg.exec(sql, { rowMode: "array" });
    return {
      results: results.map((result) => {
        const rows = result.rows as unknown as unknown[][];
        return {
          fields: result.fields.map((field) => field.name),
          rows: rows.length > MAX_ROWS ? rows.slice(0, MAX_ROWS) : rows,
          affectedRows: result.rowCount ?? 0,
          totalRows: rows.length,
          truncated: rows.length > MAX_ROWS,
        };
      }),
      ms: now() - started,
    };
  } catch (error) {
    const response = { error: toSqlError(error), ms: now() - started };
    // トランザクションの外では、ROLLBACK は警告だけを出して何もしない
    await pg.exec("rollback").catch(() => undefined);
    return response;
  }
}

/** 最後の文のほかの結果から、行を除く。画面は最後の文の結果だけを出すので、Web Worker から送る量を減らす。 */
export function keepLastRows(response: SqlResponse): SqlResponse {
  if ("error" in response) return response;
  const last = response.results.length - 1;
  return {
    ...response,
    results: response.results.map((result, index) =>
      index === last ? result : { ...result, rows: [] },
    ),
  };
}

export function toSqlError(error: unknown): SqlError {
  if (!(error instanceof Error)) return { message: String(error) };
  const { code, position } = error as Error & { code?: unknown; position?: unknown };
  const at = typeof position === "string" ? Number.parseInt(position, 10) : Number.NaN;
  return {
    message: error.message,
    ...(typeof code === "string" && { code }),
    ...(Number.isFinite(at) && { position: at }),
  };
}
