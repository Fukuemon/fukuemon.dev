---
type: context
title: テスト
description: テストの種類ごとに保証すること、カバレッジを求める対象、E2E と見た目の回帰の範囲、実行に要る環境、テストの書き方と変更ごとに足すテスト
status: draft
governs:
  - packages/content-model/
  - apps/playground/test/
verified_commit: ab2da87
---

# テスト

## Test Types and Guarantees

テストの種類ごとに、保証することと置き場は次のとおり。

| 種類         | 対象                                                                               | ツール                   | 保証すること                                                                                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| unit         | `packages/content-model` の関係グラフ、シリーズ、目次                              | Vitest                   | 関係グラフの構築と検証、シリーズのチェック、目次の組み立ての分岐をすべて踏む                                                                                                 |
| unit         | `apps/playground/public/` の `_headers` と `_redirects`（`apps/playground/test/`） | Vitest                   | cross-origin isolation のヘッダを `/node/*` にだけ、noindex、nosniff、Referrer-Policy、HSTS、frame-ancestors をすべてのパスに返し、`/` だけをリダイレクトする                |
| ビルドの検証 | `contentId` の重複、解決できない `related`、シリーズの構造と `order`               | ビルドそのもの           | チェックの抜けを本番へ出さない。テストではなくビルドを失敗させる                                                                                                             |
| unit         | `packages/sql-runtime` の SQL の実行と、Web Worker で動かす DB                     | Vitest                   | 本物の PGlite で、複数の文の取り消し、100,000 行で切る処理、エラーのコードと位置、Web Worker の読み込みの失敗と異常終了からの作り直しを踏む                                  |
| unit         | `packages/go-runtime` の Yaegi で Go を動かす処理（`go/`）                         | `go test`                | `syscall/js`、`syscall`、`unsafe`、`os/exec` の import が失敗すること、ディレクトリの package の import を解決できること、終了コードとテストの関数を集められることを確認する |
| unit         | `packages/go-runtime` の `GoRunner` と、Web Worker の `fetch` の差し替え           | Vitest                   | Web Worker のモックで、実行、止める、package ごとのテスト、読み込みと Web Worker の失敗と、ほかの origin へのリクエストを止める処理を踏む                                    |
| unit         | `packages/node-runtime` の、WebContainers に依らない処理                           | Vitest                   | WebContainers を使わないテスト用の実装で、ファイルのツリーと操作、プロセスの出力と終了、ポート、起動の失敗と 30 秒の上限、破棄の分岐を踏む                                   |
| unit         | `apps/playground/src/` の React の外のモジュール                                   | Vitest                   | プロジェクトの JSON の検証、入力欄と実行中の状態、実行計画のツリー、結果の表の行とページを組む処理、Go のファイルの操作と保存と出力の分岐を踏む                              |
| E2E          | `packages/ui` のカタログの Show code（`packages/ui/e2e/specs/`）                   | Playwright               | Docs のページの Show code が、story のソースから作ったコードを出す                                                                                                           |
| E2E          | 記事の一覧から記事を開く（`packages/e2e/tests/specs/`）                            | Playwright               | 一覧の 1 本目の記事の題を押すと、その記事のページが開き、見出しが一覧の題と同じになる                                                                                        |
| E2E          | 記事のページの表、図、コードブロックの枠（`packages/e2e/visual/specs/`）           | Playwright               | 本文の列からあふれた表、図、コードブロックの枠にだけ、右に続きがある間、右端を背景の色で薄くする。動きを減らす設定では、右端まで送ったときに一度に消す                       |
| 見た目の回帰 | スタイリングに触れる変更                                                           | E2E のエビデンスの静止画 | 変更の前後で画面の見た目が意図せず変わらない                                                                                                                                 |
| 見た目の回帰 | トップの止めた庭の絵（`packages/e2e/visual/specs/`）                               | Playwright               | 季節と時間帯を固定した庭の絵が、基準のスナップショットと同じに出る。WebGL を使えないときは、庭を出さずにふつうのページが出る                                                 |

UI コンポーネントの単体テストは書かない。  
Astro のコンポーネントは静的な HTML を出すだけで、分岐は `ContentRef` を作る側にある。

カバレッジの対象は、それぞれの package の `vitest.config.ts` に、ファイルごとに列挙する。  
列挙し忘れたファイルは、カバレッジのチェックを受けない。

