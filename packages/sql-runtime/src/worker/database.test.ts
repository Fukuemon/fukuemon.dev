import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, vi } from "vitest";

import { type WorkerLike, createWorkerDatabase } from "./database";
import { type FromWorker, type ToWorker, createHandler } from "./handler";

type Create = () => Promise<Pick<PGlite, "exec">>;

/** メッセージを、同じスレッドの handler に渡す偽物の Web Worker。terminate の後も、crash でイベントを送れる。 */
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

const lastRows = async (response: Promise<import("../index").SqlResponse>) => {
  const value = await response;
  return "error" in value ? value.error : value.results.at(-1)?.rows;
};

const stopped = "DB の Web Worker が止まりました";

describe("createWorkerDatabase", () => {
  it("load か run を呼ぶまで、Web Worker を作らない", () => {
    const { database, workers } = setup();
    expect({ workers: workers.length, phase: database.phase.getSnapshot() }).toStrictEqual({
      workers: 0,
      phase: { kind: "idle" },
    });
  });

  it("初期データの SQL を入れてから、SQL を実行する", async () => {
    const { database } = setup({
      initialSql: "create table t (id int); insert into t values (7);",
    });
    expect(await lastRows(database.run("select id from t"))).toStrictEqual([[7]]);
  });

  it("読み込みの段階を、loading、seeding、ready の順に知らせる", async () => {
    const { database } = setup({ initialSql: "select 1" });
    const phases: string[] = [];
    database.phase.subscribe(() => phases.push(database.phase.getSnapshot().kind));
    await database.load();
    expect(phases).toStrictEqual(["loading", "seeding", "ready"]);
  });

  it("何度 load を呼んでも、Web Worker を 1 つだけ作る", async () => {
    const { database, workers } = setup();
    await Promise.all([database.load(), database.load(), database.run("select 1")]);
    expect(workers).toHaveLength(1);
  });

  it("初期データの SQL が失敗したときは、error を返し、段階を failed にし、Web Worker を捨てる", async () => {
    const { database, workers } = setup({ initialSql: "select * from missing" });
    const response = await database.run("select 1");
    const message = '初期データの SQL が失敗しました: relation "missing" does not exist';
    const error = { message, code: "42P01", position: 15 };
    expect({
      response,
      phase: database.phase.getSnapshot(),
      terminated: workers[0]?.terminated,
    }).toStrictEqual({
      response: { error, ms: 0 },
      phase: { kind: "failed", error },
      terminated: true,
    });
  });

  it("読み込みが失敗した後の run は、Web Worker を作り直す", async () => {
    const { database, workers } = setup({ initialSql: "select * from missing" });
    await database.run("select 1");
    await database.run("select 1");
    expect(workers).toHaveLength(2);
  });

  it("PGlite を読み込めないときは、error を返し、段階を failed にする", async () => {
    const { database } = setup({ create: () => Promise.reject(new Error("fetch failed")) });
    const response = await database.run("select 1");
    expect({ response, phase: database.phase.getSnapshot() }).toStrictEqual({
      response: { error: { message: "fetch failed" }, ms: 0 },
      phase: { kind: "failed", error: { message: "fetch failed" } },
    });
  });

  it("Web Worker を作れないときは、run が失敗せずに error を返す", async () => {
    const database = createWorkerDatabase({
      createWorker: () => {
        throw new Error("blocked by CSP");
      },
    });
    expect(await database.run("select 1")).toStrictEqual({
      error: { message: "blocked by CSP" },
      ms: 0,
    });
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
    const reason = `${stopped}: out of memory`;
    expect({ response: await waiting, status: database.status.getSnapshot() }).toStrictEqual({
      response: { error: { message: reason }, ms: 0 },
      status: { kind: "stopped", reason },
    });
    release();
  });

  it("異常終了の後の run は、Web Worker を作り直し、初期の状態の DB で実行して ready に戻す", async () => {
    const { database, workers } = setup({ initialSql: "create table t (id int);" });
    await database.run("insert into t values (1)");
    workers[0]?.crash();
    const rows = await lastRows(database.run("select count(*)::int from t"));
    expect({ rows, workers: workers.length, status: database.status.getSnapshot() }).toStrictEqual({
      rows: [[0]],
      workers: 2,
      status: { kind: "ready" },
    });
  });

  it("捨てた Web Worker から遅れて届いた error では、作り直した Web Worker を捨てない", async () => {
    const { database, workers } = setup();
    await database.load();
    workers[0]?.crash();
    await database.load();
    workers[0]?.crash("late");
    expect(await lastRows(database.run("select 1"))).toStrictEqual([[1]]);
  });

  it("読み込みの途中で異常終了したときは、待っている run に error を返す", async () => {
    const { database, workers } = setup({ create: () => new Promise(() => {}) });
    const waiting = database.run("select 1");
    workers[0]?.crash("boom");
    expect(await waiting).toStrictEqual({ error: { message: `${stopped}: boom` }, ms: 0 });
  });

  it("読み込んだ直後に、run の前に異常終了したときは、error を返す", async () => {
    const { database, workers } = setup();
    await database.load();
    const waiting = database.run("select 1");
    workers[0]?.crash();
    expect(await waiting).toStrictEqual({ error: { message: stopped }, ms: 0 });
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
    expect(post.mock.calls).toStrictEqual([
      [
        {
          type: "response",
          id: 1,
          response: { error: { message: "DB を起動していません" }, ms: 0 },
        },
      ],
    ]);
  });

  it("結果を送れないときは、同じ id に error を返す", async () => {
    const posted: FromWorker[] = [];
    let failed = false;
    const handle = createHandler(
      async () => ({ exec: async () => [] }),
      (message) => {
        if (message.type === "response" && !failed) {
          failed = true;
          throw new Error("could not be cloned");
        }
        posted.push(message);
      },
    );
    await handle({ type: "init" });
    await handle({ type: "run", id: 3, sql: "select 1" });
    expect(posted.at(-1)).toStrictEqual({
      type: "response",
      id: 3,
      response: { error: { message: "could not be cloned" }, ms: expect.any(Number) },
    });
  });
});
