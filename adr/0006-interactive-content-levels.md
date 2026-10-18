# ADR-0006: 手を動かす場所を 4 つに分け、cross-origin isolation を `/playground/*` に限定する

## Status

承認（Decision 5 の根拠を ADR-0013 に置換）

## Context

- ハンズオンは CLaaT 形式の Codelab で、ブラウザの中でコードを実行させることが価値の中心にある。
  想定する形は、コードの実行、Editor、Terminal、Live Preview と幅がある。
- Google の Codelabs では、Go 製の CLI の `claat`（Codelabs as a Thing）が Markdown や Google Docs から静的な HTML を生成する。
  - 出典: [googlecodelabs/tools](https://github.com/googlecodelabs/tools)
- ブラウザの中で実行する候補を調べた。

| ランタイム                    | version | license                                                         | cross-origin isolation                            |
| ----------------------------- | ------- | --------------------------------------------------------------- | ------------------------------------------------- |
| `@electric-sql/pglite`        | 0.5.7   | Apache-2.0                                                      | **不要**                                          |
| `@sqlite.org/sqlite-wasm`     | 3.53.0  | Apache-2.0                                                      | VFS の実装による（未確認）                        |
| `@duckdb/duckdb-wasm`         | 1.33.1  | MIT                                                             | 単一スレッド版は不要（未確認）                    |
| `pyodide`                     | 314.0.6 | MPL-2.0                                                         | 不要                                              |
| `codemirror`                  | 6.0.2   | MIT                                                             | 不要                                              |
| `@codesandbox/sandpack-react` | 2.20.0  | Apache-2.0                                                      | バンドラだけなら不要（Node のランタイムは未確認） |
| `@webcontainer/api`           | 1.6.4   | MIT（パッケージ）。営利目的の本番の利用には商用ライセンスが要る | **必要**                                          |

- WebContainers は `SharedArrayBuffer` を要求するので、`COOP: same-origin` と `COEP: require-corp` が要る。
  - 出典: [WebContainers: Configuring Headers](https://webcontainers.io/guides/configuring-headers)
- PGlite は、Linux の VM を使わず、Postgres の単一ユーザーモードを WASM にしたもの。
  単一スレッドで単一接続なので、`SharedArrayBuffer` を使わない。
  WebAssembly と IndexedDB があれば動く。
  - 出典: [PGlite](https://pglite.dev/docs/about)
- PGlite の代わりには SQLite WASM と DuckDB WASM が、WebContainers の代わりには Sandpack（Apache-2.0）と CheerpX がある。
- PGlite の配信量を計測した。
  ブラウザがダウンロードするのは 4 ファイルで、合計は gzip で 5.28 MiB、brotli で 3.74 MiB。
  **`pglite.wasm` だけを見ると、4 割少なく見積もってしまう。**

| file          |      raw |     gzip |
| ------------- | -------: | -------: |
| `pglite.wasm` | 10.09 MB | 3.23 MiB |
| `pglite.data` |  6.30 MB | 1.77 MiB |
| `initdb.wasm` |  0.40 MB | 0.14 MiB |
| JS chunk      |  0.60 MB | 0.13 MiB |

- 押してから結果が出るまでの時間を、圧縮なしの静的な配信で計測した。
  - Fast 4G は 23 秒かかった。
  - Slow 4G は 60 秒の上限に当たって失敗した（経過は 74 秒）。
  - 再試行は、キャッシュから 11.5 秒で成功した。
- **初回の待ちが長い。** 押させるまで落とさない方針は正しいが、押した後の段階の表示が欠かせない。
- **`COEP: require-corp` の下では、CORP を返さないクロスオリジンのリソースがブロックされる。** 計測した結果は次のとおり。
  - `fonts.gstatic.com` は `cross-origin-resource-policy: cross-origin` を返し、COEP の下でも読める。
  - CORP を返さない第三者の埋め込みは、**ブロックされる**。
  - ADR-0004: [和文の書体と self-host](0004-typography-static-weights.md)
- ブロックの対象はランタイムに限らず、埋め込みの `iframe`、外部の画像、埋め込みの動画、外部にホストしたスクリプトを含む。
- **isolation は、後から取り消せない方向の制約になる。**
  - サイト全体へ掛けると、第三者のリソースを使いたくなるたびに、そのリソースが CORP を返すかどうかで実現できるかが決まる。
  - 条件つきのバックログにある giscus（GitHub Discussions）がこれに当たる。
    - 出典: [design/DesignDoc.md](../design/DesignDoc.md)
  - giscus が CORP を返すかは未確認。

## Decision

### 1. 手を動かす場所を 4 つに分ける

分ける軸は、**読者がどこで実行するか**にする。  
frontmatter の `interactive.level` が、この 4 つに 1 対 1 で対応する。

| `level`      | 実行するもの                                 | 実行する場所           | cross-origin isolation     |
| ------------ | -------------------------------------------- | ---------------------- | -------------------------- |
| （項目なし） | 実行しない。コードは表示だけ                 | —                      | 不要                       |
| `embedded`   | 単一のランタイムを WASM で本文の中に埋め込む | 本文と同じドキュメント | **不要**                   |
| `sandbox`    | プロジェクト一式、シェル、Live Preview       | `/playground/<id>`     | **必要**                   |
| `local`      | ポートやプロセスを使う一式                   | 読者の端末             | 不要（こちらで実行しない） |

**schema は、実装済みの `level` だけを受け付ける。**  
設計として 4 つに分けることと、受け口を先に開けることは別の判断になる。  
先回りして受け付けると、ビルドを通ったコンテンツが、読者が押したときに初めて失敗する。

**4 つに上下の関係を持たせない。**  
`embedded` は `sandbox` の準備の段階ではなく、それだけで完結する。  
`local` は下位の妥協ではなく、**ブラウザで再現できない題材にとって唯一の選択肢**になる。

`local` を含めるのは、**ブラウザで動くかどうかが題材の側の性質**だからだ。  
ポートを開く、プロセスを分ける、ホストのリソースを測る、といった題材がある。  
これらを WASM で再現しようとすると、確かめている対象そのものが失われる。  
再現できないものを無理に埋め込むより、リポジトリを渡して手元で組んでもらう方が、題材に忠実になる。

### 2. cross-origin isolation をサイト全体に掛けず、`/playground/*` だけに掛ける

**isolation を要求するのは `sandbox` だけで、`sandbox` を置くページはサイトのごく一部にとどまる。**  
制約を掛ける範囲を、その制約を必要とする URL に一致させる。  
サイト全体へ掛けると、`sandbox` を 1 本も持たないページまでが、第三者のリソースが CORP に対応するかどうかに依存する。

- `embedded` は**本文と同じドキュメント**に置く。
  - isolation を要求しないので、MDX の中にコンポーネントとして置ける。
- `sandbox` は `/playground/<id>` という**別のドキュメント**に置き、本文からは `iframe` で埋め込む。
- `/playground/*` のヘッダは、Workers Static Assets の `_headers` でパスごとに指定する。
  - 指定するのは `Cross-Origin-Opener-Policy: same-origin` と `Cross-Origin-Embedder-Policy: require-corp` の 2 つ。
  - ADR-0005: [Workers と Terraform と Wrangler の分担](0005-workers-terraform-wrangler-boundary.md)

**この分離で、本文の描画と、playground を持つかどうかが、独立した判断になる。**  
`embedded` の埋め込みも `sandbox` の iframe も、本文のレイアウトを変えずに実現できる。

### 3. `/api/*` と `/playground/*` を URL に予約する

コンテンツの `path` に、この 2 語を使わない。

### 4. claat を使わず、Codelab を自前で描画する

**必要なのは claat の出力ではなく、Codelab の形式になる。**  
claat は独自の HTML と UI を出力するので、Content Model と Design System の外に出る。  
一覧から参照できず、Design Tokens も適用されない。

- ADR-0001: [Starlight の採否](0001-starlight-as-docs-renderer.md)

自前で描画する Codelab の形式は、ステップの分割、ステップごとの所要時間、1 ステップ 1 画面と前後の移動と進捗バー、完了の状態の永続化の 4 点。  
完了の状態は `localStorage` に保存する。

- ADR-0008: [読者の identity を前提にしない](0008-no-reader-identity.md)

**ステップ数を frontmatter に持たず、本文から導出する。**  
本文とステップ数が食い違う余地をなくすため。

### 5. DB 系のハンズオンは PGlite を既定にする

cross-origin isolation を要求しないことを確かめたのは、PGlite だけになる。  
SQLite WASM の OPFS VFS は、VFS の実装によって分かれる（未確認）。

**想定するコンテンツ「RDBMS のクエリ実行を理解する」は `embedded` に収まり、ヘッダの変更も要らない。**

### 6. WebContainers の採用は保留する

WebContainers は、営利目的の本番の利用に商用ライセンスを要求する。

- 出典: [WebContainers: Enterprise](https://webcontainers.io/enterprise)

個人サイトが該当するかは、公開の形態による。  
**該当するなら Sandpack（Apache-2.0）を採る。**  
`sandbox` を実際に検討する時点で確かめる。

## Considered Options

| 選択肢                                                                                                                                            | 強み                                                                                                                            | 弱み                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **採用:** 手を動かす場所を 4 つに分け、isolation を `/playground/*` だけに掛け、Codelab を自前で描画し、DB 系は PGlite の `embedded` を既定にする | 最初のハンズオンがヘッダを変えずに作れる。第三者の埋め込みと playground が共存できる。ハンズオンが Content Model の内側に留まる | Codelab の UI を自前で作る。`_headers` でパスごとにヘッダを管理する。本文と playground で状態を共有できない                                                                                                                                                                                  |
| cross-origin isolation をサイト全体に掛ける                                                                                                       | ヘッダの管理が単純になる。どのページでも `sandbox` を本文の中に直接置ける。`/playground/*` への iframe の分離が要らない         | CORP を返さない第三者のリソースが、サイト全体で一律にブロックされる（計測で確かめた）。埋め込みを足したくなるたびに、そのリソースが CORP を返すかどうかで実現できるかが決まり、バックログの giscus が最初に当たる。`sandbox` を 1 本も持たない大多数のページが、`sandbox` のための制約を負う |
| claat を採用する                                                                                                                                  | Codelab の UI を作らなくてよい。Google Codelabs と同じ体験になる                                                                | 独自の HTML と UI を出力するので、Content Model と Design System の外に出て、一覧と相互参照から参照できない。出力に Design Tokens が適用されず、サイトの中で最も浮いたページになる。Go 製の CLI をビルドのパイプラインへ足すことになり、Vite+ のタスクグラフの外に出る                       |
| 段階を分けず、最初から WebContainers だけを想定する                                                                                               | 段階が 1 つになり、Content Model の型が単純になる                                                                               | 最初のハンズオン（DB のクエリ実行）は `embedded` で足りるのに、サイト全体へ isolation を掛けるか iframe を用意するかを先に決める必要がある。WebContainers のライセンスの確認が `embedded` の実装を止める。ブラウザで再現できない題材（ポート、プロセス、ホストのリソース）を扱えない         |
| Interactive を一切持たない                                                                                                                        | 実装の量がゼロ。ヘッダの論点もなくなる                                                                                          | ハンズオンの価値の中心は手を動かすことなのに、読者が自分の環境を用意しないと再現できない。成功条件「ハンズオンがブラウザだけで完結する」を満たせない                                                                                                                                         |

## Consequences

### Positive

- 最初に作るハンズオンを、ヘッダを変えずに作れる。
- 第三者のリソースの埋め込みと playground が共存できる。制約を負うのは `/playground/*` だけになる。
- ハンズオンが Content Model の内側に留まり、一覧と相互参照から辿れる。
- `sandbox` を入れるかどうかの判断を、`embedded` の実装から切り離して先送りできる。
- ブラウザで再現できない題材を、実行環境を持たないまま扱える。

### Negative

- Codelab の UI（ステップの導出、前後の移動、進捗バー）を自前で作る必要がある。
- `_headers` でパスごとに管理するヘッダが増える。
  - 誤って全体へ掛けると第三者の埋め込みが一律にブロックされるので、変えるときに注意が要る。
- `sandbox` を本文と別のドキュメントにするので、本文と playground の間で状態を共有できない。
- `local` は読者の端末で動くので、こちらから完了を検知できない。
  - サイドバーに完了のマーカーを出さない。
