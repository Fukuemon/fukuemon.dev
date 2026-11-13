import { bootWithBackend } from "./runtime";
import type { BootOptions, NodeRuntime } from "./types";
import { webContainerBackend } from "./webcontainer";

export { BootError } from "./types";
export type {
  BootFailureReason,
  BootOptions,
  ConsoleRecord,
  FileEntry,
  HttpRecord,
  NodeRuntime,
  OpenPort,
  OutputLog,
  ProcessHandle,
  ProcessInfo,
  ProcessStatus,
  StartOptions,
  Store,
  TerminalSize,
} from "./types";

/**
 * Node の実行環境を起動する。起動の失敗、30 秒の上限、cross-origin isolation が無いことは、BootError の reason で返す。
 * 実行環境は、ページの中で同時に 1 つだけ動かせる。新しく起動する前に、前の実行環境の dispose を待つ。
 */
export function bootNodeRuntime(options: BootOptions): Promise<NodeRuntime> {
  return bootWithBackend(webContainerBackend, options);
}
