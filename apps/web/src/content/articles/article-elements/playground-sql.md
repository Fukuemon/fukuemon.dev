---
contentId: article-elements-playground-sql
title: 記事の中で動かせる SQL のツール
description: 記事の中のボタンで SQL のツールを開き、初期データに対してクエリを実行する仕組みと、外部の画像を置いたままにできる理由を説明する。
tags: [記事の構成要素, 実行環境]
status: published
publishedAt: 2026-11-13
order: 6
---

この記事は、シリーズ「このサイトの記事で使われる構成要素」の 6 本目である。
SQL のツールは、初期データを持つ DB に対して、記事の中でクエリを実行できる。

## 開いて動かす

次の枠のボタンを押すと、SQL のツールが開く。

```playground
sql-orders
```

## 外部の画像が残る

SQL のツールは、cross-origin isolation を求めない。
そのため、この記事は、cross-origin isolation のヘッダを返さない。
Node の記事と違い、別の origin の画像を置ける。

![カタログのアイコン](https://design.fukuemon.dev/favicon.svg)

上の画像は、`Cross-Origin-Resource-Policy` を返さない別の origin の画像である。
ボタンを押した後も、画像は表示されたまま残る。

## 書く人向けの置き方

- SQL のツールは、`playground.json` に `"tool": "sql"` と `initialSql` を書く。
- 外部の画像を置く記事には、Node の実行環境を置かない。
