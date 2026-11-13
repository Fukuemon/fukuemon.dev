import {
  type DatabaseStatus,
  type SqlDatabase,
  type SqlError,
  type SqlResponse,
  type Store,
  toSqlError,
} from "../index";
import type { FromWorker, ToWorker } from "./handler";

/** PGlite の読み込みの段階。画面は、読み込みの進み具合をこの値で出す。 */
export type LoadPhase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "seeding" }
  | { kind: "ready" }
  | { kind: "failed"; error: SqlError };

/** createWorkerDatabase が使う Web Worker の操作。テストでは、同じ形の偽物を渡す。 */
export type WorkerLike = {
  postMessage: (message: ToWorker) => void;
  terminate: () => void;
  addEventListener: (type: "message" | "error", listener: (event: Event) => void) => void;
};

export type WorkerSqlDatabase = SqlDatabase & {
  phase: Store<LoadPhase>;
  /** PGlite の読み込みを始める。読み込み中と読み込んだ後に呼んでも、Web Worker を 1 つしか作らない。 */
  load: () => Promise<void>;
};

export type WorkerDatabaseOptions = {
  createWorker: () => WorkerLike;
  initialSql?: string;
};

const STOPPED = "DB の Web Worker が止まりました";

type WritableStore<T> = Store<T> & { set: (value: T) => void };

function createStore<T>(initial: T): WritableStore<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    subscribe: (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    getSnapshot: () => value,
    set: (next) => {
      value = next;
      for (const listener of listeners) listener();
    },
  };
}

/**
 * PGlite を Web Worker で動かす SqlDatabase。Web Worker は、最初の load か run で作る。
 * PGlite の読み込みか初期データの SQL が失敗したときは、Web Worker を捨て、次の run で作り直す。
 * Web Worker が異常終了したときは、status を stopped にし、待っている run に error を返す。次の run で作り直し、DB の中身は初期の状態に戻る。
 */
export function createWorkerDatabase({
  createWorker,
  initialSql,
}: WorkerDatabaseOptions): WorkerSqlDatabase {
  const status = createStore<DatabaseStatus>({ kind: "ready" });
  const phase = createStore<LoadPhase>({ kind: "idle" });
  const pending = new Map<number, (response: SqlResponse) => void>();
  let worker: WorkerLike | undefined;
  let booted: Promise<SqlError | undefined> | undefined;
  let nextId = 0;

  // 実行を止める手段の元になる。Web Worker を作り直すと、DB の中身は初期の状態に戻る
  const discard = (reason: string) => {
    worker?.terminate();
    worker = undefined;
    booted = undefined;
    for (const resolve of pending.values()) resolve({ error: { message: reason }, ms: 0 });
    pending.clear();
  };

  const failLoading = (error: SqlError) => {
    phase.set({ kind: "failed", error });
    discard(error.message);
  };

  const boot = (): Promise<SqlError | undefined> => {
    if (booted) return booted;
    phase.set({ kind: "loading" });
    let created: WorkerLike;
    try {
      created = createWorker();
    } catch (error) {
      const failed = toSqlError(error);
      failLoading(failed);
      return Promise.resolve(failed);
    }
    worker = created;
    booted = new Promise((resolve) => {
      // 捨てた Web Worker から遅れて届いたイベントで、作り直した Web Worker を壊さない
      const isCurrent = () => worker === created;
      created.addEventListener("message", (event) => {
        if (!isCurrent()) return;
        const message = (event as MessageEvent<FromWorker>).data;
        if (message.type === "seeding") phase.set({ kind: "seeding" });
        if (message.type === "ready") {
          phase.set({ kind: "ready" });
          status.set({ kind: "ready" });
          resolve(undefined);
        }
        if (message.type === "init-failed") {
          resolve(message.error);
          failLoading(message.error);
        }
        if (message.type === "response") {
          pending.get(message.id)?.(message.response);
          pending.delete(message.id);
        }
      });
      created.addEventListener("error", (event) => {
        if (!isCurrent()) return;
        const detail = (event as ErrorEvent).message;
        const reason = detail ? `${STOPPED}: ${detail}` : STOPPED;
        status.set({ kind: "stopped", reason });
        phase.set({ kind: "idle" });
        resolve({ message: reason });
        discard(reason);
      });
      created.postMessage({ type: "init", initialSql });
    });
    return booted;
  };

  return {
    status,
    phase,
    load: async () => {
      await boot();
    },
    run: async (sql) => {
      const error = await boot();
      if (error) return { error, ms: 0 };
      const current = worker;
      if (!current) return { error: { message: STOPPED }, ms: 0 };
      const id = nextId++;
      return new Promise<SqlResponse>((resolve) => {
        pending.set(id, resolve);
        current.postMessage({ type: "run", id, sql });
      });
    },
  };
}
