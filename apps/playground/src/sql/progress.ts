import type { LoadPhase } from "@fukuemon/sql-runtime/worker";

/** 実行のボタンを押してから結果が出るまでの、待っている段階の文。待っていないときは undefined を返す。 */
export function progressLabel(phase: LoadPhase, running: boolean): string | undefined {
  if (!running) return undefined;
  if (phase.kind === "loading") return "PGlite を読み込んでいます";
  if (phase.kind === "seeding") return "初期データを入れています";
  return "SQL を実行しています";
}
