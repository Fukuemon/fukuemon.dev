# ADR-0002: 関係を `contentId` の辺として持ち、Content Model を Astro 非依存に保つ

## 状態

承認

## 決定日

2026-08-26

## 背景

- 本サイトの中核価値は、読んで理解する段階と手を動かして確かめる段階が地続きになることである。
  記事とハンズオンを 1 つの一覧に載せ、コンテンツ同士の関連をたどれることが要件になる。
  - [design/features/content-model/DesignDoc_content-model.md](../design/features/content-model/DesignDoc_content-model.md) — 相互参照グラフの設計
- Astro 6 (2026-03) で legacy content collections が撤去され、識別子は `id` に一本化された。**content schema に `slug` を定義するとビルドが `ContentSchemaContainsSlugError` で失敗する。** `id` は Astro がファイルパスから導出して占有するため、自前の安定識別子を `id` に載せることもできない。
- Astro の `reference()` は参照先の collection 名を型で固定する。
  将来コンテンツを別の collection や別のデータソースへ移すと、参照の記述をすべて書き換えることになる。
- 本文の描画レイヤは将来差し替えうる。
  データソースも Markdown から別の形へ移りうる。
- 運用者は 1 名でレビューによる職務分離が成立しないため、規約は自動検査可能な形にする必要がある。

## 決定

### 1. 安定識別子を `contentId` として持ち、URL 用の `path` と分ける

```yaml
contentId: rdbms-query-execution # 発行後は変更しない。全 collection をまたいで一意
path: hands-on/rdbms-query-execution # URL パス。改名可能
```

`contentId` の重複はビルド時に検査して失敗させる。

### 2. 関係は `contentId` から `contentId` への片方向の辺として持つ。`reference()` を使わない

- `related` は他コンテンツの `contentId` の配列とする。
- **著者は片方向だけ記述し、逆方向は導出する。** 双方向の手動記述は片側の書き忘れで不整合を生むため許さない。
- `reference()` が提供するビルド時検証は自前で持つ。
  全 collection から `contentId` 索引を構築し、**解決できない参照があればビルドを失敗させる。**

### 3. `@fukuemon/content-model` を Astro に依存させない

zod schema、`ContentRef` 型、関係グラフの構築と検証を、`zod` だけに依存する純粋関数群として切り出す。`astro:content` から取得したエントリを引数で受け取る。

### 4. データソースの切り替え点を loader に 1 本化する

`apps/web/src/content.config.ts` の loader を、データソースを差し替える唯一の場所とする。

### 5. ページから `astro:content` を直接参照させない

`apps/web/src/pages/**` と `apps/web/src/components/**` は `lib/content/` の公開関数だけを経由する。
Oxlint の `no-restricted-imports` で機械検査する。

### この 5 点が保証すること

| 変更                                | 変更範囲                                        |
| ----------------------------------- | ----------------------------------------------- |
| 本文の描画レイヤを差し替え          | `layouts/DocLayout.astro` のみ                 |
| Markdown から別のデータソースへ移行 | `content.config.ts` の loader                   |
| Astro のメジャーアップグレード      | `apps/web/src/lib/content/` のアダプタ          |

## 代替案

### 1. Astro の `reference()` で関係を表す

#### Pros

- ビルド時の参照検証を Astro が行う。
  自前実装が要らない。
- 型が参照先の collection を保証する。

#### Cons

- 参照先の collection 名を型で固定するため、collection をまたぐ関係では参照ごとに collection を書き分けることになる。
  Article → Slide → Talk → Project という本サイトの中心的な関係が最も書きにくくなる。
- `reference()` は `astro:content` の API であり、`@fukuemon/content-model` を Astro 非依存にする決定と両立しない。
- 別のデータソースへ移行するとき、関係の表現に collection の概念が残り、そのまま写せない。

### 2. `contentId` を持たず、ファイルパスを識別子とする

#### Pros

- frontmatter が 1 行短くなる。
  重複検査も不要になる。

#### Cons

- `path` を改名した瞬間に `related` の参照が全部壊れる。
  タイトルや分類の変更は日常的に起きる。
- 別のデータソースへ移行するとき主キーを新規に発行することになり、既存の関係記述を全件書き換える必要が生じる。

### 3. 双方向の関係を両側に手で書く

#### Pros

- 導出のコードが不要になる。

#### Cons

- 片側の書き忘れで不整合が生じ、しかも検知されない。
  運用者が 1 名でレビューが働かないため、この失敗様式を構造的に潰す必要がある。

## 影響

### 良い影響

- `related` を片側に書くだけで両側に表示される。
  関係の記述コストが半分になり、不整合の経路が消える。
- `@fukuemon/content-model` を Astro を起動せずに Vitest で単体テストできる。
  関係グラフは分岐カバレッジ 100% を要求する対象になる。
- 描画レイヤの差し替えとデータソース移行が、それぞれ 1〜2 箇所の変更で済む。

### 悪い影響 / トレードオフ

- `reference()` のビルド時検証を自前で実装する必要がある。
  ここが壊れると dangling 参照が黙って通る。
- frontmatter に `contentId` が増える。
  発行規則を決めて守る運用が要る。
- ページが `astro:content` を直接触れないため、正規化レイヤに無い情報が要るたびに公開関数を足すことになる。

### 影響範囲

- 対象モジュール / package: `packages/content-model`、`apps/web`

## 実装・運用への反映

- spec 更新要否: 要 (関係グラフの実装と、dangling / 重複検出のテストを Phase 1 の spec に含める)
- context / AI 向け設定更新要否: 要。
  [context/architecture.md](../context/architecture.md) に依存規約 2 本を、[context/testing.md](../context/testing.md) に分岐カバレッジ要求を記載する

## 関連ドキュメント / チケット

- [design/features/content-model/DesignDoc_content-model.md](../design/features/content-model/DesignDoc_content-model.md): Content Model の現在の設計
- [ADR-0001](0001-starlight-as-docs-renderer.md): 描画レイヤの決定 (本 ADR が差し替え可能性を支える)
- [context/architecture.md](../context/architecture.md): 依存規約と機械検査
- [Astro 6.0](https://astro.build/blog/astro-6/): legacy collections の撤去と `slug` → `id`