`packages/content-model` の `graph.ts`、`toc.ts`、`series.ts` には、分岐、関数、行、文のカバレッジ 100% を求める。  
次の 3 つは、誤っても画面が出るので目視では気づけない。分岐をすべて踏む。

- 解決できない `related` の検出。誤ると、関連するコンテンツがエラーを出さずに表示されなくなる。
- 逆参照の導出。誤ると、片側にしか関連が出なくなる。
- `contentId` の重複の検出。誤ると、別のコンテンツが同じ ID を持ち、参照先が決まらなくなる。

`packages/content-model` は Astro に依存しないので、Astro を起動せずに分岐を網羅できる。  
ADR-0002: [Content Model の Astro からの独立](../docs/adr/0002-content-model-independence.md)

`apps/web` には、分岐、関数、行、文のカバレッジ 90% を求める。  
対象は、次のモジュール。

- `src/features/top-garden/` の、墨の絵の SVG を作る `layout.ts` と `rng.ts`（直下）と、`ink/` の `brush.ts`、`ink-art.ts`、`ink-svg.ts`
- `src/features/top-garden/scene/` の、時間帯と季節から場面の色を決める `scene-colors.ts`
- `src/features/top-garden/stage/` の、季節と時間帯を返す `season.ts`、最初の訪問かを返す `visit.ts`、季節と時間帯を `html` に書き庭を出すかを決める `stage.ts`
- `src/components/sign/sign.ts`（署名の SVG を HTML に置く形にする）
- `src/components/site-nav.ts`（ヘッダーのリンクの `aria-current` を返す）
- `src/lib/subset-fonts.ts`（ビルドの後に、見出しの書体のファイルを、使う字だけに作り直す）

`src/lib/` では、次のモジュールも対象。

- 公開するかを判定し、記事ごとにシリーズの中の位置と前後の記事へのリンクを返す `content/article-pages.ts`
- contentId の重複と `related` の誤りに、原稿のパスを付けて throw する `content/article-graph.ts`
- 一覧に載せる記事の並びと、シリーズのページに載せる記事の読む順を返す `content/article-list.ts`
- RSS の文書を組む `content/rss.ts`
- `mermaid` のフェンスを SVG にする `rehype-mermaid.ts`
- 和文の間の改行を消す `rehype-ja-linebreak.ts`
- 表と図を横に送れる枠で包む `rehype-scroll-box.ts`
- 指定した言語のコードフェンスを要素に置き換える `rehype-fence.ts`
- `playground` のフェンスを実行環境のボタンにし、Node の実行環境を埋め込む記事に外部の画像と埋め込みがあると throw する `playground/rehype-playground.ts`
- プロジェクトのディレクトリを読み、schema で検証して JSON に変換する `playground/project.ts`
- 原稿から埋め込みの名前を集める `playground/embeds.ts`
- プロジェクトの JSON のページを並べ、2 本の記事が同じプロジェクトを指すと throw する `playground/project-pages.ts`
- Node の実行環境を埋め込むページに、cross-origin isolation のヘッダを返す規則を出力の `_headers` に足す `playground/isolation-headers.ts`

`apps/web/scripts/` では、ビルドの出力を複製し、複製の `_headers` に noindex を足す `preview-assets.ts` も対象。

`apps/playground`、`packages/sql-runtime`、`packages/go-runtime`、`packages/node-runtime` には、分岐、関数、行、文のカバレッジ 90% を求める。  
`packages/playground-project` には、100% を求める。  
`apps/playground`、`packages/go-runtime`、`packages/node-runtime` の対象は、`src/**/*.ts` のうちテストのファイルを除いたものである。React のコンポーネントと、各ツールの `main.tsx`（`.tsx`）は、対象に入れない。  
`packages/sql-runtime` と `packages/go-runtime` の `src/worker/index.ts` と `src/worker/worker.ts` は、対象に入れない。  
2 つは `Worker` と `import.meta.url` を使い、Node では動かないためである。2 つのファイルは、テストする `database.ts` と `handler.ts`（`go-runtime` では `runner.ts`、`guard.ts`、`parts.ts`）を呼ぶだけにする。  
`packages/go-runtime` の `test` の script は、Vitest の後に `go test` を実行するので、`mise.toml` の Go が要る。  
`packages/node-runtime` の `src/webcontainer/index.ts` と `src/index.ts` は、対象に入れない。  
WebContainers はブラウザでしか動かないためである。  
`src/webcontainer/` のうち、WebContainers を動かさない処理（初期ファイルを mount に渡すツリーの形にする `tree.ts`）は、別のファイルに分けて対象に入れる。  
`src/webcontainer/index.ts` と `src/index.ts` の動きは、ブラウザでの動作確認で確認する。

