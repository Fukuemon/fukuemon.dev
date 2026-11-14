import type { BootFailureReason, ProcessInfo } from "@fukuemon/node-runtime";

export const SUPPORTED_BROWSERS = "デスクトップの Chrome か Edge の最新版で開いてください。";

const REASONS: Record<BootFailureReason, string> = {
  "not-isolated": "このブラウザでは、Node の実行環境を動かせません。",
  timeout: "実行環境の起動が 30 秒で終わりませんでした。",
  failed: "実行環境を起動できませんでした。",
};

/** 実行環境を起動できなかった理由と、対応するブラウザの文。端末とプレビューのペインに出す。 */
export const bootFailureMessage = (reason: BootFailureReason) =>
  `${REASONS[reason]}${SUPPORTED_BROWSERS}`;

/**
 * プロジェクトの読み込みと起動の、画面の右下の待ちの文。
 * 2 つの待ちは続けて起きるので、文を替えない（packages/ui/design/components.md の PageLoading）。
 */
export const BOOT_LABEL = "実行環境を起動しています";

export const PREVIEW_TIMEOUT_MS = 30_000;

export const PREVIEW_TIMEOUT_MESSAGE = `プレビューが 30 秒で読み込まれませんでした。${SUPPORTED_BROWSERS}`;

/** 端末のタブの文。終了したプロセスは、終了コードを添える。 */
export const processLabel = (info: ProcessInfo) =>
  info.status.kind === "exited" ? `${info.name}（終了 ${info.status.code}）` : info.name;

/** 新しいシェルの名前。2 つ目からは番号を付け、端末のタブを見分けられるようにする。 */
export function shellName(processes: readonly ProcessInfo[]): string {
  const shells = processes.filter((info) => info.kind === "shell").length;
  return shells === 0 ? "シェル" : `シェル ${shells + 1}`;
}
