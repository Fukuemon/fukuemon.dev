---
contentId: page-check-body-and-figure
title: 本文と図とコードブロック
description: 本文、コードブロック、Mermaid の図の描画を確認する検証用の記事である。
tags: [検証]
status: published
publishedAt: 2026-11-14
order: 1
---

この記事は、記事のページの描画を確認するための検証用の原稿である。
本番の切り替えの前に消す。

## 本文

段落は、1 文を 1 行に書く。
和文の間の改行は、ビルドのときに消える。
和文と English の間の改行は、空白として残る。

- 箇条書きの 1 つ目
- 箇条書きの 2 つ目
  - 入れ子の項目

1. 番号付きの 1 つ目
2. 番号付きの 2 つ目

> 引用の段落である。

文中の `inline code` と、[シリーズに入れない記事へのリンク](/articles/page-check-standalone) を置く。

| 項目 | 値                 |
| ---- | ------------------ |
| 形式 | `page`             |
| 図   | ビルドのときに SVG |

## コードブロック

```ts title="article-pages.ts"
export function articleHref(id: string): string {
  // シリーズの記事は id の先頭がディレクトリ名になる
  return `/articles/${id}`;
}
```

```sh
pnpm --filter @fukuemon/web build
```

## 図

次の図は、原稿が記事のページになるまでを示す。

```mermaid
flowchart LR
    md["原稿 (Markdown)"] --> remark["remark と rehype"]
    remark --> pele["Pele で SVG にする"]
    remark --> ec["Expressive Code"]
    pele --> html["記事の HTML"]
    ec --> html
```
