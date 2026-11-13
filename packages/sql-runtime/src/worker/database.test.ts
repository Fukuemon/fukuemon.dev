import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, vi } from "vitest";

import { type WorkerLike, createWorkerDatabase } from "./database";
import { type FromWorker, type ToWorker, createHandler } from "./handler";

type Create = () => Promise<Pick<PGlite, "exec">>;

/** メッセージを、同じスレッドの handler に渡す偽物の Web Worker。 */
class FakeWorker extends EventTarget implements WorkerLike {
  terminated = false;
  readonly received: ToWorker[] = [];
  private readonly handle: (message: ToWorker) => Promise<void>;

  constructor(create: Create) {
    super();
    this.handle = createHandler(create, (message: FromWorker) => {
      if (!this.terminated) this.dispatchEvent(new MessageEvent("message", { data: message }));
    });
  }

  postMessage(message: ToWorker) {
    this.received.push(message);
    void this.handle(message);
  }

  terminate() {
    this.terminated = true;
  }

  crash(message?: string) {
    const event = new Event("error") as Event & { message?: string };
    event.message = message;
    this.dispatchEvent(event);
  }
}

const setup = (options: { initialSql?: string; create?: Create } = {}) => {
  const workers: FakeWorker[] = [];
  const database = createWorkerDatabase({
    initialSql: options.initialSql,
    createWorker: () => {
      const worker = new FakeWorker(options.create ?? (() => PGlite.create()));
      workers.push(worker);
      return worker;
    },
  });
  return { database, workers };
};

const rowsOf = async (response: ReturnType<ReturnType<typeof setup>["database"]["run"]>) => {
  const value = await response;
  if ("error" in value) throw new Error(value.error.message);
  return value.results.at(-1)?.rows;
};

describe("createWorkerDatabase", () => {
  it("load か run を呼ぶまで、Web Worker を作らない", () => {
    const { database, workers } = setup();
    expect(workers).toHaveLength(0);
    expect(database.phase.getSnapshot()).toEqual({ kind: "idle" });
  });

  it("初期データの SQL を入れてから、SQL を実行する", async () => {
    const { database } = setup({
      initialSql: "create table t (id int); insert into t values (7);",
    });
    const phases: string[] = [];
    database.phase.subscribe(() => phases.push(database.phase.getSnapshot().kind));
    expect(await rowsOf(database.run("select id from t"))).toEqual([[7]]);
    expect(phases).toEqual(["loading", "seeding", "ready"]);
  });

  it("何度 load を呼んでも、Web Worker を 1 つだけ作る", async () => {
    const { database, workers } = setup();
    await Promise.all([database.load(), database.load(), database.run("select 1")]);
    expect(workers).toHaveLength(1);
  });

  it("初期データの SQL が失敗したときは、error を返し、次の run で作り直す", async () => {
    const { database, workers } = setup({ initialSql: "select * from missing" });
    const response = await database.run("select 1");
    expect("error" in response && response.error.message).toMatch(/^初期データの SQL が失敗した: /);
    expect(database.phase.getSnapshot().kind).toBe("failed");
    expect(workers[0]?.terminated).toBe(true);
    await database.run("select 1");
    expect(workers).toHaveLength(2);
  });

  it("PGlite を読み込めないときは、error を返す", async () => {
    const { database } = setup({ create: () => Promise.reject(new Error("fetch failed")) });
    const response = await database.run("select 1");
    expect("error" in response && response.error).toEqual({ message: "fetch failed" });
  });

  it("Web Worker が異常終了したときは、stopped にし、待っている run に error を返す", async () => {
    let release: () => void = () => {};
    const slow: Create = async () => {
      const pg = await PGlite.create();
      return {
        exec: async (...args: Parameters<PGlite["exec"]>) => {
          await new Promise<void>((resolve) => (release = resolve));
          return pg.exec(...args);
        },
      };
    };
    const { database, workers } = setup({ create: slow });
    await database.load();
    const waiting = database.run("select 1");
    await vi.waitFor(() => expect(workers[0]?.received).toHaveLength(2));
    workers[0]?.crash("out of memory");
    const reason = "DB の Web Worker が止まった: out of memory";
    expect(await waiting).toEqual({ error: { message: reason }, ms: 0 });
    expect(database.status.getSnapshot()).toEqual({ kind: "stopped", reason });
    release();
  });

  it("異常終了の後の run は、Web Worker を作り直し、初期の状態の DB で実行する", async () => {
    const { database, workers } = setup({ initialSql: "create table t (id int);" });
    await database.run("insert into t values (1)");
    workers[0]?.crash();
    expect(database.status.getSnapshot()).toEqual({
      kind: "stopped",
      reason: "DB の Web Worker が止まった",
    });
    expect(await rowsOf(database.run("select count(*)::int from t"))).toEqual([[0]]);
    expect(workers).toHaveLength(2);
    expect(database.status.getSnapshot()).toEqual({ kind: "ready" });
  });

  it("読み込みの途中で異常終了したときは、待っている run に error を返す", async () => {
    const { database, workers } = setup({ create: () => new Promise(() => {}) });
    const waiting = database.run("select 1");
    workers[0]?.crash("boom");
    expect(await waiting).toEqual({
      error: { message: "DB の Web Worker が止まった: boom" },
      ms: 0,
    });
  });

  it("購読を外すと、変化を知らせない", async () => {
    const { database } = setup();
    const onChange = vi.fn();
    database.phase.subscribe(onChange)();
    await database.load();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("createHandler", () => {
  it("init の前の run には、error を返す", async () => {
    const post = vi.fn();
    await createHandler(() => PGlite.create(), post)({ type: "run", id: 1, sql: "select 1" });
    expect(post).toHaveBeenCalledWith({
      type: "response",
      id: 1,
      response: { error: { message: "DB を起動していない" }, ms: 0 },
    });
  });
});
