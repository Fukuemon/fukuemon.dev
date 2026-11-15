---
type: context
title: コンテンツ
description: 記事の公開の状態の遷移、contentId と関連とシリーズの不変条件、著者がしてはいけないこと
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

- `contentId` は、すべての記事のあいだで一意である。重複があるとビルドが失敗する。
- `related` に書いた `contentId` は、実在するコンテンツを指す。解決できない参照があるとビルドが失敗する。
- 関連は `contentId` から `contentId` への片方向の辺で、逆向きはビルドのときに導く。
- `articles/<series>/` のディレクトリが 1 つのシリーズになる。ディレクトリの入れ子は 1 階層までで、深いと、ビルドが失敗する。
- シリーズのディレクトリは `index.md` を持ち、タイトルと説明を書く。ないと、ビルドが失敗する。
- シリーズの中の記事は `order` を書き、1 つのシリーズの中で重ならない。書いていないか重なると、ビルドが失敗する。
- シリーズに入れない記事（`articles/` の直下）は `order` を書かない。書くと、ビルドが失敗する。
- `format` は `page` だけを受け付ける。ほかの値を書くと、ビルドが失敗する。
- 記事の追加は、Markdown の 1 枚の作成で完結する。新しいシリーズを作るときだけ、`index.md` を足す。索引のページを手で直さない。

## Prohibitions

- 公開した後に `contentId` を変えない。URL を変えても関連が切れないよう、`contentId` を関係の主キーにしている。
- `related` を両方のコンテンツに書かない。片方の書き忘れで不整合が出る。
- 直下の記事を、後でシリーズへ移すつもりで `order` を書かない。
- `articles/` の中のシリーズのディレクトリの下に、さらにディレクトリを作らない。
