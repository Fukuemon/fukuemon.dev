# ADR-0003: pnpm workspace の monorepo とし、package の境界を最初から物理的に分ける

## Status

提案

## Context

- 設計の中核は「Content Model と Design System が Astro から独立していること」にある。
  - ADR-0002: [関係を `contentId` の辺として持ち、Content Model を Astro 非依存に保つ](0002-content-model-independence.md)
- 運用者は 1 名で、レビューによる職務分離が成立しない。
  - 規約の遵守を人手の確認に委ねられない。
- `packages/content-model` は、Astro なしで単体テストできることを要求する。
  - Astro の依存が同じ解決グラフに載ると、この要求を確認できない。
- 実行環境の package のうち、`@fukuemon/node-runtime` と `@fukuemon/go-runtime` は、消費者が `apps/playground` の 1 つである。

## Decision

### 1. Phase を問わず pnpm workspace の monorepo とする

**package 境界は、後で切り出さず、最初から物理的に分ける。**

単一 package で独立性を維持する手段は、lint の import 制限しかない。  
lint は、違反を「動いてしまう」形で通す。  
package として分ければ、境界違反は依存解決の失敗として現れ、build が止まる。

1 名運用では、規約を機械で強制できることが保守性を決める。  
レビューによる職務分離が成立しない以上、規約は実行系が拒否する形でしか守れない。

この構成は、`content-model` の package.json が Astro を依存に持たないことを保証する。  
設計不変量で、依存宣言を読むだけで確認できる。  
設計不変量は [design/DesignDoc.md](../design/DesignDoc.md) の 4 にある。

### 2. package を切り出す条件

`packages/` にモジュールを増やすのは、次のどちらかが成り立つときである。

- 2 つ以上の消費者が実在する。
- 消費する側と別の理由で変わる。

消費者が 1 つでも、自分のバージョン、自分のテスト、自分の理由で変わるものは package にする。  
消費者が 1 つで、変わる理由も消費する側と同じなら、切り出さない。

## 承認の条件

Decision 2 は、条件を「2 つ以上の消費者が実在すること」の 1 つから、2 つに変える。  
利用者が、この変更を承認する。

## Considered Options

| 選択肢                                                                            | 強み                                                                             | 弱み                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **採用:** pnpm workspace の monorepo とし、package の境界を最初から物理的に分ける | package の依存宣言で境界を強制できる                                             | package.json が 5 つ以上になり、初期の構築手数が増える                                                                                                                                                                                                                                               |
| 単一 package で始め、必要になってから workspace 化する                            | 初期構成が最も単純になる。`pnpm-workspace.yaml` も package.json の分割も要らない | Content Model と Design System の独立を lint でしか守れず、違反が「動いてしまう」形で混入する。同一 package では Astro の依存が常に解決可能なため、`content-model` を Astro なしで単体テストできることを確認する手段がない。後から workspace 化するとき、`apps/web` へツリー全体を移す作業が発生する |
| Bun を package manager にする                                                     | インストールとスクリプト実行が速い                                               | pnpm workspace を基盤とする決定と衝突する。Vite+ は lockfile から package manager を検出して wrap するため、pnpm のまま Vite+ の利得を受け取れる                                                                                                                                                     |
| package を切り出す条件を「2 つ以上の消費者が実在すること」だけにする              | 条件が 1 つで、消費者を数えれば判定できる                                        | `@fukuemon/node-runtime` と `@fukuemon/go-runtime` は消費者が 1 つで、条件に合わない                                                                                                                                                                                                                 |

単一 package の案は成立しないわけではない。  
消費者が 1 つしかない現状では、単一 package でも動くものは作れる。  
採らない理由は動作ではなく、規約を機械で強制できるかどうかにある。

## Consequences

### Positive

- 依存規約 2 本のうち「`content-model` を Astro 非依存に保つ」が、package の依存宣言で強制される。

### Negative

- package.json が 5 つ以上になり、初期の構築手数が増える。
