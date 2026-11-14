---
type: feature-design
title: プレイグラウンド
description: apps/playground の構成とパス、ディレクトリ、実行環境のインターフェースの型、状態の置き場、プロジェクトと保存の形、起動の流れ、SQL を送る形式
status: draft
governs:
  - apps/playground/
verified_commit: unverified
---

# プレイグラウンド

## Overview

プレイグラウンドは、訪問者がブラウザの中でコードと SQL を動かすツールを、`play.fukuemon.dev` で提供するアプリである。  
ツールは、Node の実行環境、SQL だけを動かすツール、Go を動かすツールの 3 つである。  
記事は、ツールのページを iframe で埋め込む。訪問者は、同じページをトップレベルでも開ける。

全体の構成とホスト名は [fukuemon.dev Design Doc](../../docs/design/DesignDoc.md) にある。  
実行の方式は、次の ADR が決めている。

- ADR-0033: [Node と npm の実行に WebContainers を採り、実行環境と画面の間をインターフェースで分ける](../../docs/adr/0033-webcontainers-for-node.md)
- ADR-0037: [Go のコードを、Yaegi のインタプリタの WASM で動かす](../../docs/adr/0037-go-with-yaegi.md)
- ADR-0053: [DB の記事は PGlite を使い、Node のコードからは Unix ドメインソケットで `pg` から接続し、SQL は DB のプロセスの標準入出力で送る](../../docs/adr/0053-pglite-database-in-playground.md)

## Scope

持つものは次のとおり。

- アプリの構成、パス、ディレクトリと import の向き
- Node の実行環境と画面の間のインターフェースの型と、画面が記録を読む形
- ツールのページの React のツリーと、状態の置き場
- プロジェクトの JSON の形、訪問者のファイルの保存の形
- 起動から実行までの流れ、動かせないブラウザでの表示
- SQL を送る形式と、結果の表示

持たないものは次のとおり。

- AI のエージェントからの操作の登録。登録する位置（トップレベルで開いたページ）だけを書く。操作の名前、許可のスイッチ、確認、記録は、[AI からの操作の Design Doc](../../docs/design/features/ai-operations/DesignDoc.md) が持つ。
  - ADR-0044: [AI のエージェントからの操作は、WebMCP の API で登録し、MCP-B の polyfill と relay でも呼べるようにする](../../docs/adr/0044-ai-operations-with-webmcp.md)
- コンソールの式を評価する入力欄。
- キャンバスとスライドのエディタの中の構成。ディレクトリを並べる位置だけを書く。
- 記事の本文で、埋め込みを置く書き方。記事の形式の設計が持つ。
- 画面のコンポーネントの見た目。[packages/ui/DESIGN.md](../../packages/ui/DESIGN.md) が持つ。

## Design

### アプリとパス

`apps/playground` は、Vite の React のアプリである。  
ツールごとに、HTML のエントリーポイントを持ち、1 つのツールのページが、1 つの React のツリーになる。  
ADR-0046: [プレイグラウンドを Vite の React のアプリにし、ツールごとに HTML のエントリーポイントとパスを分ける](../../docs/adr/0046-playground-as-vite-react-app.md)

| パス     | ツール                 | cross-origin isolation のヘッダ |
| -------- | ---------------------- | ------------------------------- |
| `/node/` | Node の実行環境        | 返す                            |
| `/sql/`  | SQL だけを動かすツール | 返さない                        |
| `/go/`   | Go を動かすツール      | 返さない                        |

- `/` は、`https://fukuemon.dev/playground` へリダイレクトする。
- 開くプロジェクトは、クエリの `project` で指定する（`/node/?project=<埋め込みの ID>`）。`project` が無いときは、デフォルトのプロジェクトを開く。
- 記事の iframe と、トップレベルで開くページは、同じ URL を使う。ページは、`window.self !== window.top` で埋め込みかどうかを判定し、埋め込みのときは、ページのヘッダを出さず、AI のエージェントからの操作を登録しない。
- ペインの並べ方は、ページの幅で決める。

ビルドは、`vp build` で行う。  
React Compiler を、`apps/playground` のビルドにだけ入れる。`apps/playground` のコードに、`memo`、`useMemo`、`useCallback` を書かない。書くのは、計測して遅いと分かったときだけにする。  
ADR-0047: [React Compiler を、`apps/playground` にだけ入れる](../../docs/adr/0047-react-compiler-in-playground.md)

### ディレクトリ

`apps/playground/src/` は、関心ごとのディレクトリで分ける。実装の種類のディレクトリ（`components/`、`hooks/`、`utils/`）を作らない。  
ADR-0048: [Node の実行環境のモジュールを package にし、記録を store で、ファイルの書き込みとプロセスの起動を関数で公開する](../../docs/adr/0048-node-runtime-interface-and-stores.md)

```text
apps/playground/
  node/index.html         Node の実行環境のエントリーポイント
  sql/index.html          SQL だけを動かすツールのエントリーポイント
  go/index.html           Go を動かすツールのエントリーポイント
  src/
    node/                 Node の実行環境のページ。レイアウト、ペインのコンポーネント、Context、選択の状態、起動と保存を進める React の外のモジュール
    sql/                  SQL だけを動かすツールのページ。入力欄の SQL、実行中かどうか、読み込みと実行の関数を持つ React の外のモジュール
    go/                   Go を動かすツールのページ。ファイル、実行中かどうか、出力、実行とテストの関数を持つ React の外のモジュール
    sql-console/          SQL の入力欄、結果の表、実行計画のツリー
    code-editor/          CodeMirror 6 の拡張の組み立てと、その拡張で作るエディタのコンポーネント
    project/              埋め込みの ID、プロジェクトの JSON の読み込み、デフォルトのプロジェクト
    workspace/            訪問者のファイルの保存
    ai-operations/        AI のエージェントからの操作の許可のスイッチ、登録、確認、記録

packages/
  sql-runtime/src/        SqlDatabase の型、結果とエラーの形、PGlite で SQL を実行して結果の形にする関数、PGlite を Web Worker で動かす実装
  node-runtime/src/       NodeRuntime の型、bootNodeRuntime、store、記録の行を抜き出す処理、標準入出力で SqlDatabase を実装する処理
    webcontainer/         @webcontainer/api を import する実装。WebContainers に依る処理
    guest/                実行環境の中の Node が動かすファイル（preload、DB のプロセスのスクリプト、DB のプロセスの依存を書く package.json）
  go-runtime/src/         GoRunner の型、import のパスと、テストを持つ package を求める関数
    worker/               Yaegi を Web Worker で動かす GoRunner の実装、Web Worker の fetch を差し替える処理
  go-runtime/go/          WASM にする Go のコード。Yaegi で訪問者のファイルを実行する処理
```

