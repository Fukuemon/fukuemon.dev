---
type: context
title: テスト
description: テストの種類ごとに保証すること、分岐カバレッジを求める対象、E2E と見た目の回帰の範囲、実行に要る環境、テストの書き方と変更ごとに足すテスト
status: draft
governs:
  - packages/content-model/
  - e2e/
verified_commit: unverified
---

# テスト

## Test Types and Guarantees

テストの種類ごとに、保証することと置き場は次のとおり。

| 種類         | 対象                                         | ツール                          | 保証すること                                                                 |
| ------------ | -------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------- |
| unit         | `packages/content-model` の純粋関数          | Vitest                          | 関係グラフ、正規化、検証の分岐をすべて踏む                                   |
| unit         | `apps/web/src/lib/content/` のアダプタ       | Vitest                          | `astro:content` のエントリを `ContentRef` へ写す変換                         |
| ビルドの検証 | `contentId` の重複と、解決できない `related` | ビルドそのもの                  | チェックの抜けを本番へ出さない。テストではなくビルドを失敗させる             |
| E2E          | 一覧の絞り込みと相互参照                     | Playwright                      | 種別で絞った一覧が該当する種別だけを並べる。片方向に書いた関連が双方向に出る |
| 見た目の回帰 | スタイリングに触れる変更                     | `e2e/shoot.ts` と `e2e/diff.ts` | 変更の前後で画面の見た目が意図せず変わらない                                 |

UI コンポーネントの単体テストは書かない。  
Astro のコンポーネントは静的な HTML を出すだけで、分岐は `ContentRef` を作る側にある。

`packages/content-model` には、分岐カバレッジ 100% を求める。  
対象はファイルごとに `vitest.config.ts` に列挙する。  
列挙し忘れたファイルは、カバレッジのチェックを受けない。  
次の 3 つは、誤っても画面が出るので目視では気づけない。分岐をすべて踏む。

- 解決できない `related` の検出。誤ると、関連するコンテンツがエラーを出さずに表示されなくなる。
- 逆参照の導出。誤ると、片側にしか関連が出なくなる。
- `contentId` の重複の検出。誤ると、別のコンテンツが同じ ID を持ち、参照先が決まらなくなる。

`packages/content-model` は Astro に依存しないので、Astro を起動せずに分岐を網羅できる。  
ADR-0002: [Content Model の Astro からの独立](../adr/0002-content-model-independence.md)

E2E は、ビルドは通るが表示の意味が誤っているケースだけに使う。  
静的なサイトなので、ビルドが通れば大半のページは出る。  
[PRD](../PRD.md#success-metrics) の成功条件に対応しない E2E を書かない。  
増やすほど失敗しやすくなり、失敗したときに直す動機が働かない。

見た目の回帰のチェックは、`e2e/pages.ts` の `PAGES` のページを明暗 2 つの配色と 2 つの幅で撮り、変更の前後を比べる。  
手順は [ADR-0010](../adr/0010-tailwind-as-styling-base.md) の「検証」の節にある。  
変更の前を撮っておく必要があり CI では自動化できないので、`pnpm run check` に入れない。

## Runtime Requirements

- unit test は Node.js の上で動かし、ブラウザの環境を要求しない。
- E2E は、ビルド済みの `dist/` を静的に配信して実行し、dev server を対象にしない。
  - Astro の dev と build で出力が違う場合があり、本番に近い側をチェックする。
- 実行に要る環境変数、ポート、外部のサービスは、未定。

## Mocking and Test Data

未定。

## Required Tests

- 追加した分岐は、その分岐を誤ったときに失敗するテストで踏む。テストファーストは求めない。
- `packages/content-model` に新しい純粋なモジュールを足したら、テストと同時に `vitest.config.ts` のカバレッジの対象に加える。
- スタイリングに触れる変更では、見た目の回帰をチェックする。
- ページを足したら、`e2e/pages.ts` の `PAGES` に 1 行足す。
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
