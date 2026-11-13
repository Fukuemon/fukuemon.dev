import type { Store } from "@fukuemon/sql-runtime";

export type { Store };

export type TerminalSize = { cols: number; rows: number };

export type BootOptions = {
  files: Readonly<Record<string, string>>;
};

/** 作業ディレクトリのファイルかディレクトリ。path は作業ディレクトリからの相対パスで、区切りは `/` である。 */
export type FileEntry = { path: string; kind: "file" | "directory" };

export type ProcessStatus = { kind: "running" } | { kind: "exited"; code: number };

export type ProcessInfo = {
  id: string;
  /** startShell で起動したプロセスは shell、start で起動したプロセスは command である。 */
  kind: "shell" | "command";
  name: string;
  status: ProcessStatus;
};

export type OutputLog = {
  read: () => string;
  subscribe: (onChunk: (chunk: string) => void) => () => void;
};

export type ProcessHandle = {
  id: string;
  output: OutputLog;
  write: (data: string) => void;
  resize: (size: TerminalSize) => void;
  kill: () => void;
  exit: Promise<number>;
};

export type StartOptions = { name?: string; terminal?: TerminalSize };

/** 待ち受けたポート。sandbox と allow は、プレビューの iframe に付ける属性の値である。 */
export type OpenPort = { port: number; url: string; sandbox: string; allow: string };

export type NodeRuntime = {
  files: {
    tree: Store<readonly FileEntry[]>;
    changes: { subscribe: (onChange: (paths: readonly string[]) => void) => () => void };
    read: (path: string) => Promise<string>;
    write: (path: string, contents: string) => Promise<void>;
    createDirectory: (path: string) => Promise<void>;
    rename: (from: string, to: string) => Promise<void>;
    remove: (path: string) => Promise<void>;
  };
  processes: {
    list: Store<readonly ProcessInfo[]>;
    get: (id: string) => ProcessHandle | undefined;
    start: (
      command: string,
      args: readonly string[],
      options?: StartOptions,
    ) => Promise<ProcessHandle>;
    startShell: (options?: StartOptions) => Promise<ProcessHandle>;
  };
  ports: Store<readonly OpenPort[]>;
  /** HTTP の記録。記録を取る preload を足すまでは、空のままである。 */
  httpExchanges: Store<readonly never[]>;
  /** コンソールの記録。記録を取るスクリプトを足すまでは、空のままである。 */
  consoleEntries: Store<readonly never[]>;
  dispose: () => Promise<void>;
};

export type BootFailureReason = "not-isolated" | "timeout" | "failed";

/** bootNodeRuntime の失敗。reason で、画面に出す理由を分ける。 */
export class BootError extends Error {
  readonly reason: BootFailureReason;

  constructor(reason: BootFailureReason, options?: { cause?: unknown }) {
    super(`実行環境を起動できない: ${reason}`, options);
    this.name = "BootError";
    this.reason = reason;
  }
}
