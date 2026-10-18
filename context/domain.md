---
type: context
title: 業務の知識
description: コンテンツ、種別、contentId、関連、手順、実行パネルなどの用語と、コードの識別子との対応。状態と不変条件は概念ごとに domain/ に置く
status: stable
---

# 業務の知識

## Glossary

- コンテンツ: サイトで公開する記事、ハンズオン、playground の総称。
  - 本文は `apps/web/src/content/` の Markdown か MDX に置く。
- 種別: 記事とハンズオンの 2 つ。URL を分ける単位で、増やさない。
  - 記事はディレクトリ `articles/` と URL `/articles/<path>`、schema `articleSchema` に対応する。
  - ハンズオンはディレクトリ `labs/` と URL `/labs/<path>`、schema `handsOnSchema` に対応する。
- playground: 遊び場。ディレクトリ `playgrounds/` と URL `/playground/<id>` に対応する。
- セクション: サイトを分ける about、blog、playground の 3 つ。
- 分類: 主題を示す自由な語。frontmatter の `tags` に書き、索引のページを持たない。
- `contentId`: コンテンツの安定した識別子。ファイルのパス、URL、ストレージから独立する。
  - Astro の `id` とは別に持つ。
- 関連: あるコンテンツから別のコンテンツへの、著者が明示した参照。frontmatter の `related` に相手の `contentId` を書く。
- 逆参照: 片方向に書いた関連から、ビルドのときに導く逆向きの関連。
- `ContentRef`: 種別の違うコンテンツを、一覧で一様に扱うために正規化した表現。
- 手順: ハンズオンを区切る単位。本文の `h2` が境界になり、進捗を保存する単位になる。
- 実行パネル: 本文の中でコードを実行するコンポーネント。`run` を付けたコードフェンスから作る。
- 手を動かす場所: ハンズオンの frontmatter の `interactive.level`。`embedded`（ページの中）と `local`（読者の端末）がある。
  - `sandbox`（WebContainers と WebVM）は設計だけを決めてある。
  - ADR-0006: [手を動かす場所の 4 分類](../adr/0006-interactive-content-levels.md)
- 実行環境: `embedded` のハンズオンでコードを動かす環境。frontmatter の `interactive.runtime` で選ぶ。
- `setup`: `embedded` のハンズオンで、実行パネルが最初に 1 度だけ流す準備のコード。

## Concepts

- [コンテンツ](domain/content.md): `contentId`、公開の状態、関連が守る条件
- [ハンズオン](domain/hands-on.md): 手を動かす場所、手順、進捗が守る条件
