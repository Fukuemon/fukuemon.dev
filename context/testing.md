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

| 種類         | 対象                                                                               | ツール                   | 保証すること                                                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| unit         | `packages/content-model` の関係グラフ、シリーズ、目次                              | Vitest                   | 関係グラフの構築と検証、シリーズのチェック、目次の組み立ての分岐をすべて踏む                                                                 |
| unit         | `apps/playground/public/` の `_headers` と `_redirects`（`apps/playground/test/`） | Vitest                   | cross-origin isolation のヘッダを `/node/*` にだけ、noindex、nosniff、Referrer-Policy、HSTS をすべてのパスに返し、`/` だけをリダイレクトする |
| ビルドの検証 | `contentId` の重複、解決できない `related`、シリーズの構造と `order`               | ビルドそのもの           | チェックの抜けを本番へ出さない。テストではなくビルドを失敗させる                                                                             |
| unit         | `packages/sql-runtime` の SQL の実行と、Web Worker で動かす DB                     | Vitest                   | 本物の PGlite で、複数の文の取り消し、100,000 行で切る処理、エラーのコードと位置、Web Worker の読み込みの失敗と異常終了からの作り直しを踏む  |
| unit         | `apps/playground/src/` の React の外のモジュール                                   | Vitest                   | プロジェクトの JSON の検証、入力欄と実行中の状態、実行計画の木、結果の表の行とページを組む処理の分岐を踏む                                   |
| E2E          | `packages/ui` のカタログの Show code（`packages/ui/e2e/specs/`）                   | Playwright               | Docs のページの Show code が、story のソースから作ったコードを出す                                                                           |
| 見た目の回帰 | スタイリングに触れる変更                                                           | E2E のエビデンスの静止画 | 変更の前後で画面の見た目が意図せず変わらない                                                                                                 |

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
対象は、`src/features/top-garden/` の、墨の絵と署名の SVG を作るモジュールと、`season.ts`（季節と時間帯を返す）と `visit.ts`（最初の訪問かを返す）である。

`apps/playground`、`packages/sql-runtime` には、分岐、関数、行、文のカバレッジ 90% を、`packages/playground-project` には 100% を求める。  
対象は、`src/**/*.ts` のうちテストのファイルを除いたものである。React のコンポーネントと、各ツールの `main.tsx`（`.tsx`）は、対象に入れない。

E2E を足すのは、ビルドは通るが表示の意味が誤っているケースだけにする。  
静的なサイトなので、ビルドが通れば大半のページは出る。  
[PRD](../docs/PRD.md#success-metrics) の成功条件に対応しない E2E を書かない。  
増やすほど失敗しやすくなり、失敗したときに直す動機が働かない。

カタログの回帰の E2E は、Storybook の実験的な機能 `experimentalCodeExamples` に頼る Show code を確認する。  
Storybook のバージョンを上げると動きが変わることがあり、画面を開かないと気づけないためである。  
この E2E は、まだ `pnpm run check` と CI で実行しない。  
CI につなぐ作業は [#88](https://github.com/Fukuemon/fukuemon.dev/issues/88) で行う。  
それまでは、Storybook のバージョンを上げるときに、ビルドしたカタログを配信し、その URL を `BASE_URL` に渡して `pnpm --filter @fukuemon/ui e2e` で実行する。

見た目の回帰のチェックは、E2E のエビデンスの静止画を、変更の前後で並べて比べる。  
ADR-0029: [リポジトリの構成を buddy に合わせる](../docs/adr/0029-repository-layout-like-buddy.md#3-e2e-の配置先)  
サイトの E2E の package（`packages/e2e`）は、まだ無い。

## Runtime Requirements

- unit test は Node.js の上で動かし、ブラウザの環境を要求しない。
- E2E を足すときは、ビルド済みの `dist/` を静的に配信して実行し、dev server を対象にしない。
  - Astro の dev と build で出力が違う場合があり、本番に近い側をチェックする。
- 実行に要る環境変数、ポート、外部のサービスは、未定。

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
