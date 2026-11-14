---
contentId: page-check-series-links
title: シリーズの前後のリンク
description: シリーズの 2 本目として、前の記事へのリンクを確認する検証用の記事である。
tags: [検証]
status: published
publishedAt: 2026-11-14
order: 2
---

この記事は、シリーズの 2 本目の検証用の原稿である。
ページの下に、シリーズの名前、シリーズの中の位置、前の記事へのリンクが出る。

## シーケンス図

```mermaid
sequenceDiagram
    participant B as ブラウザ
    participant W as Worker
    B->>W: GET /articles/page-check/series-links
    W-->>B: 200 静的な HTML
```
