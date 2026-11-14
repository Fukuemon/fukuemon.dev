import type { BootFailureReason, NodeRuntime } from "@fukuemon/node-runtime";
import { type ActionDispatch, createContext, use } from "react";

import type { Selection, SelectionAction } from "./selection";
import type { NodeProject, RuntimeResult } from "./session";

/** 開いたプロジェクトと、実行環境の起動の Promise。値が変わるのは、実行環境を起動し直すときだけである。 */
export type RuntimeValue = { project: NodeProject; runtime: Promise<RuntimeResult> };

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

export function useSelection(): SelectionValue {
  const value = use(SelectionContext);
  if (!value) throw new Error("SelectionContext の provider が無い");
  return value;
}
