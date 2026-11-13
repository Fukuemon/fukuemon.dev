# ADR-0038: DB の記事は PGlite を使い、Node のコードからは、実行環境の中の PGlite に Unix ドメインソケットで `pg` から接続する

## Status

提案

## Context

訪問者が Postgres の SQL を動かす形と、Node のコードから同じ DB に接続する形を決める必要がある。  
記事には、`pg` のコードを、手元の Postgres に接続するときと同じ書き方で載せたい。

- DB を使う実行環境の選び方は、有効な決定が無い。
  - ADR-0030: [種別を記事の 1 つにし、構成を記事の形式で、シリーズをディレクトリで表す](0030-articles-format-and-series.md)
- DB の記事の主題は、Postgres のプランナの出力である。PGlite は、Postgres を WASM にしたもので、本物の Postgres と同じ `EXPLAIN ANALYZE` を返す。cross-origin isolation を求めない。
- Node と npm の実行に WebContainers を採る。画面は、実行環境をインターフェースを通して使う。
  - ADR-0033: [Node と npm の実行に WebContainers を採り、実行環境と画面の間をインターフェースで分ける](0033-webcontainers-for-node.md)
- cross-origin isolation のヘッダは、Node の実行環境のパスと、それを埋め込む記事の URL にだけ返す。
  - ADR-0034: [cross-origin isolation のヘッダを、プレイグラウンドの Node の実行環境のパスと、それを埋め込む記事の URL にだけ返す](0034-playground-origin-and-embedding.md)
