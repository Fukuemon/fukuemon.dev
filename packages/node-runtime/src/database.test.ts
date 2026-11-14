import { describe, expect, it } from "vitest";

import { createStdioDatabase } from "./database";
import { DB_SERVER_FILE, SQL_PREFIX } from "./guest/db-protocol";
import { bootWithBackend } from "./runtime";
import {
  type FakeProcess,
  GUEST_DIRECTORY,
  createFakeBackend,
  flush,
  initialFiles,
} from "./test/fake-backend";
import { BootError } from "./types";

const reply = (message: unknown) => `${SQL_PREFIX}${JSON.stringify(message)}\n`;
const ok = { results: [], ms: 1 };

/** 書かれたリクエストを読む。 */
const requests = (process: FakeProcess) =>
  process.written.map((line) => JSON.parse(line) as { id: string; sql: string });

const createProcess = () => {
  const fake = createFakeBackend();
  return fake.backend
    .boot({ files: {}, database: true })
    .then((instance) => instance.spawn("node", ["db"], { internal: true }) as Promise<FakeProcess>);
};

describe("createStdioDatabase", () => {
  it("ready の行で ready を解決し、リクエストを 1 行の JSON で書き、同じ id の応答の行で結果を返す", async () => {
    const process = await createProcess();
    const db = createStdioDatabase(process);
    process.emit(reply({ ready: true }));
    await db.ready;
    const first = db.database.run("select 1");
    const second = db.database.run("select 2");
    expect(process.written.every((line) => line.endsWith("\n"))).toBe(true);
    expect(requests(process)).toStrictEqual([
      { id: "1", sql: "select 1" },
      { id: "2", sql: "select 2" },
    ]);
    process.emit(reply({ id: "2", response: { results: [], ms: 2 } }));
    process.emit(reply({ id: "1", response: ok }));
    expect(await first).toStrictEqual(ok);
    expect(await second).toStrictEqual({ results: [], ms: 2 });
  });

  it("途中で切れて届いた行と、CRLF の行を読み、頭の無い行と形に合わない行は捨てる", async () => {
    const process = await createProcess();
    const db = createStdioDatabase(process);
    const running = db.database.run("select 1");
    const line = reply({ id: "1", response: ok }).replace("\n", "\r\n");
    process.emit('{"id":"1","sql":"select 1"}\nlog line\n');
    process.emit(`${SQL_PREFIX}{\n${SQL_PREFIX}[]\n${SQL_PREFIX}{"id":"1"}\n`);
    process.emit(`${SQL_PREFIX}{"id":"1","response":{"x":1}}\n`);
    process.emit(line.slice(0, 10));
    process.emit(line.slice(10));
    expect(await running).toStrictEqual(ok);
  });

  it("プロセスが終了したら、待っているリクエストとその後の run に error を返し、status を stopped にする", async () => {
    const process = await createProcess();
    const db = createStdioDatabase(process);
    const running = db.database.run("select 1");
    process.finish(1);
    const stopped = { error: { message: "DB のプロセスが終了しました（終了コード 1）" }, ms: 0 };
    expect(await running).toStrictEqual(stopped);
    expect(await db.database.run("select 2")).toStrictEqual(stopped);
    expect(db.database.status.getSnapshot()).toStrictEqual({
      kind: "stopped",
      reason: "DB のプロセスが終了しました（終了コード 1）",
    });
    expect(process.written).toHaveLength(1);
  });

  it("ready の前にプロセスが終了したら、ready を失敗させる", async () => {
    const process = await createProcess();
    const db = createStdioDatabase(process);
    process.fail(new Error("crash"));
    await expect(db.ready).rejects.toThrow("DB のプロセスが終了しました");
  });

  it("dispose の後は、応答の行を読まず、待っているリクエストとその後の run に error を返す", async () => {
    const process = await createProcess();
    const db = createStdioDatabase(process);
    const running = db.database.run("select 1");
    db.dispose();
    process.emit(reply({ id: "1", response: ok }));
    process.finish(0);
    const stopped = { error: { message: "実行環境を止めました" }, ms: 0 };
    expect(await running).toStrictEqual(stopped);
    expect(await db.database.run("select 2")).toStrictEqual(stopped);
  });
});

