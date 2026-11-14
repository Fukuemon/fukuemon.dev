---
contentId: embed-check-sql
title: SQL のツールを埋め込む記事
description: 記事の中で SQL のツールを開けることと、開いた後も外部の画像が表示されたままであることを確認する検証用の記事である。
tags: [検証]
status: published
publishedAt: 2026-11-13
---

この記事は、SQL のツールだけを埋め込む検証用の原稿である。
SQL のツールは cross-origin isolation を求めないので、この記事には cross-origin isolation のヘッダを返さない。

![カタログのアイコン](https://design.fukuemon.dev/favicon.svg)

上の画像は、CORP を返さない別の origin の画像である。
ボタンを押した後も、画像は表示されたまま残る。

```playground
sql-orders
```
