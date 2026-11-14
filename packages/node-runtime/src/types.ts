import type { Store } from "@fukuemon/sql-runtime";

export type { Store };

export type TerminalSize = { cols: number; rows: number };

export type BootOptions = {
  files: Readonly<Record<string, string>>;
};

/**
 * files.readAll で読まないパスと、中身を読まないファイルの大きさ。exclude は、パスの区切りの 1 つと一致する名前である。
 * limit を渡すと、読めたファイルの数か、読んだ大きさの合計が超えた時点で、読むのをやめて ReadLimitError で失敗する。
 */
export type ReadAllOptions = {
  exclude: readonly string[];
  maxBytes: number;
  limit?: { files: number; bytes: number };
};

/**
 * 作業ディレクトリの 1 つのファイル。maxBytes を超えるファイルと、テキストとして読めないファイルは、text が null である。
 * kind が other のものは、ファイルでもディレクトリでもないもの（シンボリックリンクなど）で、text は指す先の中身である。
 */
export type FileContents = {
  path: string;
  kind: "file" | "other";
  size: number;
  text: string | null;
};

/** files.readAll が、limit の数か大きさを超えたときの失敗。 */
export class ReadLimitError extends Error {
  constructor() {
    super("作業ディレクトリのファイルが、読む上限を超えた");
    this.name = "ReadLimitError";
  }
}

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

export type ConsoleLevel = "debug" | "log" | "info" | "warn" | "error";

/**
 * 記録した 1 つの値。呼んだ時点の値を写した木で、関数、DOM の要素のように写せない値は、名前か文字で持つ。
 * `text` は、ほかの種類に当たらない値と、上限で切った部分の印である。循環した参照は `circular` で持つ。
 */
export type ConsoleRecordValue =
  | { kind: "string"; value: string }
  | { kind: "number"; value: number }
  | { kind: "bigint"; value: string }
  | { kind: "boolean"; value: boolean }
  | { kind: "null" }
  | { kind: "undefined" }
  | { kind: "symbol"; description: string }
  | { kind: "function"; name: string }
  | { kind: "text"; value: string }
  | { kind: "circular" }
  | { kind: "array"; items: readonly ConsoleRecordValue[] }
  | {
      kind: "object";
      className?: string;
      entries: readonly { key: string; value: ConsoleRecordValue }[];
    }
  | {
      kind: "map";
      entries: readonly { key: ConsoleRecordValue; value: ConsoleRecordValue }[];
    }
  | { kind: "set"; items: readonly ConsoleRecordValue[] }
  | { kind: "error"; name: string; message: string; stack?: readonly string[] };

/** 記録を出した側。Node のプロセスは、`start` の `name` を持つ。プレビューは、ページを返したサーバーのポートを持つ。 */
export type ConsoleSource = { kind: "process"; name: string } | { kind: "preview"; port: number };

/** `console.*` の 1 回の呼び出しの記録。time は `Date.now()` のミリ秒である。 */
export type ConsoleRecord = {
  id: string;
  level: ConsoleLevel;
  source: ConsoleSource;
  time: number;
  args: readonly ConsoleRecordValue[];
};

export type NodeRuntime = {
  files: {
    tree: Store<readonly FileEntry[]>;
    changes: { subscribe: (onChange: (paths: readonly string[]) => void) => () => void };
    /** 同じパスのファイルかディレクトリが、実行環境にあるか。ツリーに出さない node_modules のパッケージの中身も確かめる。親のディレクトリが無いときは、失敗する。 */
    exists: (path: string) => Promise<boolean>;
    read: (path: string) => Promise<string>;
    /** 作業ディレクトリのファイルを、パスの順に全て読む。exclude に当たるパスは読まない。 */
    readAll: (options: ReadAllOptions) => Promise<readonly FileContents[]>;
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
  /** コンソールの記録。届いた順に並べ、古いものから捨てる。 */
  consoleEntries: Store<readonly ConsoleRecord[]>;
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
