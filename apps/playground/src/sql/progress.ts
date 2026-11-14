import type { LoadPhase } from "@fukuemon/sql-runtime/worker";

/**
 * PGlite を使えるようになるまでの、画面全体の待ちの文。待っていないときは undefined を返す。
 * 読み込みと初期データの投入で文を替えない。文が替わると、スクリーンリーダーが 2 回読み上げるためである。
 */
export function bootLabel(phase: LoadPhase): string | undefined {
  if (phase.kind === "loading" || phase.kind === "seeding") return "PGlite を読み込んでいます";
  return undefined;
}

/** PGlite を使えるようになった後の、実行のボタンを押してから結果が出るまでの文。待っていないときは undefined を返す。 */
export function progressLabel(phase: LoadPhase, running: boolean): string | undefined {
  if (!running || bootLabel(phase) !== undefined) return undefined;
  return "SQL を実行しています";
}
