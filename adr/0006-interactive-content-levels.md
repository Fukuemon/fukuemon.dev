# ADR-0006: 手を動かす場所を 4 つに分け、cross-origin isolation を `/playground/*` に限定する

## 状態

承認

## 決定日

2026-08-26

## 背景

- ハンズオンは CLaaT 形式の Codelab であり、ブラウザ内でコードを実行させることが価値の中心にある。
  想定される形はコードの実行、Editor、Terminal、Live Preview と幅がある。
- Google の Codelabs は `claat` (Codelabs as a Thing) という Go 製 CLI が Markdown / Google Docs から静的 HTML を生成する。
- ブラウザ内実行の候補を 2026-08-26 に実測した。

  | ランタイム                    | version | license                                                      | cross-origin isolation                         |
  | ----------------------------- | ------- | ------------------------------------------------------------ | ---------------------------------------------- |
  | `@electric-sql/pglite`        | 0.5.7   | Apache-2.0                                                   | **不要**                                       |
  | `@sqlite.org/sqlite-wasm`     | 3.53.0  | Apache-2.0                                                   | VFS 実装による (未確認)                        |
  | `@duckdb/duckdb-wasm`         | 1.33.1  | MIT                                                          | 単一スレッド版は不要 (未確認)                  |
  | `pyodide`                     | 314.0.6 | MPL-2.0                                                      | 不要                                           |
  | `codemirror`                  | 6.0.2   | MIT                                                          | 不要                                           |
  | `@codesandbox/sandpack-react` | 2.20.0  | Apache-2.0                                                   | バンドラのみなら不要 (Node ランタイムは未確認) |
  | `@webcontainer/api`           | 1.6.4   | MIT (パッケージ)。営利目的の本番利用には商用ライセンスが要る | **必要**                                       |

- WebContainers は `SharedArrayBuffer` を要求し、そのため `COOP: same-origin` + `COEP: require-corp` が要る。
- PGlite は Linux VM を使わず Postgres の単一ユーザーモードを WASM 化したものである。
  単一スレッド・単一接続のため `SharedArrayBuffer` を使わない。
- **配信量を 2026-08-30 に実測した。** ブラウザがダウンロードするのは 4 ファイルで、合計 gzip 5.28 MiB / brotli 3.74 MiB。
  `pglite.wasm` 単体は gzip 3.23 MiB であり、これだけを見ると 4 割少なく見積もる。

  | file          |      raw |     gzip |
  | ------------- | -------: | -------: |
  | `pglite.wasm` | 10.09 MB | 3.23 MiB |
  | `pglite.data` |  6.30 MB | 1.77 MiB |
  | `initdb.wasm` |  0.40 MB | 0.14 MiB |
  | JS chunk      |  0.60 MB | 0.13 MiB |

- 押下から結果表示までを 2026-08-30 に実測した。圧縮なしの静的配信で Fast 4G が 23 秒、Slow 4G は 60 秒の上限に当たって失敗した (経過 74 秒)。
  再試行はキャッシュから 11.5 秒で成功する。
- **初回の待ちが長い。** 押させるまで落とさない方針は正しいが、押した後の段階表示が必須である。
- **`COEP: require-corp` 下では CORP を返さないクロスオリジンのリソースがブロックされる。** 2026-08-26 に実測した。

  | リソース                        | `cross-origin-resource-policy` | COEP 下            |
  | ------------------------------- | ------------------------------ | ------------------ |
  | `fonts.gstatic.com`             | `cross-origin`                 | 読める             |
  | CORP を返さない第三者の埋め込み | なし                           | **ブロックされる** |

- ブロックの対象はランタイムに限らない。
  埋め込み `iframe`、外部の画像、埋め込み動画、外部ホストのスクリプトを含む。
- **isolation は取り消しの効かない方向の制約である。** サイト全体へ掛けると、第三者リソースを使いたくなるたびに、そのリソースが CORP を返すかどうかに実現可能性を握られる。
  条件つきバックログの giscus (GitHub Discussions) がこれに当たる ([design/DesignDoc.md](../design/DesignDoc.md))。
  giscus が CORP を返すかは未確認である。

## 決定

### 1. 手を動かす場所を 4 つに分ける

分ける軸は**読者がどこで実行するか**である。
frontmatter の `interactive.level` が 1 対 1 で対応する。