- PGlite は、単一の接続で動く。`@electric-sql/pglite-socket` は、PGlite を Postgres のワイヤプロトコルで待ち受け、複数の接続のクエリを 1 つずつ PGlite に渡す。
  - 出典: [PGlite](https://pglite.dev/docs/about)
  - 出典: [PGlite Socket](https://pglite.dev/docs/pglite-socket)
- `pg` は、環境変数 `PGHOST`、`PGUSER`、`PGDATABASE` を読む。`PGHOST` が `/` で始まるときは、そのディレクトリの Unix ドメインソケットに接続する。
  - 出典: [node-postgres: Connecting](https://node-postgres.com/features/connecting)
- WebContainers の中の TCP のソケットでは、`pg` から `pglite-socket` への接続が失敗する。

## Decision

### 1. SQL だけを動かす記事

SQL だけを動かす記事は、Node の実行環境を使わず、PGlite を単体で動かす。

- PGlite を動かすページは、プレイグラウンドのサブドメインの、isolation のヘッダを返さないパスに置く。
- SQL だけを動かす記事には、isolation のヘッダが適用されない。外部の画像と埋め込みを使える。
- 実行計画は、`EXPLAIN (ANALYZE, BUFFERS)` のテキストと、`FORMAT JSON` の構造の両方を使える。

### 2. Node のコードから DB に接続する記事

Node のコードから DB に接続する記事は、実行環境の中の PGlite に、Unix ドメインソケットで接続する。

- 実行環境が、PGlite と `pglite-socket` を持つ Node のプロセスを起動する。ソケットのパスは `/tmp/.s.PGSQL.5432` にし、`maxConnections` に 2 以上を渡す。
- このプロセスと、そのファイルは、訪問者のファイルのツリーと端末に出さない。
- DB を使うかどうかは、記事の設定で選ぶ。DB を使わない記事では、このプロセスを起動しない。
- 実行環境は、訪問者のプロセスに、次の環境変数を渡す。
  - `PGHOST=/tmp`、`PGUSER=postgres`、`PGDATABASE=postgres`
  - `DATABASE_URL=postgres://postgres@%2Ftmp/postgres`
- 記事のコードは、`new Pool()` のように引数なしで書く形と、`new Pool({ connectionString: process.env.DATABASE_URL })` と書く形の、どちらも使える。
- TCP の `localhost:5432` では待ち受けない。WebContainers の中の TCP のソケットでは、`pg` の接続が失敗するためである。

Unix ドメインソケットを採る理由は、WebContainers と Node に手を加えずに `pg` の接続が通ることと、環境変数で接続先を渡す書き方が、本物のアプリの書き方と同じであることである。

### 3. SQL のツールと Node のコードが使う DB

Node のコードから DB に接続する記事では、SQL のツールと Node のコードが、同じ DB を使う。  
SQL のツールは、ホストのページの PGlite を使わず、実行環境の中の PGlite に SQL を送る。  
訪問者が、SQL のツールで作ったテーブルを、Node のコードから読めるようにするためである。

## 承認の条件

- ホストのページの SQL のツールから、実行環境の中の PGlite へ SQL を送り、結果を受け取れること。送る方法の候補は、プロセスの標準入出力と、Unix ドメインソケットに接続する Node のプロセスの 2 つで、どちらも試していない。

## Verification

WebContainers 1.6.4 の中の Node 24.22.2 で、次のパッケージを動かした。

- PGlite 0.5.16、`@electric-sql/pglite-socket` 0.2.19
- `pg` 8.16.3、postgres.js 3.4.7、`pg-gateway` 0.3.0-beta.4

端末は Apple M2、ブラウザは Playwright 1.65.0 の Chromium、WebKit、Firefox（headless）、配信は `localhost` である。  
実機のブラウザは未確認である。  
クライアントは、接続、`select`、パラメータ付きのクエリ、`EXPLAIN (ANALYZE, BUFFERS)`、`begin` と `rollback` を順に実行した。

| 方式                                                                       | サーバー                     | クライアント                                  | 結果                                         |
| -------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------- | -------------------------------------------- |
| Unix ドメインソケット                                                      | `pglite-socket`              | `pg`（`host: "/tmp"`）                        | 動く。1 つの接続、2 つの同時の接続、`Pool`   |
| Unix ドメインソケット                                                      | `pglite-socket`              | `pg`（引数なし。`PGHOST` などの環境変数）     | 動く                                         |
| Unix ドメインソケット                                                      | `pglite-socket`              | `pg`（`postgres://postgres@%2Ftmp/postgres`） | 動く                                         |
| Unix ドメインソケット                                                      | `pglite-socket`              | postgres.js（`path`）                         | 動く                                         |
| TCP                                                                        | `pglite-socket`              | `pg`                                          | 動かない。`invalid frontend message type 47` |
| TCP                                                                        | `pglite-socket`              | postgres.js                                   | 動かない。25 秒で打ち切り                    |
| TCP                                                                        | 自前のブリッジ、`pg-gateway` | `pg`、postgres.js                             | 動かない。25 秒で打ち切り                    |
| TCP。`net.Socket` の `write` をラップする preload を、両方のプロセスに追加 | `pglite-socket`              | `pg`                                          | 動く。1 つの接続、2 つの同時の接続、`Pool`   |

- Unix ドメインソケットと、preload を追加した TCP の行は、3 つのブラウザで同じ結果だった。preload なしの TCP の行は、Chromium で測った。
- WebContainers の中の TCP のソケットは、大きな `ArrayBuffer` の一部を指す `Buffer` を `write` に渡すと、サーバーに 65536 バイトを届けた。届いたバイト列の途中に、クライアントが書いたバイト列が入っていた。`pg` と `pglite-socket` は、どちらもこの形の `Buffer` を送る。
- `pglite-socket` の `maxConnections` のデフォルトは 1 で、2 つ目の同時の接続は切られる。
- Unix ドメインソケットで、`pg` の 1 回の実行（接続から切断まで）は、28〜54 ミリ秒だった。
- Prisma、Drizzle、Knex のような、`pg` を中で使うライブラリは、試していない。

## Considered Options

| 選択肢                                                                                    | 強み                                                                                                   | 弱み                                                                                                                          |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **採用:** Unix ドメインソケットで待ち受け、環境変数で接続先を渡す                         | WebContainers と Node に手を加えない。記事のコードが、環境変数で接続する本物のアプリと同じ書き方になる | `host: "localhost"` と `port: 5432` を書いたコードは動かない。接続先が Unix ドメインソケットであることを、記事で説明する      |
| TCP で待ち受け、`net.Socket` の `write` をラップする preload を、全てのプロセスに追加する | 記事のコードが、接続先の書き方まで手元と同じになる                                                     | Node の `net` を書き換える。WebContainers の中の動きに依る。HTTP のサーバーと、HTTP の記録の preload への影響を確認していない |
| Unix ドメインソケットと、preload を追加した TCP の両方で待ち受ける                        | どちらの書き方も動く                                                                                   | 2 つの方式を保守する。preload の弱みを、そのまま持つ                                                                          |
| 実行環境の中の PGlite を、HTTP で使う                                                     | 追加の仕組みが少ない                                                                                   | 記事のコードが、`pg` と違う書き方になる                                                                                       |
| SQL のツールと Node のコードが、別の DB を使う                                            | SQL のツールが、どの記事でもホストのページの PGlite で動く。実行環境へ SQL を送る仕組みが要らない      | 訪問者が SQL のツールで作ったテーブルを、Node のコードから読めない                                                            |

## Consequences

### Positive

- 訪問者は、記事の `pg` のコードを、手元のアプリにそのまま持ち出せる。
- 訪問者は、SQL のツールで実行計画を読みながら、同じ DB を Node のコードから使える。
- SQL だけを動かす記事は、WebContainers のライセンスとブラウザの対応に依らずに公開できる。

### Negative

- `localhost:5432` に接続するコードは、実行環境の中で動かない。
- Node のコードから DB に接続する記事は、PGlite と `pglite-socket` を npm で入れる転送量が増える。
- DB を動かす形が 2 つになり、初期データを入れる処理と、SQL のツールが SQL を送る先を、2 つの形で持つ。
- 訪問者に見せないプロセスとファイルが、実行環境の中にある。訪問者が `ps` や `ls /tmp` を実行したときに見えるかは、確認していない。
