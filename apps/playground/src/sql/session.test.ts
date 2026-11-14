import type { SqlResponse } from "@fukuemon/sql-runtime";
import type { WorkerSqlDatabase } from "@fukuemon/sql-runtime/worker";
import { describe, expect, it, vi } from "vitest";

import type { ProjectLoad } from "../project/project";
import type { Workspace } from "../workspace/workspace";
import {
  type SqlPersistence,
  type SqlRecord,
  createSessionOpener,
  createSqlSession,
} from "./session";

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

const never = () => new Promise<SqlResponse>(() => {});

describe("createSqlSession", () => {
  it("初期データの SQL で DB を作る", () => {
    const create = vi.fn(() => fakeDatabase());
    createSqlSession(project, create);
    expect(create.mock.calls).toStrictEqual([["create table t ();"]]);
  });

  it("open のファイルの名前と中身を、入力欄の初期値にする", () => {
    const session = createSqlSession(project, () => fakeDatabase());
    expect({ fileName: session.fileName, query: session.query.getSnapshot() }).toStrictEqual({
      fileName: "seed.sql",
      query: "select 1;",
    });
  });

  it("入力欄の SQL を変えると、購読を外すまで知らせる", () => {
    const session = createSqlSession(project, () => fakeDatabase());
    const onChange = vi.fn();
    const unsubscribe = session.query.subscribe(onChange);
    session.setQuery("select 2;");
    unsubscribe();
    session.setQuery("select 3;");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("実行の間は、実行中にする", () => {
    const session = createSqlSession(project, () => fakeDatabase(never));
    void session.execute("select 1");
    expect(session.running.getSnapshot()).toBe(true);
  });

  it("実行が終わったら、結果を返し、実行中を外す", async () => {
    const session = createSqlSession(project, () => fakeDatabase());
    const result = await session.execute("select 1");
    expect({ result, running: session.running.getSnapshot() }).toStrictEqual({
      result: response,
      running: false,
    });
  });

  it("実行中に呼んだときは、実行せずに error を返す", async () => {
    const run = vi.fn(never);
    const session = createSqlSession(project, () => fakeDatabase(run));
    void session.execute("select 1");
    const second = await session.execute("select 2");
    expect({ second, calls: run.mock.calls.length }).toStrictEqual({
      second: { error: { message: "前の SQL を実行しています" }, ms: 0 },
      calls: 1,
    });
  });

  it("load は、DB の読み込みを始める", async () => {
    const database = fakeDatabase();
    await createSqlSession(project, () => database).load();
    expect(database.load).toHaveBeenCalledTimes(1);
  });
});

describe("入力欄の SQL の保存", () => {
  const storage = () => {
    const saves: SqlRecord[] = [];
    const workspace: Workspace<SqlRecord> = {
      load: async () => ({ kind: "empty" }),
      save: async (record) => {
        saves.push(record);
      },
      clear: async () => undefined,
    };
    return { workspace, saves };
  };

  it("保存した SQL があるときは、入力欄の初期値にする", () => {
    const session = createSqlSession(project, () => fakeDatabase(), {
      saved: { kind: "saved", record: { sql: "select 9;", version: "v1", savedAt: 1 } },
      storage: storage().workspace,
    });
    expect(session.query.getSnapshot()).toBe("select 9;");
  });

  it.each([
    ["文字列でない SQL", { sql: 1, version: "v1" }],
    ["文字列でない version", { sql: "select 9;", version: 1 }],
    ["オブジェクトでない値", "x"],
  ])("保存したレコードが %s を持つときは、open のファイルの中身を初期値にする", (_, record) => {
    const session = createSqlSession(project, () => fakeDatabase(), {
      saved: { kind: "saved", record: record as unknown as SqlRecord },
      storage: storage().workspace,
    });
    expect(session.query.getSnapshot()).toBe("select 1;");
  });

  it("入力欄の SQL を変えると、保存してあったバージョンで保存する", async () => {
    const { workspace, saves } = storage();
    const session = createSqlSession(project, () => fakeDatabase(), {
      saved: { kind: "saved", record: { sql: "select 9;", version: "v0", savedAt: 1 } },
      storage: workspace,
      now: () => 5,
    });
    session.setQuery("select 2;");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(saves).toStrictEqual([{ sql: "select 2;", version: "v0", savedAt: 5 }]);
  });

  const savedRecord = {
    kind: "saved",
    record: { sql: "select 9;", version: "v0", savedAt: 1 },
  } as const;

  it("保存した SQL があるときは hasSaved を true に、無いときは false にする", () => {
    const withSaved = createSqlSession(project, () => fakeDatabase(), {
      saved: savedRecord,
      storage: storage().workspace,
    });
    const without = createSqlSession(project, () => fakeDatabase());
    expect([withSaved.hasSaved.getSnapshot(), without.hasSaved.getSnapshot()]).toStrictEqual([
      true,
      false,
    ]);
  });

  it("保存が通ると hasSaved を true にし、IndexedDB を読めないときは false のままにする", async () => {
    const available = createSqlSession(project, () => fakeDatabase(), {
      saved: { kind: "empty" },
      storage: storage().workspace,
    });
    const unavailable = createSqlSession(project, () => fakeDatabase(), {
      saved: { kind: "unavailable" },
      storage: storage().workspace,
    });
    available.setQuery("select 2;");
    unavailable.setQuery("select 2;");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect([available.hasSaved.getSnapshot(), unavailable.hasSaved.getSnapshot()]).toStrictEqual([
      true,
      false,
    ]);
  });

  it("保存が失敗したときは hasSaved を true にしない", async () => {
    const session = createSqlSession(project, () => fakeDatabase(), {
      saved: { kind: "empty" },
      storage: {
        ...storage().workspace,
        save: async () => {
          throw new Error("容量");
        },
      },
    });
    session.setQuery("select 2;");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(session.hasSaved.getSnapshot()).toBe(false);
  });

  it("reset は、保存した SQL を消し、入力欄を初期の SQL に戻し、hasSaved を false にする", async () => {
    const clear = vi.fn(async () => undefined);
    const session = createSqlSession(project, () => fakeDatabase(), {
      saved: savedRecord,
      storage: { ...storage().workspace, clear },
    });
    await session.reset();
    expect({
      clears: clear.mock.calls.length,
      query: session.query.getSnapshot(),
      hasSaved: session.hasSaved.getSnapshot(),
    }).toStrictEqual({ clears: 1, query: "select 1;", hasSaved: false });
  });

  it("reset の後に入力欄を変えると、プロジェクトのバージョンで保存する", async () => {
    const { workspace, saves } = storage();
    const session = createSqlSession(project, () => fakeDatabase(), {
      saved: savedRecord,
      storage: workspace,
      now: () => 7,
    });
    await session.reset();
    session.setQuery("select 2;");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(saves).toStrictEqual([{ sql: "select 2;", version: "v1", savedAt: 7 }]);
  });

  it("reset は、待っている保存を捨てる", async () => {
    const { workspace, saves } = storage();
    const session = createSqlSession(project, () => fakeDatabase(), {
      saved: savedRecord,
      storage: workspace,
    });
    session.setQuery("select 2;");
    await session.reset();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(saves.map(({ sql }) => sql)).not.toContain("select 2;");
  });

  it("消せなかったときは、reset が失敗し、入力欄と hasSaved を変えない", async () => {
    const session = createSqlSession(project, () => fakeDatabase(), {
      saved: savedRecord,
      storage: {
        ...storage().workspace,
        clear: async () => {
          throw new Error("消せない");
        },
      },
    });
    await expect(session.reset()).rejects.toThrow("消せない");
    expect({
      query: session.query.getSnapshot(),
      hasSaved: session.hasSaved.getSnapshot(),
    }).toStrictEqual({ query: "select 9;", hasSaved: true });
  });

  it("IndexedDB を読めないときは、canSave を false にする", () => {
    const session = createSqlSession(project, () => fakeDatabase(), {
      saved: { kind: "unavailable" },
      storage: storage().workspace,
    });
    expect(session.canSave).toBe(false);
  });
});

describe("createSessionOpener", () => {
  it("埋め込みの ID の保存先から読んだレコードを、SqlSession に渡す", async () => {
    const saved = { kind: "saved", record: { sql: "x", version: "v1", savedAt: 1 } } as const;
    const openWorkspace = vi.fn(
      (): Workspace<SqlRecord> => ({
        load: async () => saved,
        save: async () => undefined,
        clear: async () => undefined,
      }),
    );
    const create = vi.fn((_: unknown, persistence: SqlPersistence) =>
      createSqlSession(project, () => fakeDatabase(), persistence),
    );
    const open = createSessionOpener(
      () => Promise.resolve({ kind: "opened", project, embedId: "a/b" }),
      create,
      openWorkspace,
    );
    await open("?project=a/b");
    expect({
      embedId: openWorkspace.mock.calls,
      saved: create.mock.calls[0]?.[1].saved,
    }).toStrictEqual({ embedId: [["a/b"]], saved });
  });

  const opened: ProjectLoad<"sql"> = { kind: "opened", project, embedId: "a/b" };

  it("同じプロジェクトの読み込みには、同じ Promise を返す", () => {
    const load = Promise.resolve(opened);
    const open = createSessionOpener(
      () => load,
      () => createSqlSession(project, () => fakeDatabase()),
    );
    expect(open("?project=a/b")).toBe(open("?project=a/b"));
  });

  it("同じプロジェクトの読み込みでは、SqlSession を 1 つだけ作る", async () => {
    const load = Promise.resolve(opened);
    const create = vi.fn(() => createSqlSession(project, () => fakeDatabase()));
    const open = createSessionOpener(() => load, create);
    await Promise.all([open("?project=a/b"), open("?project=a/b")]);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("プロジェクトを開けなかったときは、開けなかった結果を返す", async () => {
    const failed: ProjectLoad<"sql"> = { kind: "failed", embedId: "a/b" };
    const create = vi.fn();
    const open = createSessionOpener(() => Promise.resolve(failed), create);
    expect({ result: await open("?project=a/b"), created: create.mock.calls.length }).toStrictEqual(
      { result: failed, created: 0 },
    );
  });
});