/** DB のプロセスの依存の npm install を code で終わらせ、DB のプロセスは ready を出して、SQL に answer で答える。 */
function databaseBackend(
  options: { install?: number; answer?: (sql: string) => unknown; ready?: boolean } = {},
) {
  return createFakeBackend({
    onSpawn: (process) => {
      if (process.command === "npm") {
        queueMicrotask(() => process.finish(options.install ?? 0));
        return;
      }
      if (process.command !== "node") return;
      const write = process.write;
      process.write = (data) => {
        write(data);
        const { id, sql } = JSON.parse(data) as { id: string; sql: string };
        queueMicrotask(() => process.emit(reply({ id, response: options.answer?.(sql) ?? ok })));
      };
      // spawn を待った側が出力を購読してから出す
      if (options.ready ?? true) setTimeout(() => process.emit(reply({ ready: true })));
    },
  });
}

const failure = async (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    (error: unknown) => error,
  );

describe("bootWithBackend の DB", () => {
  it("DB を使うときは、依存を入れ、DB のプロセスを起動し、初期データの SQL を実行してから解決する", async () => {
    const fake = databaseBackend();
    const runtime = await bootWithBackend(fake.backend, {
      files: initialFiles,
      database: true,
      initialSql: "create table t (id int);",
    });
    const created = fake.instances[0];
    expect(created?.database).toBe(true);
    expect(created?.processes.map((p) => [p.command, p.args, p.options, p.terminal])).toStrictEqual(
      [
        [
          "npm",
          ["install", "--prefix", GUEST_DIRECTORY, "--no-audit", "--no-fund"],
          { internal: true },
          undefined,
        ],
        ["node", [`${GUEST_DIRECTORY}/${DB_SERVER_FILE}`], { internal: true }, undefined],
      ],
    );
    const db = created?.processes[1];
    expect(db && requests(db)).toStrictEqual([{ id: "1", sql: "create table t (id int);" }]);
    expect(runtime.database?.status.getSnapshot()).toStrictEqual({ kind: "ready" });
    expect(runtime.processes.list.getSnapshot()).toStrictEqual([]);
  });

  it("DB を使わないときは、DB のプロセスも依存の npm install も起動せず、database を持たない", async () => {
    const fake = databaseBackend();
    const runtime = await bootWithBackend(fake.backend, { files: initialFiles, initialSql: "x" });
    expect(fake.instances[0]?.database).toBe(false);
    expect(fake.instances[0]?.processes).toStrictEqual([]);
    expect(runtime.database).toBeUndefined();
  });

  it("初期データの SQL が空白だけのときは、送らない", async () => {
    const fake = databaseBackend();
    await bootWithBackend(fake.backend, { files: initialFiles, database: true, initialSql: " \n" });
    expect(fake.instances[0]?.processes[1]?.written).toStrictEqual([]);
  });

  it.each([
    ["依存の npm install が失敗した", { install: 1 }, "DB の依存の npm install が失敗した: 1"],
    [
      "初期データの SQL が失敗した",
      { answer: () => ({ error: { message: "syntax error" }, ms: 1 }) },
      "初期データの SQL が失敗しました: syntax error",
    ],
  ])(
    "%sときは、起動を failed の BootError で失敗させ、実行環境を破棄する",
    async (_, options, message) => {
      const fake = databaseBackend(options);
      const error = await failure(
        bootWithBackend(fake.backend, { files: initialFiles, database: true, initialSql: "x" }),
      );
      expect(error).toBeInstanceOf(BootError);
      expect((error as BootError).reason).toBe("failed");
      expect(((error as BootError).cause as Error).message).toBe(message);
      expect(fake.instances[0]?.state.tornDown).toBe(true);
    },
  );

  it("ready の前に DB のプロセスが終了したときは、起動を失敗させる", async () => {
    const fake = databaseBackend({ ready: false });
    const booting = failure(bootWithBackend(fake.backend, { files: initialFiles, database: true }));
    await flush();
    fake.instances[0]?.processes[1]?.finish(1);
    expect(await booting).toBeInstanceOf(BootError);
  });

  it("dispose の後の run は、error を返す", async () => {
    const fake = databaseBackend();
    const runtime = await bootWithBackend(fake.backend, { files: initialFiles, database: true });
    await runtime.dispose();
    expect(await runtime.database?.run("select 1")).toStrictEqual({
      error: { message: "実行環境を止めました" },
      ms: 0,
    });
  });
});