E2E を足すのは、ビルドは通るが表示の意味が誤っているケースだけにする。  
静的なサイトなので、ビルドが通れば大半のページは出る。  
[PRD](../docs/PRD.md#success-metrics) の成功条件に対応しない E2E を書かない。  
増やすほど失敗しやすくなり、失敗したときに直す動機が働かない。

カタログの回帰の E2E は、Storybook の実験的な機能 `experimentalCodeExamples` に頼る Show code を確認する。  
Storybook のバージョンを上げると動きが変わることがあり、画面を開かないと気づけないためである。  
この E2E は、pull request の CI（`.github/workflows/e2e.yml`）で、サイトの E2E と並べて実行する。  
`pnpm run check` では実行しない。  
Storybook のバージョンを上げる pull request でも、CI が同じ E2E を実行する。

見た目の回帰のチェックは、E2E のエビデンスの静止画を、変更の前後で並べて比べる。  
ADR-0029: [リポジトリの構成を buddy に合わせる](../docs/adr/0029-repository-layout-like-buddy.md#3-e2e-の配置先)  
サイトの E2E の package は `packages/e2e` で、spec は `packages/e2e/tests/specs/` に置く。  
`packages/e2e` は、ビルドした `apps/web/dist/` を配信して実行する。実行の方法は [E2E のテスト](testing/e2e.md#running-tests) にある。  
トップの庭の見た目の回帰と、記事のページの表と図の枠の spec は、`packages/e2e/visual/specs/` に置く。  
`tests/` の外なので、E2E の lint の規則は掛からない。

記事のページの表、図、コードブロックの枠の右端の薄い色は、CSS の scroll-driven animation だけで出し分ける。  
あふれたときだけ薄い色が出ることは、ブラウザで描画しないと確認できない。そのため、E2E で確認する。  
`scroll-box-fade.spec.ts` と `packages/e2e` の一覧から記事を開く spec は、検証用の原稿に依存するので、原稿を消すときに、spec が開く記事を差し替える。

トップの庭は、Playwright のスクリーンショットの比較で確認する。  
庭は WebGL で描き、目で比べても色の小さな違いに気づけないためである。  
実行の方法は [E2E のテスト](testing/e2e.md) にある。

## Runtime Requirements

- unit test は Node.js の上で動かし、ブラウザの環境を要求しない。
  - 例外は、`apps/playground/src/code-editor/search-panel.ts` のテストである。CodeMirror のパネルは DOM を組むので、jsdom の上で動かす。
- E2E を足すときは、ビルド済みの `dist/` を静的に配信して実行し、dev server を対象にしない。
  - Astro の dev と build で出力が違う場合があり、本番に近い側をチェックする。
- 見た目の回帰の配信のポートと環境変数は、[E2E のテスト](testing/e2e.md) にある。外部のサービスは、未定。

## Mocking and Test Data

未定。

## Required Tests

- 追加した分岐は、その分岐を誤ったときに失敗するテストで踏む。テストファーストは求めない。
- `packages/content-model` と `apps/web` に新しい純粋なモジュールを足したら、テストと同時に `vitest.config.ts` のカバレッジの対象に加える。
- スタイリングに触れる変更では、見た目の回帰をチェックする。
- リリースの前には、CI の `pnpm run check` を通す。
  - deploy の条件は [operations.md](operations.md#deployment-conditions) にある。

次のテストは書かない。

- 実装を誤っても失敗しないテスト。カバレッジの数字を満たすためだけのテストは、保守の手間だけを増やす。
- フレークするテスト。直すか消す。1 名の運用では、無視されるテストはないのと同じで、ノイズになる。

チェックが実行されなかったことを、通ったとして扱わない。  
扱いは [conventions.md](conventions.md#check-exclusions) にある。

### テストの書き方

- テスト名は、条件と結果を述べる。名前だけで何を誤ったかが分かるようにし、周りのテストの言い回しに揃える。
- 1 つのテストに `expect` を 1 つ置き、Arrange、Act、Assert の順に並べる。
  - テーブル駆動のテストは 1 行を 1 つのテストとし、同じ規則に従う。
- 構造を持つ結果は、`toStrictEqual` を使い、1 つの `expect` で全体を比べる。
  - フィールドごとのチェックは最初の不一致で止まり、残りの不一致を隠す。
