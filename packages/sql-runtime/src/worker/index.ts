import { type WorkerSqlDatabase, createWorkerDatabase } from "./database";

export type { LoadPhase, WorkerSqlDatabase } from "./database";

/** SQL だけを動かすツールの DB。PGlite の `.wasm` と `.data` は、load か run を呼ぶまで取得しない。 */
export function createBrowserDatabase(initialSql?: string): WorkerSqlDatabase {
  return createWorkerDatabase({
    createWorker: () => new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }),
    initialSql,
  });
}
