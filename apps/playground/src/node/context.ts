import type { BootFailureReason, NodeRuntime, Store } from "@fukuemon/node-runtime";
import { type ActionDispatch, createContext, use, useSyncExternalStore } from "react";

import type { Selection, SelectionAction } from "./selection";
import type { NodeProject, RuntimeResult } from "./session";

/** 開いたプロジェクト、実行環境の起動の Promise、実行環境を起動し直す操作と、起動し直している間かどうか、SQL のペインの入力欄の SQL。値が変わるのは、実行環境を起動し直すときだけである。 */
export type RuntimeValue = {
  project: NodeProject;
  runtime: Promise<RuntimeResult>;
  restart: () => Promise<void>;
  busy: Store<boolean>;
  sqlQuery: Store<string>;
  setSqlQuery: (sql: string) => void;
};

export const RuntimeContext = createContext<RuntimeValue | null>(null);

export type SelectionValue = { selection: Selection; dispatch: ActionDispatch<[SelectionAction]> };

export const SelectionContext = createContext<SelectionValue | null>(null);

/**
 * 起動を待って、実行環境を返す。起動できなかったときは、runtime の代わりに理由を返し、ペインは初期ファイルを読み取り専用で出す。
 * 起動を待つ間は、呼んだペインの Suspense の fallback を出す。
 */
export function useRuntime():
  | { project: NodeProject; runtime: NodeRuntime; reason?: undefined }
  | { project: NodeProject; runtime?: undefined; reason: BootFailureReason } {
  const value = use(RuntimeContext);
  if (!value) throw new Error("RuntimeContext の provider が無い");
  const result = use(value.runtime);
  return result.kind === "running"
    ? { project: value.project, runtime: result.runtime }
    : { project: value.project, reason: result.reason };
}

/** 実行環境を起動し直す操作と、起動し直している間かどうか。ヘッダの「起動し直す」と同じ操作である。 */
export function useRestart(): { restart: () => Promise<void>; restarting: boolean } {
  const value = use(RuntimeContext);
  if (!value) throw new Error("RuntimeContext の provider が無い");
  const restarting = useSyncExternalStore(
    value.busy.subscribe,
    value.busy.getSnapshot,
    value.busy.getSnapshot,
  );
  return { restart: value.restart, restarting };
}

/** SQL のペインの入力欄の SQL と、替える関数。値は src/node/ のモジュールが持ち、保存する。 */
export function useSqlQuery(): [string, (sql: string) => void] {
  const value = use(RuntimeContext);
  if (!value) throw new Error("RuntimeContext の provider が無い");
  const query = useSyncExternalStore(
    value.sqlQuery.subscribe,
    value.sqlQuery.getSnapshot,
    value.sqlQuery.getSnapshot,
  );
  return [query, value.setSqlQuery];
}

export function useSelection(): SelectionValue {
  const value = use(SelectionContext);
  if (!value) throw new Error("SelectionContext の provider が無い");
  return value;
}

const runtimeKeys = new WeakMap<NodeRuntime, number>();
let nextRuntimeKey = 0;

/**
 * 実行環境ごとに違う番号。起動し直した後に、エディタを新しい実行環境につなぎ直すための key に使う。
 * Suspense は、起動を待つ間にペインを隠すだけで、Effect の後始末を呼ばないので、key を変えないとエディタが古い実行環境に書き込む。
 */
export function runtimeKey(runtime: NodeRuntime | undefined): string {
  if (!runtime) return "read-only";
  let key = runtimeKeys.get(runtime);
  if (key === undefined) {
    key = nextRuntimeKey++;
    runtimeKeys.set(runtime, key);
  }
  return String(key);
}