| `level`    | 実行するもの                             | 実行する場所           | cross-origin isolation    | 実装 |
| ---------- | ---------------------------------------- | ---------------------- | ------------------------- | ---- |
| (項目なし) | 実行しない。コードは表示のみ             | —                      | 不要                      | 済   |
| `embedded` | 単一ランタイムを WASM で本文内に埋め込む | 本文と同一ドキュメント | **不要**                  | 済   |
| `sandbox`  | プロジェクト一式 + シェル + Live Preview | `/playground/<id>`     | **必要**                  | 未   |
| `local`    | ポートやプロセスを使う一式               | 読者の端末             | 不要 (こちらで実行しない) | 済   |

**schema は実装済みの `level` だけを受け付ける。**
設計として 4 つに分けることと、受け口を先に開けることは別である。
先回りして受理すると、ビルドを通ったコンテンツが読者の押下で初めて失敗する。

**上下関係を持たせない。** `embedded` は `sandbox` の準備段階ではなく、それ自体で完結する。
`local` は下位の妥協ではなく、**ブラウザで再現できない題材の唯一の選択肢**である。

`local` を段階に含めるのは、**ブラウザで動くかどうかが題材の側の性質**だからである。
ポートを開く、プロセスを分ける、ホストのリソースを測る。
これらを WASM で再現しようとすると、確かめている対象そのものが失われる。
再現できないものを無理に埋め込むより、リポジトリを渡して手元で組んでもらう方が題材に忠実である。

### 2. cross-origin isolation をサイト全体に掛けない。`/playground/*` にのみ掛ける

**isolation を要求するのは `sandbox` だけであり、`sandbox` を置くページはサイトのごく一部にとどまる。** 制約の適用範囲を、その制約を必要とする経路へ一致させる。

サイト全体へ掛けると、`sandbox` を 1 本も持たないページまでが第三者リソースの CORP 対応に依存する。

- `embedded` は**本文と同一ドキュメント**に置く。
  isolation を要求しないため MDX 内にコンポーネントとして置ける
- `sandbox` は `/playground/<id>` という**別ドキュメント**に置き、本文からは `iframe` で埋め込む
- Workers Static Assets の `_headers` でパス単位に指定する

