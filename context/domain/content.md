---
type: context
title: コンテンツ
description: 記事とハンズオンに共通する、公開の状態の遷移、contentId と関連の不変条件、著者がしてはいけないこと
status: stable
---

# コンテンツ

schema と関係グラフの設計は [Content Model の Design Doc](../../packages/content-model/DesignDoc.md) にある。

## States and Transitions

- `draft` のコンテンツは、dev server でだけ見える。
- `published` のコンテンツは、build が書き出す。
- `archived` のコンテンツは、`draft` と同じく dev server でだけ見え、build は書き出さない。
- 著者は frontmatter の `status` を `draft` から `published` に書き換えて公開する。
- 著者は `status` を `published` から `archived` に書き換えると、build の出力からそのコンテンツを外せる。
- `related` が `draft` か `archived` のコンテンツを指しても、ビルドは失敗しない。build の出力の関連には出ない。

## Invariants

- `contentId` は、すべての collection をまたいで一意である。重複があるとビルドが失敗する。
- `related` に書いた `contentId` は、実在するコンテンツを指す。解決できない参照があるとビルドが失敗する。
- 関連は `contentId` から `contentId` への片方向の辺で、逆向きはビルドのときに導く。
- 種別は、コンテンツを置いたディレクトリで決まる。
- コンテンツの追加は、Markdown の 1 枚の作成で完結する。索引のページを手で直さない。

## Prohibitions

- 公開した後に `contentId` を変えない。URL を変えても関連が切れないよう、`contentId` を関係の主キーにしている。
- `related` を両方のコンテンツに書かない。片方の書き忘れで不整合が出る。
- frontmatter に種別を書かない。
- コンテンツの `path` に `api` と `playground` を使わない。
