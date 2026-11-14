import type { LoadPhase } from "@fukuemon/sql-runtime/worker";

/** PGlite を使えるようになるまでの、画面全体の待ちの文。待っていないときは undefined を返す。 */
export function bootLabel(phase: LoadPhase): string | undefined {
  if (phase.kind === "loading") return "PGlite を読み込んでいます";
  if (phase.kind === "seeding") return "初期データを入れています";
  return undefined;
}

/** PGlite を使えるようになった後の、実行のボタンを押してから結果が出るまでの文。待っていないときは undefined を返す。 */
export function progressLabel(phase: LoadPhase, running: boolean): string | undefined {
  if (!running || bootLabel(phase) !== undefined) return undefined;
  return "SQL を実行しています";
}
