---
type: context
title: 業務の知識
description: コンテンツ、記事、形式、シリーズ、contentId、関連などの用語と、コードの識別子との対応。状態と不変条件は概念ごとに domain/ に置く
status: stable
---

# 業務の知識

## Glossary

- コンテンツ: サイトで公開する記事。本文は `apps/web/src/content/articles/` の Markdown か MDX に置く。
- 記事: コンテンツの唯一の種別。ディレクトリ `articles/` と URL `/articles/<path>`、schema `articleSchema` に対応する。
  - ADR-0030: [種別を記事の 1 つにし、構成を記事の形式で、シリーズをディレクトリで表す](../docs/adr/0030-articles-format-and-series.md)
- 形式: 記事の構成。frontmatter の `format` に書く。受け付ける値は、実装した `page`（1 ページ）だけで、省くと `page` になる。
- シリーズ: 1 つの主題にまとめた記事の集まり。`articles/<series>/` のディレクトリに対応し、タイトルと説明を `index.md` に書く。
  - schema は `seriesSchema` である。
- `order`: シリーズの中の記事の読む順。frontmatter に書く整数で、小さいほど前になる。
- プレイグラウンド: 訪問者がコードを自由に書いて動かせる場所。`play.fukuemon.dev` に置き、`apps/web` のコンテンツには含めない。
- セクション: サイトを分ける about、blog、playground の 3 つ。
- 分類: 主題を示す自由な語。frontmatter の `tags` に書き、索引のページを持たない。
- `contentId`: 記事の安定した識別子。ファイルのパス、URL、ストレージから独立する。
  - Astro の `id` とは別に持つ。
- 関連: ある記事から別の記事への、著者が明示した参照。frontmatter の `related` に相手の `contentId` を書く。
- 逆参照: 片方向に書いた関連から、ビルドのときに導く逆向きの関連。
- `ContentRef`: 記事を、一覧で一様に扱うために正規化した表現。

## Concepts

- [コンテンツ](domain/content.md): `contentId`、公開の状態、関連、シリーズが守る条件
