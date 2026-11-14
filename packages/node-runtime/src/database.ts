import type { DatabaseStatus, SqlDatabase, SqlResponse } from "@fukuemon/sql-runtime";

import type { BackendInstance, BackendProcess } from "./backend";
import { DB_SERVER_FILE, SQL_PREFIX } from "./guest/db-protocol";
import { createPrefixedLineReader } from "./record-lines";
import { createStore } from "./store";

const INITIAL_SQL_FAILED = "初期データの SQL が失敗しました: ";

const INVALID_REPLY: SqlResponse = {
  error: { message: "DB のプロセスの応答を読めませんでした" },
  ms: 0,
};

type Reply = { id: string; response: SqlResponse };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isCount = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

function isSqlResult(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const { fields, rows, affectedRows, totalRows, truncated } = value;
  return (
    Array.isArray(fields) &&
    fields.every((field) => typeof field === "string") &&
    Array.isArray(rows) &&
    rows.every(Array.isArray) &&
    isCount(affectedRows) &&
    isCount(totalRows) &&
    typeof truncated === "boolean"
  );
}

function isSqlError(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const { message, code, position } = value;
  return (
    typeof message === "string" &&
    (code === undefined || typeof code === "string") &&
    (position === undefined || typeof position === "number")
  );
}

/** 画面が描ける SqlResponse の形か。実行環境の中は訪問者が触れるので、DB のプロセスの応答も信頼しない。 */
function isSqlResponse(value: unknown): value is SqlResponse {
  if (!isRecord(value) || typeof value.ms !== "number") return false;
  if ("error" in value) return isSqlError(value.error);
  return Array.isArray(value.results) && value.results.every(isSqlResult);
}

/**
 * DB のプロセスの応答の行の中身を読む。id の無い行は undefined を返す。
 * id があり、応答が SqlResponse の形に合わない行は、待っている画面を止めないよう、error を持つ値にする。
 */
function parseReply(text: string): { ready: true } | Reply | undefined {
  try {
    const message = JSON.parse(text) as unknown;
    if (!isRecord(message)) return undefined;
    if (message.ready === true) return { ready: true };
    const { id, response } = message;
    if (typeof id !== "string") return undefined;
    return { id, response: isSqlResponse(response) ? response : INVALID_REPLY };
  } catch {
    return undefined;
  }
}

/** 1 行の JSON にする。JSON.stringify は U+2028 と U+2029 をそのまま残し、readline はそれを行の区切りとして読むので、エスケープする。 */
const toLine = (value: unknown) =>
  JSON.stringify(value).replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");

/**
 * DB のプロセスの標準入出力で、SqlDatabase を実装する。リクエストを 1 行の JSON で書き、同じ id の応答の行で結果を返す。
 * 頭の無い行（DB のプロセスのログと、入力のエコー）は捨てる。
 * プロセスが終了したら、status を stopped にし、待っているリクエストと、その後の run に error を持つ値を返す。
 */
export function createStdioDatabase(process: BackendProcess): {
  database: SqlDatabase;
  /** DB のプロセスが、ソケットで待ち受けて、リクエストを受けられるようになったときに解決する。その前に終了したときは失敗する。 */
  ready: Promise<void>;
  dispose: () => void;
} {
  const status = createStore<DatabaseStatus>({ kind: "ready" });
  const pending = new Map<string, (response: SqlResponse) => void>();
  let sequence = 0;
  let markReady: () => void = () => undefined;
  let failReady: (cause: Error) => void = () => undefined;
  const ready = new Promise<void>((resolve, reject) => {
    markReady = resolve;
    failReady = reject;
  });
  // 待つ前にプロセスが終了しても、未処理の失敗にしない。待つ側には、失敗が届く
  ready.catch(() => undefined);

  const stoppedResponse = (reason: string): SqlResponse => ({ error: { message: reason }, ms: 0 });

  const stopOutput = process.output.subscribe(
    createPrefixedLineReader(SQL_PREFIX, (line) => {
      const reply = parseReply(line);
      if (!reply) return;
      if ("ready" in reply) {
        markReady();
        return;
      }
      pending.get(reply.id)?.(reply.response);
      pending.delete(reply.id);
    }),
  );

  void process.exit.then(
    (code) => stop(`DB のプロセスが終了しました（終了コード ${code}）`),
    () => stop("DB のプロセスが終了しました"),
  );

  function stop(reason: string) {
    if (status.getSnapshot().kind === "stopped") return;
    status.set({ kind: "stopped", reason });
    failReady(new Error(reason));
    for (const resolve of pending.values()) resolve(stoppedResponse(reason));
    pending.clear();
  }

  return {
    database: {
      status,
      run: (sql) => {
        const current = status.getSnapshot();
        if (current.kind === "stopped") return Promise.resolve(stoppedResponse(current.reason));
        sequence += 1;
        const id = String(sequence);
        return new Promise<SqlResponse>((resolve) => {
          pending.set(id, resolve);
          process.write(`${toLine({ id, sql })}\n`);
        });
      },
    },
    ready,
    /** 出力の購読を外し、待っているリクエストとその後の run に error を返す。 */
    dispose: () => {
      stopOutput();
      stop("実行環境を止めました");
    },
  };
}

/** spawn が 0 でない終了コードで終わったときに投げる。 */
async function runToEnd(process: BackendProcess, what: string) {
  const code = await process.exit;
  if (code !== 0) throw new Error(`${what}が失敗した: ${code}`);
}

/**
 * DB のプロセスの依存を入れ、DB のプロセスを起動し、初期データの SQL を実行する。
 * どの段階が失敗しても、投げる。初期データの SQL の失敗は、メッセージを INITIAL_SQL_FAILED で始める。
 */
export async function startDatabase(
  instance: BackendInstance,
  initialSql: string | undefined,
): Promise<ReturnType<typeof createStdioDatabase>> {
  const directory = instance.guestDirectory;
  const options = { internal: true };
  await runToEnd(
    await instance.spawn(
      "npm",
      ["install", "--prefix", directory, "--no-audit", "--no-fund"],
      options,
    ),
    "DB の依存の npm install ",
  );
  const db = createStdioDatabase(
    await instance.spawn("node", [`${directory}/${DB_SERVER_FILE}`], options),
  );
  try {
    await db.ready;
    if (initialSql !== undefined && initialSql.trim() !== "") {
      const response = await db.database.run(initialSql);
      if ("error" in response) throw new Error(INITIAL_SQL_FAILED + response.error.message);
    }
    return db;
  } catch (cause) {
    db.dispose();
    throw cause;
  }
}
