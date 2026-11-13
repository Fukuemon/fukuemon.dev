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

/** 出力を行に分け、同じ種類の続く行を 1 つにまとめる。描く要素の数を、行の数より減らすためである。 */
export function groupLines(text: string): { kind: LineKind; text: string }[] {
  if (text === "") return [];
  const groups: { kind: LineKind; text: string }[] = [];
  for (const line of text.replace(/\n$/, "").split("\n")) {
    const kind = lineKind(line);
    const last = groups.at(-1);
    if (last?.kind === kind) last.text += `${line}\n`;
    else groups.push({ kind, text: `${line}\n` });
  }
  return groups;
}

export type Shortcut = "run" | "test" | "stop";

type KeyLike = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
};

/**
 * ページのどこにフォーカスがあっても受けるキー。Ctrl か ⌘ と Enter で実行、Shift を足すとテスト、Ctrl か ⌘ と . で止める。
 * 当たらないキーは undefined を返す。
 */
export function shortcutOf(event: KeyLike): Shortcut | undefined {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return undefined;
  if (event.key === "Enter") return event.shiftKey ? "test" : "run";
  if (event.key === "." && !event.shiftKey) return "stop";
  return undefined;
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
