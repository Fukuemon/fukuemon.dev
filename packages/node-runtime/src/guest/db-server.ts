// 実行環境が起動する DB のプロセス。PGlite を Unix ドメインソケットで待ち受け、標準入力の 1 行の JSON の SQL を実行し、結果を標準出力の 1 行で返す。
// ビルドで 1 つのファイルに束ね、実行環境の中の Node で動かす。PGlite と pglite-socket は束ねず、実行環境の中で npm install する (apps/playground/DesignDoc.md の SQL)
import { createInterface } from "node:readline";

import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { runSql, toJsonResponse, toSqlError } from "@fukuemon/sql-runtime";

import { DB_SOCKET_PATH, SQL_PREFIX, parseSqlRequest } from "./db-protocol";

// 同時に接続できる数。pglite-socket のデフォルトの 1 では、2 つ目の接続が切られる (ADR-0053)。
// pg の Pool は 1 つで 10 本まで開くので、2 つのプロセスの Pool が上限まで開いても切られない数にする
const MAX_CONNECTIONS = 20;

const send = (message: unknown) =>
  process.stdout.write(`${SQL_PREFIX}${JSON.stringify(message)}\n`);

const db = await PGlite.create();
await new PGLiteSocketServer({
  db,
  path: DB_SOCKET_PATH,
  maxConnections: MAX_CONNECTIONS,
}).start();

// 前のリクエストの ROLLBACK が終わる前に、次のリクエストを実行しない
let queue = Promise.resolve();
createInterface({ input: process.stdin }).on("line", (line) => {
  const request = parseSqlRequest(line);
  if (!request) return;
  queue = queue.then(async () => {
    // 1 件の応答を作れなくても、後のリクエストを止めない
    try {
      send({ id: request.id, response: toJsonResponse(await runSql(db, request.sql)) });
    } catch (error) {
      send({ id: request.id, response: { error: toSqlError(error), ms: 0 } });
    }
  });
});

send({ ready: true });
