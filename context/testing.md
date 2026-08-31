---
type: context
title: Testing Conventions
description: テスト責務の分担、テストの書き方の規範、分岐カバレッジ要求の対象と理由。
keywords: [Vitest, Playwright, 分岐カバレッジ, toStrictEqual, 関係グラフ, e2e]
governs:
  - packages/content-model/
  - e2e/
verified_commit: unverified
---

# Testing Conventions

何をどの層でテストするかと、テストの書き方を定める。
ツール選定は [toolchain.md](toolchain.md)。

## テスト責務の分担

| 層           | 対象                                   | ツール     | 目的                                                                       |
| ------------ | -------------------------------------- | ---------- | -------------------------------------------------------------------------- |
| Unit         | `packages/content-model` の純粋関数    | Vitest     | 関係グラフ・正規化・検証の分岐を全部踏む                                   |
| Unit         | `apps/web/src/lib/content/` のアダプタ | Vitest     | `astro:content` のエントリを `ContentRef` へ写す変換                       |
| Build 時検証 | `contentId` の重複、dangling 参照      | ビルド自体 | **テストではなくビルドを失敗させる。** 検査の抜けが本番へ出ないようにする  |
| E2E          | 一覧の絞り込みと相互参照               | Playwright | 種別で絞った一覧が該当種別のみを並べ、片方向に書いた関連が双方向に出ること |

**UI コンポーネントの単体テストを書かない。** Astro コンポーネントは静的 HTML を吐くだけで、分岐は `ContentRef` を作る側にある。
分岐を持たないものをテストしても、壊れたときに落ちない。

## テストの書き方

- **テスト名は条件と結果を述べる。** 名前だけで何が壊れたか分かること。
  周囲のテストの言い回しに揃える。
- **1 テスト 1 `expect`。** Arrange / Act / Assert の順に並べる。
  テーブル駆動は 1 行 1 テストとし、同じ規則に従う。
- **構造を持つ結果は 1 つの `expect` で全体比較する。** `toStrictEqual` を使う。
  フィールドごとの検査は最初の不一致で止まり、残りを隠す。
- **追加した分岐は、その分岐が壊れたときに落ちるテストで踏む。** テストファーストは要求しない。

## 分岐カバレッジ要求

**`packages/content-model` は分岐カバレッジ 100% を要求する。** ファイル単位で `vitest.config.ts` に明示列挙し、新しい純粋モジュールはテストと同時に列挙へ加える。**列挙し忘れると何もゲートしない。**

とくに次の 3 つは分岐を全部踏む。

| 対象                   | 壊れたときに起きること                                            |
| ---------------------- | ----------------------------------------------------------------- |
| dangling 参照の検出    | 解決できない `related` が黙って通り、関連コンテンツが表示されない |
| 逆参照の導出           | 片側にしか関連が出ない。成功条件 S4 が静かに壊れる                |
| `contentId` 重複の検出 | 別コンテンツが同じ ID を持ち、参照先が非決定になる                |

**いずれも「壊れても画面は出る」種類の失敗である。** 目視で気づけないため、テストで押さえる。

`packages/content-model` を Astro 非依存にしている ([ADR-0002](../adr/0002-content-model-independence.md)) のは、この要求を成立させるためでもある。
Astro を起動せずに分岐を網羅できる。

## E2E の範囲

**最小限に留める。** 静的サイトであり、ビルドが通れば大半のページは出る。

E2E で押さえるのは「ビルドは通るが意味が壊れている」ケースに限る。

- Topic ページに、その Topic に属する全種別のコンテンツが列挙されること (成功条件 S1)
- Slides 一覧に外部資料が metadata 付きで並ぶこと (成功条件 S2)

**成功条件に対応しない E2E を書かない。** 増やすほど壊れやすくなり、壊れたときに直す動機が働かない。

## テスト runtime contract

- Unit テストは Node 上で動かす。
  ブラウザ環境を要求しない (`packages/content-model` が純粋関数のため)。
- E2E はビルド済みの `dist/` を静的配信して実行する。
  dev server ではなくビルド成果物を対象にする。**Astro の dev と build で出力が異なる場合があり、本番に近い側を検査する。**

## 横断テスト方針

- **壊れたときに落ちないテストを書かない。** カバレッジの数字を満たすためだけのテストは、保守コストだけを増やす。
- **フレークするテストは直すか消す。** 1 名運用では、無視されるテストは存在しないのと同じで、しかもノイズになる。
- 検査が実行されなかったことを「通った」と扱わない ([engineering.md](engineering.md))。

## 参照

- [toolchain.md](toolchain.md): Vitest / Playwright の版と実行方法
- [engineering.md](engineering.md): quality gate と除外方針
- [architecture.md](architecture.md): `packages/content-model` の責務
- [ADR-0002](../adr/0002-content-model-independence.md): Astro 非依存とテスト可能性
- [design/features/content-model/DesignDoc_content-model.md](../design/features/content-model/DesignDoc_content-model.md): テスト対象の設計

## 見た目の回帰

スタイリングに触れる変更は、`e2e/shoot.ts` で前後 40 枚 (10 ページ × 明暗 2 配色 × 2 幅) を撮り、
`e2e/diff.ts` で突き合わせる。手順は [ADR-0010](../adr/0010-tailwind-as-styling-base.md) の「検証」節。

**`check` には入れない。** 「変更前」を撮っておく必要があり、CI では自動化できない。
ページを足したら `e2e/pages.ts` の `PAGES` へ 1 行足す。
