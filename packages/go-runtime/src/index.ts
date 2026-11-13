/** 値が変わったことを受け取る関数を登録し、解除する関数を返す。 */
export type Subscribe = (onChange: () => void) => () => void;

/** 値と、値が変わったことの通知。画面は useSyncExternalStore で読む。 */
export type Store<T> = { subscribe: Subscribe; getSnapshot: () => T };

/** ツールのルートからのパスと、ファイルの中身。 */
export type GoFiles = Readonly<Record<string, string>>;

/** Yaegi の WASM の読み込みの段階。 */
export type LoadPhase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "failed"; message: string };

/**
 * 実行の終わり方。
 * exited の exitCode は、正常に終わると 0、コンパイルのエラーとテストの失敗は 1、panic は 2、os.Exit は渡した値である。
 * failed は、WASM を読み込めなかったときと、Web Worker が異常終了したときである。
 */
export type GoExit =
  | { kind: "exited"; exitCode: number }
  | { kind: "stopped" }
  | { kind: "failed"; message: string };

/** 実行の 1 回。出力は、実行中に onOutput で少しずつ受け取る。 */
export type GoExecution = {
  done: Promise<GoExit>;
  /** 実行を止める。Web Worker を終了させるので、無限ループでも止まる。 */
  stop: () => void;
};

export type GoRunner = {
  phase: Store<LoadPhase>;
  /** Yaegi の WASM の読み込みを始める。読み込み中と読み込んだ後に呼んでも、1 度しか読み込まない。 */
  load: () => Promise<void>;
  /** ルートのディレクトリの直下の main の package を実行する。 */
  run: (files: GoFiles, onOutput: (chunk: string) => void) => GoExecution;
  /** テストのファイルを持つ全ての package のテストを、package ごとに実行する。 */
  test: (files: GoFiles, onOutput: (chunk: string) => void) => GoExecution;
};

/** ルートに go.mod が無いときと、go.mod に module の行が無いときの、ルートのディレクトリの import のパス。 */
export const DEFAULT_MODULE = "play";

/** ルートの go.mod の module の行から、ルートのディレクトリの import のパスを読む。 */
export function moduleName(files: GoFiles): string {
  const line = files["go.mod"]?.match(/^\s*module\s+"?([^\s"]+)"?\s*(?:\/\/.*)?$/m);
  return line?.[1] ?? DEFAULT_MODULE;
}

/** テストのファイル（_test.go）を持つディレクトリの import のパスを、名前の順で返す。 */
export function testPackages(files: GoFiles, module: string): string[] {
  const directories = new Set<string>();
  for (const path of Object.keys(files)) {
    if (!path.endsWith("_test.go")) continue;
    const slash = path.lastIndexOf("/");
    directories.add(slash === -1 ? module : `${module}/${path.slice(0, slash)}`);
  }
  return [...directories].sort();
}
