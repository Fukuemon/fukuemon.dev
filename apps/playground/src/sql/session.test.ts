import type { SqlResponse } from "@fukuemon/sql-runtime";
import type { WorkerSqlDatabase } from "@fukuemon/sql-runtime/worker";
import { describe, expect, it, vi } from "vitest";

import type { ProjectLoad } from "../project/project";
import { createSessionOpener, createSqlSession } from "./session";

const response: SqlResponse = { results: [], ms: 1 };

const project = {
  tool: "sql",
  version: "v1",
  files: { "seed.sql": "select 1;" },
  open: "seed.sql",
  initialSql: "create table t ();",
} as const;

const fakeDatabase = (run: WorkerSqlDatabase["run"] = async () => response): WorkerSqlDatabase => ({
  status: { subscribe: () => () => {}, getSnapshot: () => ({ kind: "ready" }) },
  phase: { subscribe: () => () => {}, getSnapshot: () => ({ kind: "idle" }) },
  load: vi.fn(async () => {}),
  run,
});

describe("createSqlSession", () => {
  it("初期データの SQL で DB を作り、open のファイルの中身を入力欄の初期値にする", () => {
    const create = vi.fn(() => fakeDatabase());
    const session = createSqlSession(project, create);
    expect(create).toHaveBeenCalledWith("create table t ();");
    expect(session.query.getSnapshot()).toBe("select 1;");
    expect(session.fileName).toBe("seed.sql");
  });

  it("入力欄の SQL を変えると、購読した側に知らせる", () => {
    const session = createSqlSession(project, () => fakeDatabase());
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
    const session = createSqlSession(project, () =>
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
    const session = createSqlSession(project, () => fakeDatabase(run));
    void session.execute("select 1");
    expect(await session.execute("select 2")).toEqual({
      error: { message: "前の SQL を実行している" },
      ms: 0,
    });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("load は、DB の読み込みを始める", async () => {
    const database = fakeDatabase();
    await createSqlSession(project, () => database).load();
    expect(database.load).toHaveBeenCalled();
  });
});

describe("createSessionOpener", () => {
  const opened: ProjectLoad<"sql"> = { kind: "opened", project, embedId: "a/b" };

  it("同じプロジェクトの読み込みには、同じ Promise と SqlSession を返す", async () => {
    const load = Promise.resolve(opened);
    const create = vi.fn(() => createSqlSession(project, () => fakeDatabase()));
    const open = createSessionOpener(() => load, create);
    expect(open("?project=a/b")).toBe(open("?project=a/b"));
    expect(await open("?project=a/b")).toMatchObject({ kind: "opened" });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("プロジェクトを開けなかったときは、SqlSession を作らない", async () => {
    const create = vi.fn();
    const failed: ProjectLoad<"sql"> = { kind: "failed", embedId: "a/b" };
    const open = createSessionOpener(() => Promise.resolve(failed), create);
    expect(await open("?project=a/b")).toBe(failed);
    expect(create).not.toHaveBeenCalled();
  });
});
