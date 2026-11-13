import type { LoadPhase } from "@fukuemon/go-runtime";

import type { GoOutput } from "./session";

/** 出力の 1 行の種類。画面は、種類で色を変える。 */
export type LineKind = "pass" | "fail" | "error" | "run" | "plain";

const KINDS: readonly [RegExp, LineKind][] = [
  [/^\s*--- PASS|^PASS$|^ok\s/, "pass"],
  [/^\s*--- FAIL|^FAIL\b/, "fail"],
  [/^panic: |^[^\s:]+\.go:\d+:\d+: /, "error"],
  [/^\s*=== (RUN|PAUSE|CONT)\b/, "run"],
];

export function lineKind(line: string): LineKind {
  return KINDS.find(([pattern]) => pattern.test(line))?.[1] ?? "plain";
}

/** 実行のボタンを押してから終わるまでの、待っている段階の文。待っていないときは undefined を返す。 */
export function progressLabel(
  phase: LoadPhase,
  running: boolean,
  kind: GoOutput["kind"],
): string | undefined {
  if (!running) return undefined;
  if (phase.kind === "loading") return "Yaegi を読み込んでいます";
  return kind === "test" ? "テストを実行しています" : "実行しています";
}

/** 終わり方の 1 行。実行していないときと、実行中は undefined を返す。 */
export function exitLabel(exit: GoOutput["exit"]): string | undefined {
  if (exit === undefined) return undefined;
  if (exit.kind === "exited") return `終了コード ${exit.exitCode}`;
  if (exit.kind === "stopped") return "止めました";
  if (exit.kind === "timeout") return "時間の上限で止めました";
  return exit.message;
}
