import type { SqlDatabase, Store } from "@fukuemon/sql-runtime";

export type { Store };

export type TerminalSize = { cols: number; rows: number };

export type BootOptions = {
  files: Readonly<Record<string, string>>;
  /** true のときに、DB のプロセスを起動し、NodeRuntime の database で SQL を受ける。 */
  database?: boolean;
  /** DB のプロセスを起動した後に実行する、初期データの SQL。失敗したときは、起動が失敗する。 */
  initialSql?: string;
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

/** 記録した本文。上限を超えた分は記録せず、truncated を立てる。テキストとして読めないものは、text が null である。 */
export type HttpBody = { text: string | null; size: number; truncated: boolean };

/** 記録したリクエストかレスポンスの、ヘッダと本文。omittedHeaders は、上限を超えて捨てたヘッダの数である。 */
type HttpMessageRecord = {
  headers: readonly { name: string; value: string }[];
  omittedHeaders?: number;
  body?: HttpBody;
};

/** 実行環境の中のサーバーが受けた、1 つのリクエストとレスポンス。response が無いものは、レスポンスを返す前に切れた。 */
export type HttpRecord = {
  id: string;
  /** 送った側と受けた側。id は、ブラウザが `browser`、サーバーが `port:<番号>`、待ち受けていないプロセスが `process`、訪問者が送信元のヘッダに付けた値が `header:<値>` である。 */
  from: { id: string; name: string };
  to: { id: string; name: string };
  method: string;
  url: string;
  /** 記録の行の URL が上限を超え、先頭だけを持つ。 */
  urlTruncated?: boolean;
  startedAt: number;
  durationMs: number;
  request: HttpMessageRecord;
  response?: HttpMessageRecord & { status: number };
};

export type NodeRuntime = {
  files: {
    tree: Store<readonly FileEntry[]>;
    changes: { subscribe: (onChange: (paths: readonly string[]) => void) => () => void };
    /** 同じパスのファイルかディレクトリが、実行環境にあるか。ツリーに出さない node_modules のパッケージの中身も確かめる。親のディレクトリが無いときは、失敗する。 */
    exists: (path: string) => Promise<boolean>;
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
  /** HTTP の記録。リクエストを受けた順に並べ、古いものから捨てる。 */
  httpExchanges: Store<readonly HttpRecord[]>;
  /** コンソールの記録。記録を取るスクリプトを足すまでは、空のままである。 */
  consoleEntries: Store<readonly never[]>;
  /** DB を使うプロジェクトのときだけある。DB のプロセスの状態は、database の status で持つ。 */
  database?: SqlDatabase;
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
