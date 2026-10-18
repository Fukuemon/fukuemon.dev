# ADR-0013: DB を使うハンズオンは、Postgres のプランナの出力を見せるために PGlite を既定にする

## Status

承認

## Context

ADR-0006 の Decision 5 は、DB を使うハンズオンの実行環境を PGlite にすると決めた。  
理由は、cross-origin isolation を要求しないと確かめたのが PGlite だけだったことにある。  
ADR-0006: [手を動かす場所を 4 つに分け、cross-origin isolation を `/playground/*` に限定する](0006-interactive-content-levels.md)

SQLite WASM も、VFS を選べば cross-origin isolation を要求しない。  
`"opfs"` VFS は `SharedArrayBuffer` を求めるので、COOP と COEP が要る。  
`opfs-sahpool` VFS は、COOP と COEP を要求しない。  
出典: [SQLite WASM: Persistent Storage Options](https://sqlite.org/wasm/doc/trunk/persistence.md)  
メモリの VFS も要求しない。  
そのため、isolation の要否は PGlite と SQLite を分ける理由にならない。

配信量では SQLite が PGlite に勝る。  
実行環境の取得量は、gzip で SQLite が 0.53 MiB、PGlite が 5.28 MiB である。  
Slow 4G の待ちは、PGlite の 29 秒に対して SQLite は 3 秒台と見積もった。  
この 2 つの秒数の測り方は記録がなく、未確認である。  
lab の Design Doc は、PGlite の初回の起動を Slow 4G で 73 秒と書いており、29 秒は転送だけの見積もりとみられる（推測）。

想定するコンテンツ「RDBMS のクエリ実行を理解する」の主題は、Postgres のプランナの出力そのものである。  
SQLite の `EXPLAIN QUERY PLAN` は、cost の見積もりも `Buffers:` も `Planning Time` も返さない。  
比べた時点のこのコンテンツの 7 手順のうち、4 手順が SQLite では成り立たなかった。

## Decision

DB を使うハンズオンの実行環境は、PGlite を既定にする。  
主題が Postgres のプランナの出力なので、本物の Postgres が返す `EXPLAIN ANALYZE` を読者に見せる必要がある。

PGlite を既定にする結論と、`embedded` に収まりヘッダを変えないことは、ADR-0006 と変わらない。  
この決定は、ADR-0006 の Decision 5 の根拠（isolation が要らないと確かめたのは PGlite だけ）を置き換える。

主題が Postgres に固有でないコンテンツには、この判断を当てはめない。  
汎用の SQL の入門なら、SQLite を採る。

## Considered Options

| 選択肢                                        | 強み                                                                                       | 弱み                                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **採用:** PGlite                              | Postgres の `EXPLAIN ANALYZE` を、cost、`Buffers:`、`Planning Time` を含めてそのまま見せる | 取得量が gzip で 5.28 MiB あり、初回の起動が遅い                                                      |
| SQLite WASM（メモリか `opfs-sahpool` の VFS） | 取得量が gzip で 0.53 MiB で、初回の待ちが短い。isolation も要らない                       | `EXPLAIN QUERY PLAN` がプランナの見積もりと実行の計測を返さず、想定するコンテンツの手順が成り立たない |

## Consequences

### Positive

- 読者は、手元で Postgres を動かしたときと同じプランナの出力を、ブラウザの中で読める。

### Negative

- 読者は、初回の実行で 5 MiB を超える実行環境を待つ。
  - 実行のボタンを押すまで取得しない設計と、待ちの段階の表示が要る。
- 主題が Postgres に固有でないコンテンツを書くときは、実行環境を比べ直す必要がある。