```
/playground/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

**この分離により、本文の描画と playground を持つかどうかが独立した判断になる。** `embedded` の埋め込みも `sandbox` の iframe も本文のレイアウトを変えずに実現できる。

### 3. `/api/*` と `/playground/*` を URL に予約する

コンテンツの `path` にこの 2 語を使わない。

### 4. claat を使わない。Codelab は自前で描画する

**必要なのは claat の出力ではなく Codelab の形式である。** claat は独自の HTML と UI を吐くため、Content Model と Design System の外に出る。
一覧から参照できず、Design Tokens も効かない。

Codelab 形式の実体は 4 点に尽きる。

| 要素                                     | 実装                                                   |
| ---------------------------------------- | ------------------------------------------------------ |
| ステップ分割                             | 本文の `h2` をステップ境界とし、ビルド時に導出する     |
| ステップごとの所要時間                   | 見出し直後の `Duration:` 行、または frontmatter の配列 |
| 1 ステップ 1 画面 + prev/next + 進捗バー | Codelab 専用 layout                                    |
| 完了状態の永続化                         | `localStorage` (ADR-0008)                              |

**ステップ数を frontmatter に持たない。
本文から導出する。** 本文とステップ数が乖離する経路をなくすためである。

### 5. DB 系のハンズオンは PGlite を既定とする

PGlite だけが cross-origin isolation を要求しないことを確認済みである。
SQLite WASM の OPFS VFS は VFS 実装により分かれる (未確認)。

**想定コンテンツ「RDBMS のクエリ実行を理解する」は `embedded` に収まる。** ヘッダの変更も要らない。

### 6. WebContainers の採用は保留する

営利目的の本番利用に商用ライセンスを要求する。
個人サイトが該当するかは公開形態による。**該当するなら Sandpack (Apache-2.0) を採る。** `sandbox` を実際に検討する時点で確認する。

## 代替案

### 1. cross-origin isolation をサイト全体に掛ける

#### Pros

- ヘッダの管理が単純になる。
  どのページでも `sandbox` を本文内に直接置ける。
- `/playground/*` への iframe 分離が不要になる。

#### Cons

- CORP を返さない第三者リソースが、サイト全体で一律にブロックされる。
  実測で確認済み。
- 埋め込みを足したくなるたびに、そのリソースが CORP を返すかどうかに実現可能性を握られる。
  バックログの giscus が最初に当たる。
- `sandbox` を 1 本も持たない大多数のページが、`sandbox` のための制約を負う。

### 2. claat を採用する

#### Pros

- Codelab の UI を実装しなくてよい。
  Google Codelabs と同じ体験になる。

#### Cons

- 独自の HTML と UI を吐くため Content Model と Design System の外に出る。
  一覧と相互参照から参照できない。
- 出力に Design Tokens が効かず、サイト内で最も浮いたページになる。
- Go 製 CLI をビルドパイプラインへ足すことになり、Vite+ のタスクグラフの外に出る。

### 3. 段階を分けず、最初から WebContainers だけを想定する

#### Pros

- 段階が 1 つになり、Content Model の型が単純になる。

#### Cons

- 最初に作るハンズオン (DB のクエリ実行) が `embedded` で足りるのに、サイト全体へ isolation を掛けるか iframe を用意するかの判断を先に迫られる。
- WebContainers のライセンス確認が `embedded` の実装をブロックする。
- ブラウザで再現できない題材 (ポート、プロセス、ホストのリソース) を扱えない。

### 4. Interactive を一切持たない

#### Pros

- 実装量がゼロ。
  ヘッダの論点も消える。

#### Cons

- ハンズオンの価値の中心が「手を動かす」ことであり、読者が自分の環境を用意しないと再現できない。
  成功条件 S4 (ブラウザだけで完結する) を満たせない。

## 外部依存の健全性

| 項目                                                | 採用候補 (PGlite / `embedded`)                        | 代替案 (WebContainers / `sandbox`)         |
| --------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------ |
| 最終公開日                                          | 0.5.7 (2026-08-25 時点)                               | 1.6.4 (同)                                 |
| 対象バージョンへの対応 (peer dependency / 動作要件) | WebAssembly と IndexedDB。cross-origin isolation 不要 | `SharedArrayBuffer` 必須。COOP + COEP 必須 |
| 後継・代替の有無                                    | SQLite WASM / DuckDB WASM                             | Sandpack (Apache-2.0)、CheerpX             |

## 影響

### 良い影響

- 最初に作るハンズオンが、ヘッダを変えずに実現できる。
- 第三者リソースの埋め込みと playground が共存できる。
  制約を負うのは `/playground/*` だけである。
- ハンズオンが Content Model の内側に留まり、一覧と相互参照から辿れる。
- `sandbox` を入れるかどうかの判断を、`embedded` の実装から独立して先送りできる。
- ブラウザで再現できない題材を、実行環境を持たないまま扱える。

### 悪い影響 / トレードオフ

- Codelab の UI (ステップ導出、prev/next、進捗バー) を自前で実装する必要がある。
- `_headers` によるパス単位のヘッダ管理が増える。
  誤って全体へ掛けると第三者の埋め込みが一律で壊れるため、変更時に注意が要る。
- `sandbox` を本文と別ドキュメントにするため、本文と playground の間で状態を共有できない。
- `local` は読者の端末で動くため、こちらから完了を検知できない。
  サイドバーに完了マーカーを出さない。

### 影響範囲

- 対象モジュール / package: `apps/web`、`packages/content-model` (`interactive` の型)

## 実装・運用への反映

- spec 更新要否: 要 (`sandbox` を実装する時点で spec を起こす)
- context / AI 向け設定更新要否: 要。
  [context/architecture.md](../context/architecture.md) に URL 予約、[context/infrastructure.md](../context/infrastructure.md) に `_headers` の扱いを記載する

## 関連ドキュメント / チケット

- [design/features/interactive/DesignDoc_interactive.md](../design/features/interactive/DesignDoc_interactive.md): Interactive と Codelab の現在の設計
- [ADR-0001](0001-starlight-as-docs-renderer.md): 描画レイヤを自前で持つ決定
- [ADR-0004](0004-typography-static-weights.md): フォントの self-host (COEP からの独立)
- [ADR-0005](0005-workers-terraform-wrangler-boundary.md): `_headers` の管轄
- [ADR-0008](0008-no-reader-identity.md): 進捗の永続化を `localStorage` に限る決定
- [WebContainers: Configuring Headers](https://webcontainers.io/guides/configuring-headers)
- [WebContainers: Enterprise](https://webcontainers.io/enterprise)
- [PGlite](https://pglite.dev/docs/about)
- [googlecodelabs/tools](https://github.com/googlecodelabs/tools)
