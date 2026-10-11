# ADR-0002: 関係を `contentId` の辺として持ち、Content Model を Astro 非依存に保つ

## Status

承認

## Context

- 本サイトの中核価値は、読んで理解する段階と手を動かして確かめる段階が地続きになることにある。
  - 記事とハンズオンを 1 つの一覧に載せ、コンテンツ同士の関連をたどれることが要件になる。
  - 相互参照グラフの設計は [packages/content-model/DesignDoc.md](../packages/content-model/DesignDoc.md) が持つ。
- Astro 6 (2026-03) で legacy content collections が撤去され、識別子は `id` に一本化された。
  - **content schema に `slug` を定義すると、ビルドが `ContentSchemaContainsSlugError` で失敗する。**
  - `id` は Astro がファイルパスから導出して占有するため、自前の安定識別子を `id` に載せることもできない。
  - 出典: [Astro 6.0](https://astro.build/blog/astro-6/)
- Astro の `reference()` は参照先の collection 名を型で固定する。
  - 将来コンテンツを別の collection や別のデータソースへ移すと、参照の記述をすべて書き換えることになる。
- 本文の描画レイヤは将来差し替えうる。データソースも Markdown から別の形へ移りうる。
  - ADR-0001: [Starlight を採らず、Astro 単体 + Expressive Code + Pagefind で組む](0001-starlight-as-docs-renderer.md)
- 運用者は 1 名でレビューによる職務分離が成立しないため、規約は機械で確かめられる形にする必要がある。

## Decision

### 1. 安定識別子を `contentId` として持ち、URL 用の `path` と分ける

```yaml
contentId: rdbms-query-execution # 発行後は変更しない。全 collection をまたいで一意
path: hands-on/rdbms-query-execution # URL パス。改名可能
```

`contentId` の重複はビルド時に確かめ、見つかればビルドを失敗させる。

### 2. 関係は `contentId` から `contentId` への片方向の辺として持ち、`reference()` を使わない

- `related` は他コンテンツの `contentId` の配列とする。
- **著者は片方向だけ記述し、逆方向は導出する。**
  - 双方向の手動記述は片側の書き忘れで不整合を生むため許さない。
- `reference()` が提供するビルド時検証は自前で持つ。
  - 全 collection から `contentId` 索引を構築し、**解決できない参照があればビルドを失敗させる。**

### 3. `@fukuemon/content-model` を Astro に依存させない

zod schema、`ContentRef` 型、関係グラフの構築と検証を、`zod` だけに依存する純粋関数群として切り出す。  
`astro:content` から取得したエントリは引数で受け取る。

### 4. データソースの切り替え点を loader に 1 本化する

`apps/web/src/content.config.ts` の loader を、データソースを差し替える唯一の場所とする。

### 5. ページから `astro:content` を直接参照させない

`apps/web/src/pages/**` と `apps/web/src/components/**` は `lib/content/` の公開関数だけを経由する。  
Oxlint の `no-restricted-imports` で機械的にチェックする。

### 5 点の決定が保証すること

| 変更                                | 変更範囲                               |
| ----------------------------------- | -------------------------------------- |
| 本文の描画レイヤを差し替え          | `layouts/DocLayout.astro` のみ         |
| Markdown から別のデータソースへ移行 | `content.config.ts` の loader          |
| Astro のメジャーアップグレード      | `apps/web/src/lib/content/` のアダプタ |

## Considered Options

| 選択肢                                                                                   | 強み                                                                                                                       | 弱み                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **採用:** 関係を `contentId` の片方向の辺として持ち、Content Model を Astro 非依存に保つ | 片側に書くだけで両側に表示される。Astro を起動せずに単体テストできる。描画レイヤとデータソースの差し替えが 1〜2 箇所で済む | `reference()` のビルド時検証を自前で実装する。frontmatter に `contentId` が増える                                                                                                                                                                                                                                                                                                                         |
| Astro の `reference()` で関係を表す                                                      | ビルド時の参照検証を Astro が行い、自前実装が要らない。型が参照先の collection を保証する                                  | 参照先の collection 名を型で固定するため、collection をまたぐ関係では参照ごとに collection を書き分けることになる。Article → Slide → Talk → Project という本サイトの中心的な関係が最も書きにくくなる。`reference()` は `astro:content` の API で、`@fukuemon/content-model` を Astro 非依存にする決定と両立しない。別のデータソースへ移行するとき、関係の表現に collection の概念が残り、そのまま写せない |
| `contentId` を持たず、ファイルパスを識別子とする                                         | frontmatter が 1 行短くなる。重複のチェックも不要になる                                                                    | `path` を改名すると、`related` の参照がすべて解決できなくなる。タイトルや分類の変更は日常的に起きる。別のデータソースへ移行するとき主キーを新規に発行することになり、既存の関係記述を全件書き換える必要が生じる                                                                                                                                                                                           |
| 双方向の関係を両側に手で書く                                                             | 導出のコードが不要になる                                                                                                   | 片側の書き忘れで不整合が生じ、しかも検知されない。運用者が 1 名でレビューが働かないため、この失敗様式を構造的に防ぐ必要がある                                                                                                                                                                                                                                                                             |

## Consequences

### Positive

- `related` を片側に書くだけで両側に表示される。
  - 関係の記述コストが半分になり、不整合が起きる余地がなくなる。
- `@fukuemon/content-model` を Astro を起動せずに Vitest で単体テストできる。
  - 関係グラフは分岐カバレッジ 100% を要求する対象になる。
- 描画レイヤの差し替えとデータソース移行が、それぞれ 1〜2 箇所の変更で済む。

### Negative

- `reference()` のビルド時検証を自前で実装する必要がある。
  - この検証が正しく動かないと、dangling 参照がエラーにならずに通る。
- frontmatter に `contentId` が増え、発行規則を決めて守る運用が要る。
- ページが `astro:content` を直接触れないため、正規化レイヤに無い情報が要るたびに公開関数を足すことになる。
