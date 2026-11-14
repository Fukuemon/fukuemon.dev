import { describe, expect, it, vi } from "vitest";

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
const stoppedWith = (message: string) => ({ error: { message }, ms: 0 });

const createProcess = async () => {
  const fake = createFakeBackend();
  const instance = await fake.backend.boot({ files: {}, database: true });
  return (await instance.spawn("node", ["db"], { internal: true })) as FakeProcess;
};

/** DB のプロセスと、そのプロセスで作った SqlDatabase。 */
const createDatabase = async () => {
  const process = await createProcess();
  return { process, db: createStdioDatabase(process) };
};

describe("createStdioDatabase", () => {
  it("ready の行で ready を解決する", async () => {
    const { process, db } = await createDatabase();
    process.emit(reply({ ready: true }));
    await expect(db.ready).resolves.toBeUndefined();
  });

  it("リクエストを、連番の id を付けた 1 行の JSON で書く", async () => {
    const { process, db } = await createDatabase();
    void db.database.run("select 1");
    void db.database.run("select 2");
    expect(process.written).toStrictEqual([
      '{"id":"1","sql":"select 1"}\n',
      '{"id":"2","sql":"select 2"}\n',
    ]);
  });

  it("届いた順に関わらず、同じ id の応答の行で結果を返す", async () => {
    const { process, db } = await createDatabase();
    const running = Promise.all([db.database.run("select 1"), db.database.run("select 2")]);
    process.emit(reply({ id: "2", response: { results: [], ms: 2 } }));
    process.emit(reply({ id: "1", response: ok }));
    expect(await running).toStrictEqual([ok, { results: [], ms: 2 }]);
  });

  it("途中で切れて届いた行と、CRLF の行を読み、頭の無い行、途中に頭がある行、形に合わない行は捨てる", async () => {
    const { process, db } = await createDatabase();
    const running = db.database.run("select 1");
    const line = reply({ id: "1", response: ok }).replace("\n", "\r\n");
    process.emit('{"id":"1","sql":"select 1"}\nlog line\n');
    process.emit(`log ${reply({ id: "1", response: { results: [], ms: 9 } })}`);
    process.emit(`${SQL_PREFIX}{\n${SQL_PREFIX}[]\n${SQL_PREFIX}{"id":1}\n`);
    process.emit(line.slice(0, 10));
    process.emit(line.slice(10));
    expect(await running).toStrictEqual(ok);
  });

  it("id があり、応答が SqlResponse の形に合わない行には、error を持つ値を返す", async () => {
    const { process, db } = await createDatabase();
    const running = Promise.all([1, 2, 3, 4].map((n) => db.database.run(`select ${n}`)));
    process.emit(reply({ id: "1", response: { results: "x", ms: 1 } }));
    process.emit(reply({ id: "2", response: { results: [{ fields: [1] }], ms: 1 } }));
    process.emit(reply({ id: "3", response: { error: { message: {} }, ms: 1 } }));
    process.emit(reply({ id: "4", response: { results: [] } }));
    const invalid = { error: { message: "DB のプロセスの応答を読めませんでした" }, ms: 0 };
    expect(await running).toStrictEqual([invalid, invalid, invalid, invalid]);
  });

  const result = { fields: ["a"], rows: [[1]], affectedRows: 1, totalRows: 1, truncated: false };

  it.each([
    ["応答がオブジェクトでない", "x"],
    ["ms が数でない", { results: [] }],
    ["結果がオブジェクトでない", { results: [1], ms: 1 }],
    ["列の名前が文字列でない", { results: [{ ...result, fields: [1] }], ms: 1 }],
    ["行が配列でない", { results: [{ ...result, rows: [1] }], ms: 1 }],
    ["件数が負の数", { results: [{ ...result, affectedRows: -1 }], ms: 1 }],
    ["全体の行の数が整数でない", { results: [{ ...result, totalRows: 1.5 }], ms: 1 }],
    ["切ったかどうかが真偽値でない", { results: [{ ...result, truncated: "no" }], ms: 1 }],
    ["エラーがオブジェクトでない", { error: "x", ms: 1 }],
    ["SQLSTATE が文字列でない", { error: { message: "x", code: 1 }, ms: 1 }],
    ["位置が数でない", { error: { message: "x", position: "1" }, ms: 1 }],
  ])("%s応答には、error を持つ値を返す", async (_, response) => {
    const { process, db } = await createDatabase();
    const running = db.database.run("select 1");
    process.emit(reply({ id: "1", response }));
    expect(await running).toStrictEqual({
      error: { message: "DB のプロセスの応答を読めませんでした" },
      ms: 0,
    });
  });

  it.each([
    ["結果", { results: [result], ms: 1 }],
    ["SQLSTATE と位置を持つエラー", { error: { message: "x", code: "42601", position: 3 }, ms: 1 }],
  ])("形に合う%sの応答は、そのまま返す", async (_, response) => {
    const { process, db } = await createDatabase();
    const running = db.database.run("select 1");
    process.emit(reply({ id: "1", response }));
    expect(await running).toStrictEqual(response);
  });

  it("SQL の U+2028 と U+2029 をエスケープし、リクエストを 1 行で書く", async () => {
    const { process, db } = await createDatabase();
    void db.database.run("select '\u2028\u2029'");
    expect(process.written).toStrictEqual([`{"id":"1","sql":"select '\\u2028\\u2029'"}\n`]);
  });

  it("プロセスが終了したら、待っているリクエストに error を返す", async () => {
    const { process, db } = await createDatabase();
    const running = db.database.run("select 1");
    process.finish(1);
    expect(await running).toStrictEqual(stoppedWith("DB のプロセスが終了しました（終了コード 1）"));
  });

  it("プロセスが終了したら、status を stopped にする", async () => {
    const { process, db } = await createDatabase();
    process.finish(1);
    await flush();
    expect(db.database.status.getSnapshot()).toStrictEqual({
      kind: "stopped",
      reason: "DB のプロセスが終了しました（終了コード 1）",
    });
  });

  it("プロセスが終了した後の run は、書かずに error を返す", async () => {
    const { process, db } = await createDatabase();
    process.finish(1);
    await flush();
    const response = await db.database.run("select 2");
    expect({ response, written: process.written }).toStrictEqual({
      response: stoppedWith("DB のプロセスが終了しました（終了コード 1）"),
      written: [],
    });
  });

  it("ready の前にプロセスが終了したら、ready を失敗させる", async () => {
    const { process, db } = await createDatabase();
    process.fail(new Error("crash"));
    await expect(db.ready).rejects.toThrow("DB のプロセスが終了しました");
  });

  it("dispose は、待っているリクエストとその後の run に error を返す", async () => {
    const { db } = await createDatabase();
    const running = db.database.run("select 1");
    db.dispose();
    expect([await running, await db.database.run("select 2")]).toStrictEqual([
      stoppedWith("実行環境を止めました"),
      stoppedWith("実行環境を止めました"),
    ]);
  });

  it("dispose は、出力の購読を外す", async () => {
    const process = await createProcess();
    const unsubscribe = vi.fn();
    vi.spyOn(process.output, "subscribe").mockReturnValue(unsubscribe);
    createStdioDatabase(process).dispose();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
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
        setTimeout(() => process.emit(reply({ id, response: options.answer?.(sql) ?? ok })));
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

const bootDatabase = async (fake = databaseBackend()) => {
  const runtime = await bootWithBackend(fake.backend, {
    files: initialFiles,
    database: true,
    initialSql: "create table t (id int);",
  });
  return { runtime, created: fake.instances[0] };
};

describe("bootWithBackend の DB", () => {
  it("DB を使うときは、依存を入れてから、DB のプロセスを、端末も preload も付けずに起動する", async () => {
    const { created } = await bootDatabase();
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
  });

  it("DB を使うときは、初期データの SQL を DB のプロセスに送ってから解決する", async () => {
    const { created } = await bootDatabase();
    expect(created?.processes[1]?.written).toStrictEqual([
      '{"id":"1","sql":"create table t (id int);"}\n',
    ]);
  });

  it("DB を使うときは、実装に database を渡し、DB のプロセスを一覧に入れず、ready の database を持つ", async () => {
    const { runtime, created } = await bootDatabase();
    expect({
      database: created?.database,
      list: runtime.processes.list.getSnapshot(),
      status: runtime.database?.status.getSnapshot(),
    }).toStrictEqual({ database: true, list: [], status: { kind: "ready" } });
  });

  it("DB を使わないときは、DB のプロセスも依存の npm install も起動せず、database を持たない", async () => {
    const fake = databaseBackend();
    const runtime = await bootWithBackend(fake.backend, { files: initialFiles, initialSql: "x" });
    expect({
      database: fake.instances[0]?.database,
      processes: fake.instances[0]?.processes,
      runtime: runtime.database,
    }).toStrictEqual({ database: false, processes: [], runtime: undefined });
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
      expect({
        isBootError: error instanceof BootError,
        reason: (error as BootError).reason,
        message: ((error as BootError).cause as Error).message,
        tornDown: fake.instances[0]?.state.tornDown,
      }).toStrictEqual({ isBootError: true, reason: "failed", message, tornDown: true });
    },
  );

  it("ready の前に DB のプロセスが終了したときは、起動を失敗させる", async () => {
    const fake = databaseBackend({ ready: false });
    const booting = failure(bootWithBackend(fake.backend, { files: initialFiles, database: true }));
    await flush();
    fake.instances[0]?.processes[1]?.finish(1);
    expect(await booting).toBeInstanceOf(BootError);
  });

  it("DB のプロセスが ready を出さないまま上限を過ぎたら、起動した実行環境を破棄する", async () => {
    vi.useFakeTimers();
    try {
      const fake = databaseBackend({ ready: false });
      const booting = failure(
        bootWithBackend(fake.backend, { files: initialFiles, database: true }, 1000),
      );
      await vi.advanceTimersByTimeAsync(1000);
      await booting;
      expect(fake.instances[0]?.state.tornDown).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("dispose の後の run は、error を返す", async () => {
    const { runtime } = await bootDatabase();
    await runtime.dispose();
    expect(await runtime.database?.run("select 1")).toStrictEqual(
      stoppedWith("実行環境を止めました"),
    );
  });
});
