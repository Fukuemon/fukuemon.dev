import type { BootOptions, OpenPort, TerminalSize } from "./types";

type BackendBootOptions = Pick<BootOptions, "files"> & {
  /** true のときに、DB のプロセスのスクリプトと依存の package.json を guestDirectory に置き、訪問者のプロセスに接続先と preload を渡す。 */
  database: boolean;
};

/** 実行環境が自分で起動するプロセス（internal）には、preload と接続先を渡さず、端末も付けない。 */
export type SpawnOptions = { terminal?: TerminalSize; internal?: boolean };

export type DirectoryItem = { name: string; kind: "file" | "directory" };

/** 作業ディレクトリのファイルの操作。パスは作業ディレクトリからの相対パスで、`""` は作業ディレクトリそのものである。 */
export type BackendFiles = {
  list: (directory: string) => Promise<readonly DirectoryItem[]>;
  readFile: (path: string) => Promise<Uint8Array>;
  writeFile: (path: string, contents: string) => Promise<void>;
  mkdir: (path: string) => Promise<void>;
  rename: (from: string, to: string) => Promise<void>;
  remove: (path: string) => Promise<void>;
  /** 作業ディレクトリの下の、作成、削除、名前の変更、中身の変更を知らせる。paths は、変わったパスである。 */
  watch: (onChange: (paths: readonly string[]) => void) => () => void;
};

export type BackendProcess = {
  output: { subscribe: (onChunk: (chunk: string) => void) => () => void };
  write: (data: string) => void;
  resize: (size: TerminalSize) => void;
  kill: () => void;
  exit: Promise<number>;
};

export type BackendInstance = {
  files: BackendFiles;
  spawn: (
    command: string,
    args: readonly string[],
    options?: SpawnOptions,
  ) => Promise<BackendProcess>;
  spawnShell: (options?: { terminal?: TerminalSize }) => Promise<BackendProcess>;
  /** 待ち受けているポートの全体を、変わるたびに知らせる。 */
  ports: { subscribe: (onChange: (ports: readonly OpenPort[]) => void) => () => void };
  /** DB のプロセスのスクリプトと、依存の package.json を置いたディレクトリの、絶対パス。 */
  guestDirectory: string;
  teardown: () => Promise<void>;
};

/** Node の実行環境の実装。node-runtime の直下は、この型だけを通して実装を使う。 */
export type RuntimeBackend = {
  isSupported: () => boolean;
  boot: (options: BackendBootOptions) => Promise<BackendInstance>;
};