- キャンバスとスライドのエディタは、追加するときに、`apps/playground/src/` の同じ階層に並べる。
  - キャンバスのディレクトリ（`drawio/`、`excalidraw/`、`documents/`、`figures/`）の間と、`@fukuemon/figures` への import の向きは、[キャンバスの Design Doc](../../docs/design/features/canvas/DesignDoc.md#ディレクトリ) にある。Oxlint は、`drawio/` と `excalidraw/` も、ツールのページの間の import を止める対象にする。
  - スライドのエディタのディレクトリ（`slides/`）と、`@fukuemon/slides` への import の向きは、[スライドの Design Doc](../../docs/design/features/slides/DesignDoc.md#ディレクトリと依存) にある。Oxlint は、`slides/` も、ツールのページの間の import を止める対象にする。
- `code-editor/` は、Node の実行環境のページ（`src/node/`）、スライドのエディタのページ（`src/slides/`）、Go を動かすツールのページ（`src/go/`）、`sql-console/` が共有する。`code-editor/` は、ツールのページのディレクトリと、`documents/` を import しない。
- 実行環境の処理は、実行環境ごとの 3 つの package に置く。package は、型、store、関数だけを持つ。React のコンポーネントと、store を React で読む処理は、`apps/playground` に置く。
  - `@fukuemon/sql-runtime`（`packages/sql-runtime`）: PGlite で SQL を実行する処理。
  - `@fukuemon/node-runtime`（`packages/node-runtime`）: Node の実行環境の処理。`@fukuemon/sql-runtime` に依存する。
  - `@fukuemon/go-runtime`（`packages/go-runtime`）: Go のコードを実行する処理。
  - 3 つの package は、`@fukuemon/ui`、`@fukuemon/playground-project`、React に依存しない。`@fukuemon/sql-runtime` と `@fukuemon/go-runtime` は、workspace のどの package にも依存しない。
  - package は、ほかの package と同じく、`exports` でソースのファイルを指す。ビルドは、`apps/playground` の Vite が行う。`@fukuemon/go-runtime` の WASM だけは、package の `build` の script がビルドする（[Go](#go)）。
- この文書では、`node-runtime/` は `packages/node-runtime/src/` を、`webcontainer/` と `guest/` はその下のディレクトリを指す。
- `@fukuemon/sql-runtime` は、エントリーポイントを 2 つに分ける。
  - 型と、PGlite で SQL を実行して結果の形にする関数。このエントリーポイントは、PGlite から型だけを import する。関数はブラウザと Node の両方で動くので、このエントリーポイントは DOM と Worker の API を使わない。`Store` の型も、このエントリーポイントに置く。
  - PGlite を Web Worker で動かす、`SqlDatabase` の実装。SQL だけを動かすツールが使う。
- プロジェクトの JSON と、`playground.json` の型と schema は、`packages/playground-project`（`@fukuemon/playground-project`）に置く。`apps/web` のビルドと、`project/` が使う。
- `guest/` のファイルは、ブラウザではなく、実行環境の中の Node で動く。`webcontainer/` が、ファイルの中身を文字列として読み込み、実行環境に書く。tsconfig と lint の対象を、ブラウザのコードと分ける。
- `guest/` の `package.json` は、DB のプロセスの依存（PGlite、`pglite-socket`）のバージョンを、範囲ではなく 1 つの値で書く。PGlite のバージョンは、`@fukuemon/sql-runtime` の依存と同じにする。`@fukuemon/node-runtime` のテストで、2 つの `package.json` の PGlite のバージョンを比べ、同じことを確認する。
- `node-runtime/` の中の import の向きは、次のとおり。
  - `node-runtime/` の直下は、`webcontainer/` の `RuntimeBackend` の実装を、`bootNodeRuntime` の 1 か所だけで import する。
  - `webcontainer/` が `node-runtime/` の直下から import するのは、型と、`backend.ts` が定義するエラークラス（`PathNotFoundError`）だけである。
  - `guest/` は、`node-runtime/` の直下と `webcontainer/` を import しない。

次の図は、`apps/playground/src/` のディレクトリと package の、互いの間で許す import の向きを示す。矢印の無い組は、import しない。

```mermaid
flowchart TB
  node["src/node"]
  sql["src/sql"]
  go["src/go"]
  console["sql-console"]
  codeeditor["code-editor"]
  runtime["@fukuemon/node-runtime"]
  database["@fukuemon/sql-runtime"]
  runner["@fukuemon/go-runtime"]
  project["project"]
  workspace["workspace"]
  ui["@fukuemon/ui"]
  ai["ai-operations"]
  pp["@fukuemon/playground-project"]

  node --> runtime
  node --> console
  node --> codeeditor
  node --> project
  node --> workspace
  node --> database
  node --> ui
  node --> ai
  ai --> ui
  sql --> console
  sql --> database
  sql --> project
  sql --> workspace
  sql --> ui
  sql --> ai
  go --> runner
  go --> codeeditor
  go --> project
  go --> workspace
  go --> ui
  go --> ai
  console --> database
  console --> codeeditor
  console --> ui
  runtime --> database
  workspace --> project
  project --> pp
```

- `src/node/`、`sql-console/`、`node-runtime/` が `@fukuemon/sql-runtime` から import するのは、型だけである。`workspace/` が `project/` から import するのも、型だけである。
  - `guest/` の DB のプロセスのスクリプトだけは、`@fukuemon/sql-runtime` の、PGlite で SQL を実行して結果の形にする関数を import する。`guest/` は、PGlite を Web Worker で動かす `SqlDatabase` の実装のエントリーポイントを import しない。
- `node-runtime/` は、`project/` を import しない。`BootOptions` は、プロジェクトの型を使わない。
- `workspace/` と `node-runtime/` は、互いを import しない。2 つをつなぐ処理は、`src/node/` が持つ。
- `sql-console/` は、`workspace/` を import しない。入力欄の値と、値の変更は、props で受ける。値を持ち、保存するのは、`src/node/` と `src/sql/` である。
- `@webcontainer/api` に依存するのは、`@fukuemon/node-runtime` だけである。`apps/playground` の `package.json` には、`@webcontainer/api` を依存として書かない。
- Oxlint の `no-restricted-imports` が止める import は、次の 3 つ。
  - `packages/node-runtime/src/webcontainer/` のほかからの、`@webcontainer/api` の import
  - `apps/playground/src/` の `node/`、`sql/`、`go/`、`drawio/`、`excalidraw/`、`slides/` の間の import
  - `apps/playground/src/ai-operations/` からの、ツールのディレクトリの import

### NodeRuntime

Node の実行環境と画面の間は、`NodeRuntime` で分ける。store と関数が渡すデータは、シリアライズできる素の値だけにする。型に、`@webcontainer/api` の型を含めない。

```ts
type Store<T> = {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => T;
};

type BootOptions = {
  files: Readonly<Record<string, string>>;
  database: boolean;
  initialSql?: string;
};

declare function bootNodeRuntime(options: BootOptions): Promise<NodeRuntime>;

type NodeRuntime = {
  files: {
    tree: Store<readonly FileEntry[]>;
    changes: { subscribe: (onChange: (paths: readonly string[]) => void) => () => void };
    readAll: (options: ReadAllOptions) => Promise<readonly FileSnapshot[]>;
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
      options?: { name?: string; terminal?: TerminalSize },
    ) => Promise<ProcessHandle>;
    startShell: (options?: { name?: string; terminal?: TerminalSize }) => Promise<ProcessHandle>;
  };
  ports: Store<readonly OpenPort[]>;
  httpExchanges: Store<readonly HttpRecord[]>;
  consoleEntries: Store<readonly ConsoleRecord[]>;
  database?: SqlDatabase;
  dispose: () => Promise<void>;
};

type ReadAllOptions = {
  exclude: readonly string[];
  maxBytes: number;
  limit?: { files: number; bytes: number };
};

type FileSnapshot = { path: string; kind: "file" | "other"; size: number; text: string | null };

type ProcessHandle = {
  id: string;
  output: OutputLog;
  write: (data: string) => void;
  resize: (size: TerminalSize) => void;
  kill: () => void;
  exit: Promise<number>;
};

type OutputLog = {
  read: () => string;
  subscribe: (onChunk: (chunk: string) => void) => () => void;
};
```

名前は、実装のときに変えてよい。

- 起動は、`bootNodeRuntime` が返す Promise で待つ。起動の失敗は、Promise の失敗で受け取る。失敗は、理由（`crossOriginIsolated` が `false`、30 秒で終わらない、そのほか）を持つ。
- 30 秒の判定と、作りかけのインスタンスの破棄は、`bootNodeRuntime` の中で行う。
- `node-runtime/` が公開する起動の関数は、`bootNodeRuntime` だけである。Promise を埋め込みの ID ごとに持つ処理は、`src/node/` に置く。
- `webcontainer/` の `spawn` が、接続先の環境変数と `NODE_OPTIONS` を組み立てて、プロセスに渡す。画面は、環境変数を渡さない。渡す値は、[実行環境が追加するファイルとプロセス](#実行環境が追加するファイルとプロセス) にある。
- 実行環境が自分で起動するプロセス（DB のプロセス、DB の依存の `npm install`）は、`processes.list` に入れない。
- 端末のシェルは、`processes.startShell` で起動する。起動するシェルのプログラムは、`webcontainer/` が決める。画面は、シェルのプログラムの名前を持たない。
- `start` を呼ばないコンポーネントは、`processes.get` で、プロセスの出力を読む。
- `files.changes` は、ファイルの中身が変わったことの通知である。保存と、エディタで開いているファイルの更新に使う。
- ツリーを変えるファイルの操作（新しいファイルへの `files.write`、`files.createDirectory`、`files.rename`、`files.remove`）は、操作の後にツリーを読み直してから終わる。読み直しが失敗したときは、ログに出し、操作は成功として終える。操作の成否は、操作そのものの成否で決める。
- `files.readAll` は、作業ディレクトリのファイルを、パス、サイズ、テキストの中身で返す。`exclude` に当たるパスは読まない。`maxBytes` を超えるファイルと、テキストとして読めないファイルは、`text` が `null` になる。`exclude` に当たるかの判定、`maxBytes` を超えるかの判定、テキストかどうかの判定は、`node-runtime/` の直下が持つ。
  - ファイルでもディレクトリでもないもの（シンボリックリンク）は、`kind` を `other` にして、指す先の中身を返す。指す先の無いものは返さない。
  - 一覧を読んだ後に消えたファイルとディレクトリは、スキップする。作業ディレクトリそのものが無いときと、ほかの理由で読めないときは、`files.readAll` が失敗する。読めなかった作業ディレクトリを、読めたものとして扱わないためである。
  - 同時に読むファイルとディレクトリの一覧は、ツリーの全体で合わせて 32 個までにする。同時に始めた読み込みは、`limit` を超えても取り消せないためである。
  - `limit` を渡すと、読めたファイルの数か、読んだ大きさの合計が `limit` の値を超えた時点で、残りを読まずに `ReadLimitError` で失敗する。超えたプロジェクトでも、保存のたびに全部を読まないようにするためである。
- `FileEntry` は、パスを持つ。画面は、パスを、`FileTree` の項目の `id` に使う。
- `ProcessInfo` は、ID、種別、名前、状態を持つ。種別は、`processes.startShell` で起動したプロセスが `shell`、`processes.start` で起動したプロセスが `command` である。画面は、種別でシェルの数を数え、2 つ目からのシェルの名前に番号を付ける。
- `OpenPort` は、ポート、URL、プレビューの iframe に付ける属性（`sandbox`、`allow`）を持つ。属性の値は、`webcontainer/` が決める。
- プレビューに入れるスクリプトから `postMessage` で送られるコンソールの記録を受けて、`consoleEntries` に入れる処理は、`node-runtime/` が持つ。スクリプトの中身と、メッセージの形は、`node-runtime/` の直下が持つ。`node-runtime/` の直下は、スクリプトの中身を、`BackendBootOptions` の `previewScript` で `webcontainer/` に渡す。メッセージの origin の確認は、`webcontainer/` が行う。
- `database` は、DB を使うプロジェクトのときだけある。DB のプロセスの状態は、`database` の `status` で公開し、`NodeRuntime` には持たせない。
- 実行環境を起動し直すときは、`src/node/` のモジュールが、古いインスタンスの `files.readAll` の結果を受け取ってから、`dispose` を呼ぶ。その結果を `BootOptions` の `files` に渡して、`bootNodeRuntime` で新しいインスタンスを作る。
  - `files.readAll` には、`exclude` に `node_modules` を、`maxBytes` に保存のときと同じ 1 MB を渡し、`limit` は渡さない。`text` が `null` のファイルは、新しいインスタンスに渡さない。
  - 保存しないファイル（`.env`、ビルドの出力、`.git`）も、新しいインスタンスに渡す。テキストとして読めないものは渡さないので、新しいインスタンスの `.git` とビルドの出力には、テキストのファイルだけが残る。
  - ファイルでもディレクトリでもないもの（`kind` が `other`、シンボリックリンク）は、新しいインスタンスに渡さない。渡すと、指す先の中身を持つ通常のファイルになり、その後の保存で IndexedDB に入るためである。
    - ADR-0070: [Node の実行環境は、シークレットのファイル、ビルドの出力、`.git`、リンクを保存せず、保存に上限を付ける](../../docs/adr/0070-node-save-targets.md)
  - `src/node/` のモジュールは、起動し直すときの `files.readAll` に、5 秒の上限を付ける。失敗したときと、上限までに終わらないときは、保存のために最後に読んだ `files.readAll` の結果で起動する。
  - その結果も無いときは、前に起動したときのファイル（保存したファイルか、初期ファイル）で起動する。
  - 作業ディレクトリを読めずに起動し直したときは、「作業ディレクトリを読めませんでした」の案内を出す。
    - 案内は、起動し直しを始めるときと、初期の状態に戻したときに消す。起動し直しで続けて読めなかったときは、消した後に出し直す。
    - 起動に失敗した実行環境を起動し直すときは、作業ディレクトリを読まないので、案内を出しも消しもしない。
  - 保存のために読んだ結果には、保存しないディレクトリの下のファイルが入らないので、その結果で起動すると、そのファイルは作業ディレクトリに無い。
  - 作業ディレクトリを読めたときは、ページを開いたときに IndexedDB から読んだファイルを使わない。作業ディレクトリのファイルで起動するので、IndexedDB を読めないときも、訪問者が変えたファイルが残る。
  - ADR-0069: [Node の実行環境を起動し直すときに、作業ディレクトリを読めなければ、前に起動したときのファイルで起動する](../../docs/adr/0069-node-runtime-commands-without-visitor-action.md)

SQL だけを動かすツールと、Go を動かすツールは、`NodeRuntime` を実装しない。それぞれ、`SqlDatabase`（`@fukuemon/sql-runtime`）と `GoRunner`（`@fukuemon/go-runtime`）を持つ。

### `webcontainer/` が実装する型

`node-runtime/` の直下と、`webcontainer/` の間は、次の型で分ける。  
直下のコードは、この型だけを使い、WebContainers に依る処理を持たない。

```ts
type RuntimeBackend = {
  isSupported: () => boolean;
  boot: (options: BackendBootOptions) => Promise<BackendInstance>;
};

type BackendBootOptions = {
  files: Readonly<Record<string, string>>;
  database: boolean;
  previewScript: string;
};

type BackendInstance = {
  files: BackendFiles;
  spawn: (
    command: string,
    args: readonly string[],
    options?: { terminal?: TerminalSize; internal?: boolean; cwd?: string },
  ) => Promise<BackendProcess>;
  spawnShell: (options?: { terminal?: TerminalSize }) => Promise<BackendProcess>;
  ports: { subscribe: (onChange: (ports: readonly OpenPort[]) => void) => () => void };
  previewMessages: { subscribe: (onMessage: (message: unknown) => void) => () => void };
  guestDirectory: string;
  teardown: () => Promise<void>;
};

type BackendProcess = {
  output: { subscribe: (onChunk: (chunk: string) => void) => () => void };
  write: (data: string) => void;
  resize: (size: TerminalSize) => void;
  kill: () => void;
  exit: Promise<number>;
};
```

名前は、実装のときに変えてよい。

- `BackendFiles` は、ファイルかディレクトリか、そのどちらでもないもの（シンボリックリンク）かを持つ一覧、バイト列での読み込み、書き込み、ディレクトリの作成、名前の変更、削除、変更の通知を持つ。store は持たない。`files.tree` の store と `files.readAll` は、`node-runtime/` の直下が、この操作から組み立てる。
  - 一覧と読み込みは、パスが無いときに `PathNotFoundError` で失敗する。WebContainers の `fs` のエラーには `code` が無いので、WebContainers の実装は、`message` の先頭の `ENOENT:` で見分ける。
- `webcontainer/` が持つ処理は、次のとおり。
  - `isSupported`: `crossOriginIsolated` の判定。
  - `boot`: WebContainers の起動、初期ファイルの書き込み、`guest/` のファイルを実行環境のディレクトリに置く処理、プレビューに入れるスクリプトの登録。
  - `spawn`: `NODE_OPTIONS` と環境変数の組み立て。`internal` が `true` のプロセスには、preload を追加しない。`node-runtime/` の直下は、DB の依存の `npm install` を `guestDirectory` で実行するときに、`cwd` を渡す。
  - `spawnShell`: 起動するシェルのプログラムの決定と、シェルの起動。環境変数は、`spawn` が、`internal` を指定しないプロセスに渡すのと同じ値を渡す。
  - `ports`: 待ち受けたポートの通知、`OpenPort` の `sandbox` と `allow` の値、ポートの URL を書くファイルの更新。
  - `previewMessages`: プレビューからの `postMessage` の受信と、origin の確認。
- `node-runtime/` の直下が持つ処理は、store、記録の行を抜き出す処理、30 秒の判定、プレビューの URL の確認、DB のプロセスの起動と、標準入出力での `SqlDatabase` の実装である。
- `node-runtime/` の直下は、`webcontainer/` が知らせたポートのうち、URL が `https:` で、ツールのページと別の origin のものだけを、`ports` の store に入れる。
  合わないポートは、プレビューのタブに出さない。
  ツールのページと同じ origin のページを、`allow-same-origin` を付けた iframe で開くと、プレビューのスクリプトがツールのページを操作できるためである。
  `webcontainer/` は、ポートの URL を書くファイルに、確認で除く前の、知らせたすべてのポートの URL を書く。
- `guest/` のファイルと、標準入出力での `SqlDatabase` の実装は、実行環境が Node のプロセスを動かすことを前提にしている。Node のプロセスを持たない実行環境に差し替えるときは、`webcontainer/` に加えて、この 2 つも直す。

### 記録を読む形

- 記録（ファイルのツリー、プロセスの一覧、ポート、HTTP の記録、コンソールの記録）は、種類ごとの store で公開する。画面は、`useSyncExternalStore` で読む。Effect の中で `setState` を呼んで、記録を写さない。
- `getSnapshot` は、記録が変わっていない間、同じ参照を返す。
- プロセスの出力は、`OutputLog` で公開する。端末のペインは、Effect の中で、`read` の結果を端末のエンジンに書いてから、`subscribe` で追加の出力を書く。
- preload は、記録の行の行頭に、固定のプレフィックスを付ける。`node-runtime/` の直下（`webcontainer/` の外）の処理が、`BackendProcess` の `output` から受けたそのままの出力から、プレフィックスの付いた行を抜き出して、store に入れる。`OutputLog` には、抜き出した後の出力を渡す。
- コンソールの記録の、出力したプロセスの名前は、行を抜き出す処理が付ける。名前は、行を出力したプロセスの、`start` の `name` である。シェルで起動したプロセスの行には、シェルの名前が付く。
- プレフィックスは、HTTP の記録が `@@fd:http `、コンソールの記録が `@@fd:console `、DB のプロセスの応答が `@@fd:sql ` である。見分ける処理は、`node-runtime/` の直下に 1 つ置く。
  - ADR-0054: [HTTP の流れとコンソールを preload とプレビューのスクリプトで記録し、記録の行は端末に出さない](../../docs/adr/0054-record-http-and-console-with-prefixed-lines.md)
- store は、記録の件数に上限を置き、超えた古い記録を消す。上限は、プロセスの出力が 1 つのプロセスにつき 1 MB、コンソールの記録が 1000 件、HTTP の記録が 500 件である。値は、実装のタスクで測って変えてよい。

### React のツリーと状態

次の図は、Node の実行環境のページのツリーを示す。

```mermaid
flowchart TB
  page["NodePage<br/>プロジェクトと保存したファイルを読み、起動する"]
  ctx["2 つの Context<br/>実行環境のインスタンス（起動の Promise）、画面の選択の状態"]
  layout["レイアウト"]
  files["FilesPane"]
  editor["EditorPane"]
  terminal["TerminalPane"]
  preview["PreviewPane"]
  http["HttpPane"]
  cons["ConsolePane"]
  sqlp["SqlPane<br/>DB を使うプロジェクトのときだけ"]
  ui["@fukuemon/ui の Case"]
  sc["sql-console"]

  page --> ctx --> layout
  layout --> files --> ui
  layout --> editor --> ui
  layout --> terminal --> ui
  layout --> preview --> ui
  layout --> http --> ui
  layout --> cons --> ui
  layout --> sqlp --> sc
```

- Context は 2 つで、`src/node/` に定義する。
  - 実行環境のインスタンスを、起動の Promise で渡す Context。開いたプロジェクトも一緒に渡す。ペインは、Promise を `use` で読み、ペインごとの `Suspense` で起動を待つ。値が変わるのは、実行環境を起動し直すときだけである。
  - 画面の選択の状態を渡す Context。選んだファイル、開いているタブ、選んだ端末のタブ、選んだプレビューのポート、選んだ HTTP のやり取り、下のペインのタブを持つ。状態は、`NodePage` がプロジェクトを読んだ後に描く `NodeLayout` が、`useReducer` で持つ。
- Context は、`<Context>` を provider として書き、`use(Context)` で読む。
- ツリーをまたぐ通知（`CustomEvent`）と、状態管理のライブラリは使わない。
- ペインのコンポーネント（`FilesPane` など）が、実行環境を読み、`@fukuemon/ui` の Case に、素の値の props を渡す。Case と、`sql-console/` のコンポーネントは、`NodeRuntime` の型を import しない。
  - `HttpPane` は、`httpExchanges` の送信元と送信先と、`ports` から、`HttpExchangeList` の `actors` を組み立てる。`processes.list` は使わない。シェルで起動したサーバーは、`processes.list` に入らないためである。
  - `PreviewPane` は、`ports` の URL と属性から、iframe を作る。
  - `sql-console/` のコンポーネントは、`SqlDatabase` の `status`、SQL を実行する関数、実行中かどうかの値、入力欄の値、入力欄のファイルの名前、DB が止まったときに出す案内の文を、props で受ける。`status` は、`useSyncExternalStore` で読む。
  - DB が止まった後の戻り方は `SqlDatabase` の実装ごとに違うので、案内の文は呼ぶ側が渡す。
  - 実行の結果は、`sql-console/` のコンポーネントが持ち、表に出す。
  - `SqlPane` は、`NodeRuntime` の `database` の `status` と `run`、`useTransition` から得た実行中かどうかの値、入力欄の値を、`sql-console/` のコンポーネントに渡す。
  - SQL だけを動かすツールは、`src/sql/` の React の外のモジュールが持つ、SQL を実行する関数と、実行中かどうかの値を渡す。画面の実行のボタンと、AI からの操作の `sql_run_query` は、同じ関数を呼ぶ。
  - SQL だけを動かすツールは、`sql-console/` のコンポーネントの省略できる props で、もう 1 つの値を渡す。AI からの操作が、時間の上限で DB を初期の状態に戻したかどうかを表す値である。値は、`src/sql/` のモジュールが持つ。`sql-console/` のコンポーネントは、値が戻したことを示すときに、DB を初期の状態に戻したことを出す。`SqlPane` は、渡さない。
  - 「実行環境を起動し直す」の関数は、起動の Promise を持つ `src/node/` のモジュールが公開する。`SqlPane` は、この関数を、`sql-console/` のコンポーネントの、省略できる props で渡す。SQL だけを動かすツールは、渡さない。
- `Suspense` の境界は、ペインごとに置く。fallback は、同じ Case に、`state` の `pending` を渡したものにする。待ちの印は、ペインの外の `Suspense` が `PageLoading` で出す。プロジェクトの読み込みと起動の待ちは続けて起きるので、境界が別の 2 つの `Suspense` にも、`PageLoading` に同じ文を渡す。
- `use` に渡す Promise は、React の外のモジュールが、埋め込みの ID ごとに 1 つ作って持つ。プロジェクトの JSON の Promise は `project/` が持つ。`src/node/` と `src/sql/` のモジュールは、プロジェクトの JSON と、`workspace/` から読んだ、保存してあるファイルを、1 つにまとめた Promise を持つ。ページは、まとめた Promise を `use` で読む。起動の Promise は `src/node/` が持つ。Go を動かすツールでは、`src/go/` のモジュールが、プロジェクトの JSON と保存したファイルを読んだ後のモジュールの Promise を、1 つにまとめて持つ。実行環境を起動し直すときは、`src/node/` が、起動の Promise を新しいものに替える。
- タブで切り替えるペイン（端末、コンソール、HTTP の一覧、プレビュー）は、`Activity` で包む。隠している間の記録は、store が持つ。
- 端末のペインの中のプロセスのタブは、選んだプロセスの端末だけを描く。プロセスのタブを替えたときは、端末を作り直し、プロセスの出力の記録を端末に書き込み直す。xterm.js の端末は、`Activity` で隠すと Effect のクリーンアップで破棄されるためである。
- Node の実行環境では、実行のボタンの、実行中かどうかの値を、`useTransition` で持つ。
- SQL だけを動かすツールと、Go を動かすツールでは、`src/sql/` と `src/go/` の React の外のモジュールが、実行中かどうかの値を持つ。コンポーネントは、この値を `useSyncExternalStore` で読む。AI からの操作で実行している間も、ボタンを実行中の表示にするためである。モジュールは、PGlite と Yaegi を読み込んでいる間も、値を実行中にする。
- SQL だけを動かすツールの PGlite と、Go を動かすツールの Yaegi は、訪問者が実行のボタンを押したときと、AI からの操作の `sql_run_query`、`go_run`、`go_test` が呼ばれたときに読み込む。ページを開いたときには、読み込まない。
  - ADR-0063: [AI のエージェントからの操作を、SQL だけを動かすツールと Go を動かすツールにも公開し、PGlite と Yaegi を操作が呼ばれたときにも読み込む](../../docs/adr/0063-ai-operations-for-sql-and-go.md)

SQL だけを動かすツールのページは、次のとおり組む。

- `src/sql/` の React の外のモジュールが、埋め込みの ID ごとに 1 つの `SqlSession` を作る。`SqlSession` は、次のものを持つ。
  - 入力欄の SQL を持つ store と、値を変える関数。初期値は、プロジェクトの `files` の、`open` のファイルの中身である。
  - 実行中かどうかの store。
  - `SqlDatabase` を Web Worker で動かす実装（`@fukuemon/sql-runtime`）と、PGlite の読み込みを始める関数。
  - 実行する関数。`SqlDatabase` の `run` を呼び、`SqlResponse` を返す。呼んでから返すまで、実行中かどうかの値を実行中にする。
  - 実行する関数を実行中に呼んだときは、実行せずに `error` を持つ値を返す。
- 同じモジュールが、ページの URL のクエリからプロジェクトを読み、埋め込みの ID の `SqlSession` を返す関数を持つ。ページは、この関数の Promise を `use` で読む。
- ページは、このモジュールの値を `useSyncExternalStore` で読み、`sql-console/` のコンポーネントに渡す。
- 入力欄のエディタは、CodeMirror 6 にする。Ctrl か ⌘ と Enter で実行する。
- CodeMirror 6 の拡張の組み立ては、`src/code-editor/` の 1 か所に置く。Node の実行環境、Go を動かすツール、スライドのエディタも、同じ組み立てを使い、言語の拡張と、ページに固有の keymap を足す。Node の実行環境は、Ctrl か ⌘ と S のキーで何もしない keymap を足す。入力のたびに書き込むので、ブラウザがページを保存するのを止めるためである。
  - 行番号、アクティブ行のハイライト、インデントガイド、対応する括弧のハイライトを出す。折りたたみのガターは出さない。
  - Tab キーでインデントする。補完の一覧が開いているときは、Tab キーで補完を確定する。
  - Esc の後 2 秒の間の Tab キーで、エディタの外へ移る。このことを、実行のボタンの横に書く。Node の実行環境のページでは、エディタのペインの下端に書く。
  - 選択があるときは、アクティブ行のハイライトを消す。ハイライトは選択の範囲より上に描かれ、選択を隠すためである。
  - Ctrl か ⌘ と F で、検索と置換のパネルをエディタの上端に出す。パネルの文言は日本語にする。
  - 置換の行は、最初は畳んで出し、パネルのボタンで開く。狭い幅でも、エディタの行が見えるようにするためである。
  - 補完の一覧の行は、44px の高さにする。
  - CodeMirror は、ビルドで `code-editor` のチャンクに分け、エディタを持つページの間で共有する。
  - 色は、`packages/ui` のテーマ変数を読む。CodeMirror のデフォルトの色は、ダークのテーマで読めないので残さない。
  - フォーカスの表示は、エディタを囲む要素に付ける。CodeMirror が作る要素には `focus-ring` のユーティリティを付けられないので、検索パネルの入力欄とボタンには、同じ値を書く。
- 実行のボタンを押してから結果が出るまで、待っている段階を出す。PGlite の読み込みと初期データの投入の間は、画面の右下に `PageLoading` で出す。SQL の実行の間は、結果の欄に `Loading` で出す。

Node の実行環境のページは、次のとおり組む。

- ペインは、左にファイルのツリー、中央にエディタ、右にプレビュー、下に端末を置く。ペインの間は `SplitPane` で分け、訪問者が幅と高さを変えられる。
- `NodePage` は、プロジェクトと保存したファイルをまとめた Promise を `use` で読んでから、ペインを並べる。起動の Promise は、`RuntimeContext` で渡し、ペインが `use` で読む。起動を待つ間は、ペインごとの `Suspense` が、同じ Case に `state` の `pending` を渡した空のペインを出す。プロジェクトと保存したファイルを読む間は `NodePage` の `Suspense` が、起動を待つ間は `NodeLayout` の `Suspense` が、画面の右下に `PageLoading` を出す。どちらの `Suspense` も、`messages.ts` の `BOOT_LABEL` を渡す。
- `src/node/` の React の外のモジュールが、埋め込みの ID ごとに 1 つ、起動の Promise を持つ。起動した後に、シェル、`npm install`、起動のコマンドの順にプロセスを起動する。Promise は、プロセスの起動を待たずに解決する。
- ファイルのツリーは、`node_modules` の下を、パッケージのディレクトリ（`node_modules/<名前>` と `node_modules/@scope/<名前>`）までにし、その中身を出さない。中身まで出すと、項目が数千になるためである。この規則は、`node-runtime/` の直下が、ツリーの store を組むときに持つ。
- ファイルのツリーは、シンボリックリンクをファイルとして出す。リンクの先を開けるかは、一覧の時点で分けられないためである。
- ファイルとディレクトリを消す前に、`ConfirmDialog` で確認する。
- エディタは、開いたファイルをタブで並べる。入力のたびに、実行環境のファイルに書き込む。コマンドがファイルを書き換えたときは、`files.changes` の通知を受けて、エディタの中身を置き換える。自分が書き込んでいる間の通知では、置き換えない。
- エディタの言語は、拡張子で決める。`.js`、`.mjs`、`.cjs`、`.jsx`、`.ts`、`.mts`、`.cts`、`.tsx` は JavaScript と TypeScript、`.json` は JSON にする。ほかの拡張子には、色を付けない。
- 端末のエンジンは、xterm.js（`@xterm/xterm` と `@xterm/addon-fit`）にする。色は、`packages/ui` の `toVsCodeTheme` の値を写して渡す。xterm.js は CSS の変数を読まないためである。ライトとダークは、OS の設定で決める。
- 端末は、`processes.list` のプロセスをタブで並べる。終了したプロセスは、タブの文に終了コードを添える。端末の題の右の「新しい端末」のボタンで、シェルを足す。2 つ目からのシェルの名前には、番号を付ける。
- プレビューは、待ち受けたポートをタブで並べる。選んでいないポートの iframe も `Activity` で隠して残し、タブを切り替えても、ページの状態を消さない。再読み込みのボタンは、選んだポートの iframe を作り直す。
- 実行環境を起動できなかったときは、ファイルのツリーとエディタに初期ファイルを読み取り専用で出す。端末とプレビューのペインには、理由と、対応するブラウザ（デスクトップの Chrome か Edge の最新版）を出す。
- `project` を付けずに開いたときのプロジェクトは、`package.json` と、3000 番で待ち受ける `index.js` の 2 つのファイルを持つ。起動のコマンドは、`node index.js` の 1 つである。

### プロジェクト

1 つの埋め込みが持つ、初期ファイルの一式と設定を、プロジェクトと呼ぶ。  
ADR-0049: [記事の埋め込みの初期ファイルと設定を、`apps/web` のビルドが JSON にし、ツールのページが埋め込みの ID で読む](../../docs/adr/0049-playground-projects-from-articles.md)

- 埋め込みの ID は、記事の `contentId` と、記事の中の埋め込みの名前の組である（`<contentId>/<埋め込みの名前>`）。
- 運営者は、プロジェクトを、記事のディレクトリの下に置く（`apps/web/src/content/articles/<記事>/playground/<埋め込みの名前>/`）。設定は、同じディレクトリの `playground.json` に書く。
- `apps/web` のビルドが、プロジェクトごとに、1 つの JSON を、`https://fukuemon.dev/playground-projects/<埋め込みの ID>.json` に出力する。`fukuemon.dev` は、`/playground-projects/*` に、`play.fukuemon.dev` を許す `Access-Control-Allow-Origin` を返す。
- ツールのページは、埋め込みの ID から JSON の URL を組み立てて、`fetch` する。
  - `fukuemon.dev` の origin は、`apps/playground` のビルドのときの環境変数で渡す。`project/` と、キャンバスの `figures/` が、同じ環境変数を読む。
- JSON を読めないときと、埋め込みの ID に当たるプロジェクトが無いときは、ツールのページに、エラーと、`https://fukuemon.dev/playground` へのリンクを出す。デフォルトのプロジェクトは開かない。
- デフォルトのプロジェクトは、`apps/playground` が、ツールごとに 1 つ持つ。置き場は、`project/` である。
- JSON と `playground.json` の型と schema は、`@fukuemon/playground-project` が持つ。`apps/web` のビルドは、この schema で `playground.json` を検証する。`project/` は、読んだ JSON を、同じ schema で検証する。schema に合わないときは、JSON を読めないときと同じ表示にする。
- schema は、`files` のキーのうち、`/` で区切った部分に空、`.`、`..`、`__proto__` があるものと、`\` か NUL を含むものを拒否する。
  作業ディレクトリの外と、オブジェクトの prototype を指すキーを、実行環境とエディタに渡さないためである。
- 埋め込みの ID が `<英小文字、数字、ハイフン>/<英小文字、数字、ハイフン>` の形式に合わないときと、JSON の `tool` が開いたページのツールと違うときも、JSON を読めないときと同じ表示にする。
  - 形式に合わない ID では、JSON を取得せず、エラーの文に ID を出さない。URL を作った人の任意の文を、ページに出さないためである。

JSON は、次の値を持つ。

| キー         | 中身                                                | 使うツール    |
| ------------ | --------------------------------------------------- | ------------- |
| `tool`       | ツールの種類。`node`、`sql`、`go` のどれか          | 全て          |
| `version`    | 初期ファイルの中身から求めたハッシュ                | 全て          |
| `files`      | ファイルのパスと中身                                | 全て          |
| `open`       | 最初に開くファイルのパス                            | 全て          |
| `start`      | 起動のコマンドの一覧                                | `node`        |
| `database`   | `true` のときに、実行環境が DB のプロセスを起動する | `node`        |
| `initialSql` | 初期データの SQL                                    | `node`、`sql` |

- `start` は、`{ command, args, name }` の配列である。`src/node/` が、1 つの要素を、1 回の `processes.start(command, args, { name })` に渡す。コマンドの文字列を、引数に分ける処理は持たない。

### 保存

訪問者のファイルは、`play.fukuemon.dev` の IndexedDB に保存する。  
ADR-0050: [訪問者のファイルを、埋め込みの ID ごとに、IndexedDB に保存する](../../docs/adr/0050-save-visitor-files-in-indexeddb.md)  
ADR-0070: [Node の実行環境は、シークレットのファイル、ビルドの出力、`.git`、リンクを保存せず、保存に上限を付ける](../../docs/adr/0070-node-save-targets.md)

- キーは、ツールの名前と、埋め込みの ID の組である。デフォルトのプロジェクトは、固定のキーを使う。
- SQL だけを動かすツールは、入力欄の SQL を保存する。Go を動かすツールは、ファイルを保存する。
- SQL だけを動かすツールのレコードは、入力欄の SQL、保存した時刻、初期ファイルのバージョンを持つ。入力欄の SQL を変えると、レコードを丸ごと置き換える。
- `workspace/` の `createSaver` は、保存の途中に来たレコードのうち、最新の 1 件だけを、保存が終わった後に書く。Node の実行環境と SQL だけを動かすツールは、`createSaver` で保存する。
- `workspace/` は、保存してあるレコードを消す `clear` を持つ。`createSaver` の `clear` は、待っている保存を捨て、書いている途中の保存が終わってから消す。消す前に待っていた保存が、消した後にレコードを書き戻さないようにするためである。
- IndexedDB から読んだ値がレコードの形に合わないときは、保存したファイルが無いときと同じに扱う。Node の実行環境では、次のレコードも形に合わないとみなす。
  - パスが、プロジェクトの JSON の `files` のキーと同じ規則（`isSafeFilePath`）に合わないもの。
  - あるファイルのパスが、別のファイルのパスの途中のディレクトリになっているもの（`a` と `a/b`）。
- Go を動かすツールのレコードは、ファイルのパスと中身、訪問者が作ったディレクトリ、保存した時刻、初期ファイルのバージョンを持つ。ファイルを変えると、レコードを丸ごと置き換える。保存の途中に来た変更は、最新の 1 件だけを後で書く。

Node の実行環境は、次のとおり保存する。

- レコードは、ファイルのパスと中身の一覧、保存した時刻、初期ファイルのバージョンを持つ。DB を使うプロジェクトでは、SQL のペインの入力欄の SQL も持つ。
- `src/node/` が、`files.changes` の通知を受けて、`files.readAll` の結果を `workspace/` に渡す。
- `src/node/` は、`files.readAll` の結果と、SQL のペインの入力欄の SQL を合わせて、1 つのレコードとして `workspace/` に渡す。`workspace/` は、保存してあるレコードを、受け取ったレコードで丸ごと置き換える。
- `src/node/` は、`files.changes` の通知を受けたときだけ保存する。`files.changes` は、シェルのコマンドが作ったファイルとディレクトリ、追記、名前の変更、削除も通知するためである。
- `src/node/` は、通知を受けてから 500 ms 待って `files.readAll` を呼ぶ。
  - 待つ間に来た通知は 1 回の保存にまとめ、500 ms を待ち直す。通知が続くときも、最初の通知から 2 秒のうちに読む。
  - 結果を使う `files.readAll` は、同時に 1 回だけ呼ぶ。読んでいる途中に次の読む時刻が来たときは、読み終えてから 1 回だけ読み直す。
  - 5 秒の上限で諦めた `files.readAll` は止めずに、結果を捨てる。その間に次の `files.readAll` を呼ぶので、実行環境の応答が遅いと、読み込みが重なる。
  - 保存のための `files.readAll` にも、起動し直すときと同じ 5 秒の上限を付ける。上限までに終わらないときは、その回の保存をやめ、次の通知を待つ。
  - 保存しないパスだけの通知と、前に保存したものと同じ中身では、保存しない。
- 訪問者が操作する前の変更は保存しない。操作は、エディタの入力、ファイルのツリーの操作、端末への入力、実行のボタンである。保存したファイルがあるときは、開いたときから保存する。
  - 自動の `npm install` は、訪問者が何もしなくても `package-lock.json` を書く。これを保存すると、何も変えていない訪問者も、次に開いたときに保存したファイルがある扱いになり、起動のコマンドが自動で動かなくなるためである。
  - `src/node/` は、画面に渡す `NodeRuntime` の、ファイルの操作とプロセスの入力の関数を包む。これらの関数が呼ばれたら、訪問者が操作したとみなす。操作したかは実行環境ごとに持ち、起動し直すときは引き継ぎ、初期の状態に戻すときは引き継がない。
- `src/node/` は、起動し直すときに作業ディレクトリのファイルを読む。訪問者が操作した後なら、読んだファイルを保存してから起動し直す。
- 保存が失敗したときは、次の変更で、前と同じ中身でも書き直す。
- 保存しないファイルの規則は、`src/node/` の 1 か所に置く。変更の通知の絞り込みと、`files.readAll` の結果の絞り込みは、同じ規則を使う。
  - どの階層でも、`node_modules`、`.git`、`dist`、`.next`、`.nuxt`、`.cache`、`.turbo` という名前のディレクトリの下のファイルと、これらの名前のファイルは保存しない。保存のための `files.readAll` の `exclude` に渡し、読まない。`build` と `out` は、ソースのディレクトリにも使う名前なので入れない。
  - どの階層でも、`.env`、`.env.` で始まる名前、`.envrc`、`.npmrc`、`.netrc`、`.yarnrc`、`.yarnrc.yml`、`.git-credentials` のファイルは保存しない。シークレットを置くことが多いファイルである。同じ origin のほかのツールのページが、IndexedDB を読めるためである。
  - ファイルでもディレクトリでもないもの（`kind` が `other`、シンボリックリンク）は保存しない。作業ディレクトリの外のファイルの中身を保存しないためである。
  - 1 つのファイルが 1 MB を超えるものと、テキストとして読めないもの（`text` が `null` のもの）は、保存しない。
  - ページを開いたときは、IndexedDB から読んだレコードから、保存しないファイルを除いてから起動する。
    - 除いたファイルがあれば、作業ディレクトリが保存の上限を超えていても、除いた後のレコードを書き直す。
    - 書き直しが失敗したときは、除いた後のレコードをメモリに持ち、次に保存のために作業ディレクトリを読んだときに書く。上限を超えていなければ、読んだファイルのレコードを書く。上限を超えていれば、除いた後のレコードを書く。持っているレコードは、保存が成功したときと、初期の状態に戻したときに捨てる。
    - 保存しないファイルの規則を入れる前に保存したレコードに、シークレットのファイルを残さないためである。
- 保存しないディレクトリの外のファイルが 1000 個を超えるか、合計が 10 MB を超えたら、保存しない。前に保存したレコードは残す。
  - 保存のための `files.readAll` に `limit` を渡し、超えた時点で読むのをやめる。起動し直すときに読んだ結果も、同じ上限で数える。
  - テキストとして読めないファイルとリンクも数える。読む時間を抑えるための上限なので、読めたものを全て数える。一覧を読んだ後に消えたファイルと、指す先の無いシンボリックリンクは数えない。
  - 超えている間は、「保存の上限を超えたため、保存していません」の案内を出す。案内の本文には、ページを閉じたときに、前に保存したファイルに戻るか、変えたファイルが消えるかを書く。
  - 超えている間は、「ファイルを保存できませんでした」の案内を出さない。上限の案内は、上限を下回って読めたときと、初期の状態に戻したときに消す。
  - 値の根拠は、ADR-0070 の Verification にある。
- 保存したファイルがあるときは、ページのヘッダに「初期の状態に戻す」の操作を出す。保存したバージョンと、プロジェクトの JSON のバージョンが違うときは、保存したファイルを開き、初期ファイルが変わったことの案内も出す。
  - 埋め込みの ID が無いページで開くデフォルトのプロジェクトでは、初期ファイルが変わったことの案内を出さない。デフォルトのプロジェクトの初期ファイルは、記事の初期ファイルではないためである。
- 「初期の状態に戻す」は、`ConfirmDialog` で確認してから、保存したファイルを消し、初期ファイルで実行環境を起動し直す。初めて開いたときと同じく、`npm install` と起動のコマンドを自動で実行する。保存したファイルを消せないときは、起動し直さずに、戻せなかったことを出す。
- `workspace/` は、読み込みの結果を、保存したファイルが無い、保存したファイルがある、IndexedDB を読めない、の 3 つの種類で返す。IndexedDB を読めないときは、`src/node/` のモジュールが、保存したファイルが無いときと同じに扱って、初期ファイルで起動する。`NodePage` は、保存できないことを画面に出す。
- `workspace/` は、IndexedDB を読めなかったことを、ページを開いている間だけ持ち、その間は IndexedDB に書き込まない。SQL だけを動かすツールと、Go を動かすツールでも、`workspace/` は同じように書き込まない。
- 実行環境が追加するファイルは、作業ディレクトリの外にあるので、保存の対象に入らない。
  - ADR-0052: [実行環境が追加するファイルを、訪問者の作業ディレクトリの外に置き、preload を `NODE_OPTIONS` で渡す](../../docs/adr/0052-runtime-files-outside-workdir.md)

### 起動から実行まで

次の図は、Node の実行環境のページを開いてから、サーバーが動くまでの流れを示す。  
ADR-0051: [Node の実行環境は、ページを開いたときに起動し、シェルを制限なしで使わせ、訪問者が変えたコードは操作の後に動かす](../../docs/adr/0051-node-runtime-boot-and-commands.md)

```mermaid
sequenceDiagram
  participant V as 訪問者
  participant P as NodePage
  participant W as fukuemon.dev
  participant S as workspace（IndexedDB）
  participant R as node-runtime

  V->>P: ページを開く
  par
    P->>W: プロジェクトの JSON を fetch する
    W-->>P: 初期ファイルと設定
  and
    P->>S: 保存したファイルを読む
    S-->>P: 保存したファイル、無し、または読めない
  end
  opt IndexedDB を読めない
    P-->>V: 保存できないことを表示する
  end
  alt JSON を読めない、埋め込みの ID に当たるプロジェクトが無い
    P-->>V: エラーと、一覧へのリンクを表示する
  else 読めた
    P->>R: bootNodeRuntime（ファイル、DB を使うか、初期データの SQL）
    alt 起動が失敗する、30 秒で終わらない、crossOriginIsolated が false
      R-->>P: 失敗
      P-->>V: 初期ファイルを読み取り専用で出し、理由を表示する
    else 起動する
      R-->>P: NodeRuntime
      P->>R: npm install を実行する
      alt npm install が失敗する
        R-->>V: 端末に npm install の出力を出す。起動のコマンドは実行しない
      else 成功する
        alt 保存したファイルが無い、または IndexedDB を読めない
          P->>R: 起動のコマンドを実行する
          R-->>V: 端末の出力、プレビュー、HTTP の記録
        else 保存したファイルがある
          P-->>V: 実行のボタンを出す
          V->>P: 実行のボタンを押す
          P->>R: 起動のコマンドを実行する
          R-->>V: 端末の出力、プレビュー、HTTP の記録
        end
      end
    end
  end
```

- 図の `NodePage` の手順のうち、`bootNodeRuntime` の呼び出し、`npm install`、起動のコマンドの実行は、起動の Promise を持つ `src/node/` のモジュールが進める。React のコンポーネントは、Effect の中でプロセスを起動しない。
- `bootNodeRuntime` は、DB を使うプロジェクトのときに、DB のプロセスの依存を入れ、DB のプロセスを起動し、初期データの SQL を実行してから、Promise を解決する。30 秒は、`bootNodeRuntime` を呼んでから、Promise が解決するまでの時間で判定する。
- 30 秒で終わらないときは、`bootNodeRuntime` が、作りかけのインスタンスを破棄してから、Promise を失敗させる。
- 起動が失敗したときは、端末とプレビューのペインに、動かせない理由と、対応するブラウザを出す。
- `npm install` が 0 でない終了コードで終了したときは、起動のコマンドを実行しない。端末に、`npm install` の出力が残る。
- 起動のコマンドが複数あるときは、`start` の順に起動する。前のコマンドの終了を待たない。
- 保存したバージョンと、プロジェクトの JSON のバージョンが違うときも、保存したファイルで起動し、保存したファイルがあるときと同じに扱う。
- プレビューの iframe が 30 秒で読み込まれないときは、`PreviewPane` が、プレビューのペインにだけ、動かせない理由を出す。
  - WebContainers のプレビューの iframe は、サーバーが応答しないときも `load` を起こす。この上限が働くのは、プレビューのページそのものが読み込まれないときだけである。応答しないサーバーの判定は、プレビューに入れるスクリプトを足すときに、スクリプトが送るメッセージで行う形に替える。
- 訪問者は、端末で、WebContainers のシェルを制限なしで使う。
- 「実行環境を起動し直す」の操作は、いつでも使える。起動し直した後は、保存したファイルがあるときと同じに扱う。`npm install` だけを自動で実行し、起動のコマンドは、訪問者が実行のボタンを押してから実行する。
- 実行のボタンは、起動と `npm install` の終了を待ってから、起動のコマンドを実行する。前に実行した起動のコマンドが動いていれば、止めてから実行する。止めるときは、ポートが空くよう、プロセスの終了を 2 秒まで待つ。
- `src/node/` は、自動で実行する起動のコマンドと、実行のボタンで実行する起動のコマンドを、1 つのキューに並べて順に実行する。`npm install` の途中に押しても、動いている起動のコマンドは 1 組である。
- 起動のコマンドを起動できないときは、ペインの上に、実行できなかったことと、起動し直す操作を出す。
- 実行のボタンと、「起動し直す」と「初期の状態に戻す」のボタンは、Go を動かすツールと同じく、ページのヘッダに並べる。ボタンの大きさと並びは Go と違い、XS のボタンを右に寄せ、実行のボタンを右端に固定する。ヘッダが折り返したときも右に寄せる。「初期の状態に戻す」は、保存したファイルがあるときに左に出す。「初期の状態に戻す」が出たときに、ほかのボタンの位置がずれないようにするためである。起動し直している間は、ボタンを押せず、「起動し直す」に待ちの印を出す。
- ボタンは、`Button` の `size="XS"`（28px）にする。埋め込みのときは、ヘッダに見出しを出さず、ボタンだけを出す。
  - ADR-0062: [コードを動かす画面だけ、文字を 12px と 13px まで、押せる領域を 24×24 CSS px まで小さくする](../../docs/adr/0062-dense-text-and-targets-in-playground.md)
- DB のプロセスが終了したとき以外で、起動の後に実行環境が動かなくなったときは、訪問者が、「実行環境を起動し直す」の操作で起動し直す。画面は、実行環境の全体の状態を表示しない。

### 実行環境が追加するファイルとプロセス

- 実行環境は、preload、DB のプロセスのスクリプトと依存、待ち受けたポートの URL を書くファイルを、`/tmp` の下の、実行環境のディレクトリに置く。
- ファイルを置く処理と、環境変数の組み立ては、`webcontainer/` が持つ。
- `webcontainer/` は、`start` で起動するプロセスと、シェルの環境変数に、次の値を渡す。実行環境が自分で起動するプロセス（`internal` が `true`）には、preload を追加しない。
  - `NODE_OPTIONS`: preload ごとの `--require <絶対パス>`。HTTP の流れとコンソールを記録する preload は、どのプロジェクトでも追加する。Unix ドメインソケットに接続している間はプロセスを終了させない preload は、DB を使うプロジェクトのときだけ追加する。
  - `PLAYGROUND_PORTS_FILE`: 待ち受けたポートの URL を書くファイルのパス。
  - DB を使うプロジェクトのときは、`PGHOST`、`PGUSER`、`PGDATABASE`、`DATABASE_URL`。
- 待ち受けたポートの URL を書くファイルは、`/tmp/fukuemon-playground/ports.json` である。中身は、ポートの番号をキー、URL を値にした 1 行の JSON（`{"3000":"https://..."}`）で、ポートが開くか閉じるたびに書き直す。ポートが 1 つも無いときは `{}` である。
  - `webcontainer/` は、このファイルを、実行環境の中の Node で書く。書く中身を環境変数で渡すので、中身を 1 行にする。WebContainers は、改行を含む環境変数の値を、最初の行で切る。
- `public/_headers` は、Cloudflare でだけ働く。`apps/playground` の `vite.config` は、`vp dev` と `vp preview` でも、`/node/` に同じ isolation のヘッダを返す。

### SQL

SQL の画面（`sql-console/`）は、SQL を実行する関数を props で受ける。  
この関数に SQL を渡し、結果を表示する。  
SQL を実行する関数は、`SqlDatabase` の `run` を呼ぶ。  
`SqlDatabase` の実装は 2 つである。

- SQL だけを動かすツール: Web Worker で動かす PGlite（`@fukuemon/sql-runtime`）。ツールのページのメインスレッドでは、SQL を実行しない。
- DB を使うプロジェクトの Node の実行環境: DB のプロセスの標準入出力（`node-runtime/`）。

```ts
type SqlDatabase = {
  status: Store<DatabaseStatus>;
  run: (sql: string) => Promise<SqlResponse>;
};

type DatabaseStatus = { kind: "ready" } | { kind: "stopped"; reason: string };

type SqlResponse =
  | { results: readonly SqlResult[]; ms: number }
  | { error: { message: string; code?: string; position?: number }; ms: number };

type SqlResult = {
  fields: readonly string[];
  rows: readonly (readonly unknown[])[];
  affectedRows: number;
  totalRows: number;
  truncated: boolean;
};
```

- 複数の文を 1 回で渡したときは、`results` に、文ごとの結果が入る。SQL の画面は、最後の文の結果を表示する。
  - Web Worker で動かす実装は、最後の文のほかの結果の `rows` を空にしてから送る。`fields`、`affectedRows`、`totalRows` は残す。
- 1 つの文が失敗したときは、全部を取り消す。SQL の画面は、エラーと、全部を取り消したことを表示する。
  - 失敗したときは、`ROLLBACK` を流す。SQL の中の `BEGIN` で始めたトランザクションが失敗したまま残ると、次の SQL が全て失敗するためである。
  - 前の実行で `BEGIN` を流し、開いたままのトランザクションも、この `ROLLBACK` で取り消す。`ROLLBACK` も失敗したときは、元のエラーを返す。
  - SQL の画面が、全部を取り消したことを表示するのは、`error` が `code`（SQLSTATE）を持つときだけである。`code` を持たない `error`（PGlite の読み込みの失敗、Web Worker の異常終了）では、取り消した文は無いので、メッセージだけを出す。
- 1 つの結果が 100,000 行を超えるときは、`rows` に先頭の 100,000 行を入れ、`totalRows` に全体の行の数を、`truncated` に `true` を入れる。SQL の画面は、切ったことと、全体の行の数を表示する。
- SQL の画面は、結果をページ送りで表示する。1 ページの行の数は、訪問者が 10、50、100、500 から選ぶ。デフォルトは 100 である。
- 結果の列が `QUERY PLAN` の 1 つだけのときは、実行計画として表示する。
  - 1 行で JSON の値のときは、`FORMAT JSON` の出力として、ノードのツリー（`TreeView`）と、`Planning Time` と `Execution Time` を出す。
  - それ以外は、行をつないだテキストで出す。
  - SQL の画面は、訪問者が書いた文を書き換えて実行し直さない。`EXPLAIN ANALYZE` は文を実際に実行するので、書き換えて 2 回実行すると、`INSERT` のような文も 2 回実行されるためである。
  - 実行計画のツリーは、使うのが `sql-console/` だけなので、`packages/ui` に置かず `sql-console/` に置く。
- 結果のセルは、`NULL` を `NULL` と出し、空の文字列と見分けられるようにする。日時は ISO 8601、`bytea` は `\x` で始まる 16 進数、JSON とそのほかのオブジェクトは JSON の文字列で出す。
- SQL だけを動かすツールの DB の中身は、保存しない。ページを開き直すと、初期データの SQL を実行した状態に戻る。
- `run` は、SQL の失敗でも、DB が止まっているときでも、Promise を失敗させず、`error` を持つ値を返す。
- SQL の実行、100,000 行で切る処理、`SqlResponse` を組み立てる処理は、`@fukuemon/sql-runtime` の 1 つの関数が持つ。関数は、PGlite のインスタンスと SQL を受け取る。2 つの実装は、同じ関数を呼ぶ。
  - `guest/` の DB のプロセスのスクリプトは、この関数を import し、ビルドで 1 つのファイルに束ねる。PGlite と `pglite-socket` は束ねず、実行環境の中で `npm install` する。
  - 束ねる処理は、`@fukuemon/node-runtime` が export する Vite の plugin が持つ。`apps/playground` の `vite.config` は、plugin を登録するだけである。束ねた結果は、コミットしない。
  - plugin は、ブラウザのコードと別のエントリーポイントから export する。`webcontainer/` は、plugin が束ねた結果を、文字列として import する。
  - `@fukuemon/node-runtime` は、npm に公開しない。plugin を使うのは、このリポジトリの中だけである。
  - 束ねられないときは、関数を `guest/` にコピーし、同じテストの入力で、2 つの実装をテストする。束ねられるかは、実装のタスクで確認する。

DB のプロセスの標準入出力では、次の形式で送る。

- リクエスト: 1 行の JSON（`{"id": "<連番>", "sql": "<SQL>"}`）。
- レスポンス: 行頭にプレフィックスを付けた、1 行の JSON。`id` と、`SqlResponse` の値を持つ。
- `node-runtime/` は、`id` でリクエストとレスポンスを対応づける。プレフィックスの無い行（DB のプロセスのログと、入力のエコー）は捨てる。
- DB のプロセスが終了したときは、`node-runtime/` が、`database` の `status` を `stopped` にし、待っているリクエストに、`error` を持つ値を返す。その後の `run` も、同じ値を返す。
- `status` が `stopped` のときは、SQL のペインにだけ、DB が止まったことをエラーとして出す。エラーの隣に、「実行環境を起動し直す」の操作を出す。端末と、Node のコードのプロセスは、動かし続ける。
- SQL だけを動かすツールでは、Web Worker が異常終了したときに、`@fukuemon/sql-runtime` が、`status` を `stopped` にし、待っているリクエストに、`error` を持つ値を返す。SQL の画面は、エラーを出す。次に `run` を呼んだときに、Web Worker を作り直し、`status` を `ready` に戻す。DB の中身は、初期の状態に戻る。
- Web Worker で動かす実装は、`SqlDatabase` に加えて、読み込みの段階の store（`idle`、`loading`、`seeding`、`ready`、`failed`）と、読み込みを始める関数を持つ。Web Worker は、最初に読み込みを始める関数か `run` を呼んだときに作る。
- PGlite を読み込めないとき、初期データの SQL が失敗したとき、Web Worker を作れないときは、`run` が `error` を持つ値を返し、Web Worker を終了する。次の `run` で、Web Worker を作り直す。
  - 初期データの SQL が失敗したときのメッセージは、`初期データの SQL が失敗しました: ` で始める。
- Web Worker を終了し、待っている `run` に `error` を返す処理は、`@fukuemon/sql-runtime` の中の 1 つの関数に置く。

### Go

Go を動かすツールは、Yaegi のインタプリタの WASM で、訪問者の Go のコードを動かす。  
ADR-0037: [Go のコードを、Yaegi のインタプリタの WASM で動かす](../../docs/adr/0037-go-with-yaegi.md)

ファイルの形と、実行する範囲は、次のとおり。

- ファイルは、ディレクトリに分けて持つ。訪問者が作った空のディレクトリも、一覧に出して保存する。
- ルートのディレクトリの import のパスは、ルートの `go.mod` の `module` の行から読む。`go.mod` が無いときと、`module` の行が無いときは、`play` にする。
  - ディレクトリの package は、`<モジュールの名前>/<ディレクトリ>` で import する。ローカルの Go と同じ書き方にして、訪問者がファイルをコピーすれば `go run` で動くようにするためである。
- 実行のボタンは、ルートのディレクトリの直下にある `main` の package を動かす。テストのボタンは、テストのファイル（`_test.go`）を持つ全ての package のテストを、package の名前の順に動かす。
- テストは、package ごとに、Web Worker と WASM のインスタンスを作り直して動かす。`testing.Main` が `os.Exit` で終わるためである。package ごとに、`go test` と同じ `ok` か `FAIL` の行を、出力に足す。
- 終了コードは、正常に終わると 0、コンパイルのエラーとテストの失敗は 1、panic は 2、`os.Exit` を呼んだときは渡した値である。テストは、どれかの package が失敗すると 1 にする。

`GoRunner`（`@fukuemon/go-runtime`）の形は、次のとおり。

```ts
type GoRunner = {
  phase: Store<LoadPhase>;
  load: () => Promise<void>;
  run: (files: GoFiles, onOutput: (chunk: string) => void) => GoExecution;
  test: (files: GoFiles, onOutput: (chunk: string) => void) => GoExecution;
};

type GoExecution = { done: Promise<GoExit>; stop: () => void };

type GoExit =
  | { kind: "exited"; exitCode: number }
  | { kind: "stopped" }
  | { kind: "failed"; message: string };
```

- `load` は、Yaegi の WASM を取得して、ページのメインスレッドで 1 度だけコンパイルする。実行のたびに、コンパイルした `WebAssembly.Module` を、新しい Web Worker に渡す。
- `stop` は、Web Worker を終了させる。無限ループでも止まり、次の実行は新しい Web Worker で動く。
- Yaegi に渡す symbol は、`stdlib.Symbols` だけである。Yaegi がソースを読むファイルシステムには、訪問者のファイルだけを、`src/<モジュールの名前>/` に置く。
  - ADR-0063: [AI のエージェントからの操作を、SQL だけを動かすツールと Go を動かすツールにも公開し、PGlite と Yaegi を操作が呼ばれたときにも読み込む](../../docs/adr/0063-ai-operations-for-sql-and-go.md)
- Web Worker は、Yaegi を起動する前に、Web Worker の `fetch` を、同じ origin へのリクエストだけを通すものに差し替える。
  - ADR-0064: [Yaegi で動かす Go のコードの HTTP のリクエストは、Web Worker と同じ origin へのものだけを通す](../../docs/adr/0064-go-net-http-same-origin-only.md)
- Yaegi の標準出力と標準エラーは、1 つの出力として、出た順に `onOutput` に渡す。エラーの中のファイルのパスは、ツールのルートからのパスにする。

WASM のビルドと配信は、次のとおり。

- `@fukuemon/go-runtime` の `build` の script が、`go/` のコードを `GOOS=js GOARCH=wasm` でビルドする。WASM はコミットしない。`apps/playground` の `dev` と `build` は、先にこの script を動かす。
- WASM は、2 つのファイルに分けて配る。WASM の全体が、Cloudflare Workers の静的アセットの 1 ファイルの上限（25 MiB）を超えるためである。ブラウザは、2 つを順につないで、取得しながらコンパイルする。
- Go の `lib/wasm/wasm_exec.js` は、`go-runtime/src/worker/vendor/` にコミットする。ビルドの script は、mise で入れた Go のものと中身を比べ、違うときは失敗する。

ページは、次のとおり組む。

- `src/go/` の React の外のモジュールが、埋め込みの ID ごとに 1 つ、次のものを持つ。
  - ファイルとディレクトリの一式の store、実行中かどうかの store、出力の store。
  - ファイルの一覧、読み込み、書き込み、ディレクトリの作成、名前の変更、削除の関数。
  - 実行とテストの関数。時間の上限を受け取り、実行を始めたときのファイルのコピーを `GoRunner` に渡す。実行中に呼んだときは、実行せずに、実行中であることを返す。
- 出力の store は、1,000,000 文字を上限にし、上限に達した後の出力を捨てる。
- 画面は、左にファイルの一覧（`FileTree`）、右上にエディタ（`EditorFrame`）、右下に出力（`TerminalFrame`）を置く。`SplitPane` で、幅と高さを変えられる。ヘッダに、実行のボタン、テストのボタン、停止のボタンを置く。
- エディタのファイルごとの `EditorState` は、ページが持つ。タブを切り替えても、元に戻す履歴とカーソルの位置を残すためである。
- 出力は、`--- PASS` と `ok` の行、`--- FAIL` と `FAIL` の行、コンパイルのエラーと panic の行を、色で分ける。
- 出力の欄の下に、Yaegi で動かしていることと、`iter` と一部のジェネリックな関数を使えないことを、常に出す。
- 実行のボタンを押してから終わるまで、待っている段階を `Loading` で出す。段階は、Yaegi の読み込み、実行、テストの実行の 3 つである。
- ファイルとディレクトリを消すときは、`ConfirmDialog` で確認する。

## Interface

### 置くファイル

- `apps/playground/`: アプリのコード。Worker の設定と、レスポンスヘッダ（`/node/*` の cross-origin isolation のヘッダ、`/` のリダイレクト）を持つ。
- `apps/web/src/content/articles/<記事>/playground/<埋め込みの名前>/`: 運営者が書くプロジェクト。`playground.json` と、初期ファイルを置く。
- `packages/playground-project/`: プロジェクトの JSON と、`playground.json` の型と schema。
- `packages/sql-runtime/`、`packages/node-runtime/`、`packages/go-runtime/`: 実行環境ごとの処理。

### 読む値

- URL のクエリの `project`: 埋め込みの ID。
- IndexedDB: 訪問者のファイルと、SQL の入力欄の値。キーは、ツールの名前と、埋め込みの ID の組。

### 動くチェック

- Oxlint の `no-restricted-imports`: 次の 3 つの import を止める。
  - `packages/node-runtime/src/webcontainer/` のほかからの、`@webcontainer/api` の import
  - `apps/playground/src/` の `node/`、`sql/`、`go/`、`drawio/`、`excalidraw/`、`slides/` の間の import
  - `apps/playground/src/ai-operations/` からの、ツールのディレクトリの import
- package の依存の宣言と knip: 次の 3 つを確認する。
  - `apps/playground` が、`@webcontainer/api` を import しないこと
  - 実行環境の 3 つの package が、React、`@fukuemon/ui`、`@fukuemon/playground-project` に依存しないこと
  - `@fukuemon/node-runtime` が、workspace の package では、`@fukuemon/sql-runtime` だけに依存すること
- `apps/web` のビルド: `@fukuemon/playground-project` の schema で `playground.json` を検証する。`tool` が `node` のプロジェクトを埋め込む記事の URL を、`_headers` に書く。
