# ADR-0036: DB の記事は PGlite を単体で動かし、Node から同じ DB を使う記事は、実行環境の中の PGlite を HTTP で使う

## Status

提案

## Context

訪問者が Postgres の SQL を動かす形と、Node のコードから同じ DB を使う形を決める必要がある。

- DB を使う実行環境の選び方は、有効な決定が無い。
  - ADR-0030: [種別を記事の 1 つにし、構成を記事の形式で、シリーズをディレクトリで表す](0030-articles-format-and-series.md)
- Postgres のプランナの出力を見せるために、PGlite を採っていた。PGlite は、cross-origin isolation を求めない。
  - ADR-0013: [DB を使うハンズオンは、Postgres のプランナの出力を見せるために PGlite をデフォルトにする](0013-pglite-for-planner-output.md)
- Node と npm の実行に WebContainers を採る。
  - ADR-0033: [Node と npm の実行に WebContainers を採り、実行環境と画面の間をインターフェースで分ける](0033-webcontainers-for-node.md)
- cross-origin isolation のヘッダは、Node の実行環境のパスと、それを埋め込む記事の URL にだけ返す。訪問者が書いたコードを動かすツールは、サブドメインに置く。
  - ADR-0034: [プレイグラウンドのツールを 1 つのサブドメインに置き、cross-origin isolation のヘッダを Node の実行環境のパスと、それを埋め込む記事の URL にだけ返す](0034-playground-origin-and-embedding.md)
- PGlite は、単一の接続で動く。
  - 出典: [PGlite](https://pglite.dev/docs/about)

## Decision

### 1. SQL だけを動かす記事

SQL だけを動かす記事は、Node の実行環境を使わず、PGlite を単体で動かす。

- PGlite を動かすページは、プレイグラウンドのサブドメインの、isolation のヘッダを返さないパスに置く。
- SQL だけを動かす記事には、isolation のヘッダが掛からない。外部の画像と埋め込みを使える。
- 実行計画は、`EXPLAIN (ANALYZE, BUFFERS)` の文字と、`FORMAT JSON` の構造の両方を使える。

### 2. Node から同じ DB を使う記事

Node のコードから DB を使う記事は、実行環境の中の Node のプロセスが PGlite を持ち、HTTP で SQL を受ける。

- 訪問者のコードは、`fetch` をラップした小さなクライアントで、SQL を送る。
- 訪問者のコードは、`pg` のような Postgres のワイヤプロトコルのクライアントを使わない。WebContainers の中で、`@electric-sql/pglite-socket` への `pg` の接続が失敗したためである。

## Verification

WebContainers 1.6.4 の中の Node で、PGlite 0.5.16 を動かした（Playwright 1.65.0 の Chromium、`localhost`、Apple M2）。

- `@electric-sql/pglite-socket` 0.2.19 が 5432 番で待ち受け、`pg` 8.16.3 で接続する形は、`invalid frontend message type 47` を返し、その後のクエリが返らなかった。同じファイルは、手元の Node 24 では動いた。手元でも、2 つ目の同時の接続は `ECONNRESET` になった。
- Node のプロセスが PGlite を持ち、HTTP で SQL を受ける形は動いた。別のプロセスから同じ DB を使え、2 つのプロセスからの同時のクエリも両方返った。
  - `npm install`（`@electric-sql/pglite`、`pglite-socket`、`pg`、`cookie`）は 5.1 秒、転送量は合計 5.93 MB だった。
  - PGlite の起動と、2 万行の `insert`、インデックスの作成、`analyze` は 1.4 秒だった。
  - SQL を 1 つ実行する時間は、プロセスの起動を含めて 0.44〜0.46 秒だった。
- `EXPLAIN (ANALYZE, BUFFERS)` は、cost、actual time、`Buffers:`、`Planning Time`、`Execution Time` を返した。`FORMAT JSON` は、ノードの種類、行数、ブロックの数を構造で返した。
- ホストのページの PGlite を、実行環境の Node から使う形は、試していない。

## Considered Options

| 選択肢                                                                                     | 強み                                                                                        | 弱み                                                                                                              |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **採用:** SQL だけの記事は PGlite の単体、Node から使う記事は実行環境の中の PGlite と HTTP | SQL だけの記事に、isolation のヘッダと Node の実行環境が要らない。Node から同じ DB を使える | 訪問者のコードが、`pg` と違う書き方になる。Node から使う記事は、PGlite を npm で入れる転送量が増える              |
| `pg` で接続する形が WebContainers の中で動く条件を調べる                                   | 訪問者のコードが、本物のアプリと同じ書き方になる                                            | 調べる時間が要り、動く保証が無い。単一の接続なので、動いても同時の接続を扱えない                                  |
| 最初の公開では、Node から DB を使う記事を出さない                                          | 作るものが減る                                                                              | セッションを DB に保存するような題材を、最初の公開で扱えない                                                      |
| どの DB の記事も、Node の実行環境の中の PGlite で動かす                                    | DB を動かす形が 1 つになる                                                                  | SQL だけの記事にも、isolation のヘッダと WebContainers の読み込みが要る。Firefox とモバイルで動かない見込みがある |

## Consequences

### Positive

- SQL だけを動かす記事は、WebContainers のライセンスとブラウザの対応に依らずに公開できる。
- 訪問者は、手元の Postgres と同じ形の実行計画を読める。

### Negative

- Node から DB を使う記事のコードは、`pg` を使う本物のアプリのコードと違う。記事に、違いの説明が要る。
- DB を動かす形が 2 つになり、初期データを入れる処理を、2 つの形で持つ。
