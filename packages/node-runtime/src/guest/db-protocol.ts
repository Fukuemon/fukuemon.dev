// DB のプロセスと node-runtime/ の直下が共有する、標準入出力で SQL を送る形式。ブラウザと実行環境の中の Node の両方で動くので、どちらの API も使わない

/** DB のプロセスが、応答の行の頭に付ける文字列 (apps/playground/DesignDoc.md の「記録を読む形」)。 */
export const SQL_PREFIX = "@@fd:sql ";

/** pglite-socket が待ち受ける Unix ドメインソケット。訪問者のプロセスには、PGHOST でディレクトリを渡す (ADR-0053)。 */
export const DB_SOCKET_PATH = "/tmp/.s.PGSQL.5432";

/** DB のプロセスのスクリプトの、実行環境のディレクトリの中の名前。 */
export const DB_SERVER_FILE = "db-server.mjs";

export type SqlRequest = { id: string; sql: string };

/** 標準入力の 1 行を、リクエストにする。形に合わない行は undefined を返す。 */
export function parseSqlRequest(line: string): SqlRequest | undefined {
  try {
    const value = JSON.parse(line) as unknown;
    if (typeof value !== "object" || value === null) return undefined;
    const { id, sql } = value as Record<string, unknown>;
    return typeof id === "string" && typeof sql === "string" ? { id, sql } : undefined;
  } catch {
    return undefined;
  }
}
