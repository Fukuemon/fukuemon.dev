import type { SqlResponse } from "@fukuemon/sql-runtime";
import type { WorkerSqlDatabase } from "@fukuemon/sql-runtime/worker";
import { describe, expect, it, vi } from "vitest";

import { createSessionRegistry, createSqlSession } from "./session";

const response: SqlResponse = { results: [], ms: 1 };

const fakeDatabase = (run: WorkerSqlDatabase["run"] = async () => response): WorkerSqlDatabase => ({
  status: { subscribe: () => () => {}, getSnapshot: () => ({ kind: "ready" }) },
  phase: { subscribe: () => () => {}, getSnapshot: () => ({ kind: "idle" }) },
  load: vi.fn(async () => {}),
  run,
});

describe("createSqlSession", () => {
  it("初期データの SQL で DB を作り、入力欄の初期値を持つ", () => {
    const create = vi.fn(() => fakeDatabase());
    const session = createSqlSession("select 1;", "create table t ();", create);
    expect(create).toHaveBeenCalledWith("create table t ();");
    expect(session.query.getSnapshot()).toBe("select 1;");
  });

  it("入力欄の SQL を変えると、購読した側に知らせる", () => {
    const session = createSqlSession("", undefined, () => fakeDatabase());
    const onChange = vi.fn();
    const unsubscribe = session.query.subscribe(onChange);
    session.setQuery("select 2;");
    unsubscribe();
    session.setQuery("select 3;");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(session.query.getSnapshot()).toBe("select 3;");
  });

  it("実行の間だけ、実行中にする", async () => {
    let finish: (value: SqlResponse) => void = () => {};
    const session = createSqlSession("", undefined, () =>
      fakeDatabase(() => new Promise((resolve) => (finish = resolve))),
    );
    const done = session.execute("select 1");
    expect(session.running.getSnapshot()).toBe(true);
    finish(response);
    expect(await done).toBe(response);
    expect(session.running.getSnapshot()).toBe(false);
  });

  it("実行中に呼んだときは、実行せずに error を返す", async () => {
    const run = vi.fn(() => new Promise<SqlResponse>(() => {}));
    const session = createSqlSession("", undefined, () => fakeDatabase(run));
    void session.execute("select 1");
    expect(await session.execute("select 2")).toEqual({
      error: { message: "前の SQL を実行している" },
      ms: 0,
    });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("load は、DB の読み込みを始める", async () => {
    const database = fakeDatabase();
    await createSqlSession("", undefined, () => database).load();
    expect(database.load).toHaveBeenCalled();
  });
});

describe("createSessionRegistry", () => {
  it("同じキーには、同じ SqlSession を返す", () => {
    const create = vi.fn(() => createSqlSession("", undefined, () => fakeDatabase()));
    const sessionFor = createSessionRegistry();
    expect(sessionFor("a/b", create)).toBe(sessionFor("a/b", create));
    expect(sessionFor("", create)).not.toBe(sessionFor("a/b", create));
    expect(create).toHaveBeenCalledTimes(2);
  });
});
