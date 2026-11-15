---
contentId: article-elements-playground-node-db
title: Node のコードから DB に接続する
description: 記事の中の Node の実行環境から、pg で DB に接続し、同じ DB を SQL のペインからも読み書きできることを、実物を使って説明する。
tags: [記事の構成要素, 実行環境]
status: published
publishedAt: 2026-11-13
order: 5
---

この記事は、シリーズ「このサイトの記事で使われる構成要素」の 5 本目である。
Node の実行環境には、DB を付けられる。
DB に接続するコードを、記事の中で動かして確認できる。

## 開いて動かす

次の枠のボタンを押すと、`sessions` のテーブルを持つ DB と、3000 番のポートで一覧を返すサーバーが動く。

```playground
node-pg
```

## 端末で試す

端末で、次のコマンドを実行できる。

- `node pool.js`: 引数なしの `new Pool()` で、行を追加してから数える。
- `node url.js`: `process.env.DATABASE_URL` を渡した `Pool` で、一覧を読む。
- `node client.js`: `new Client()` で接続し、3 つのクエリを実行する。

## SQL のペインと同じ DB

プレビューの隣の「SQL」のタブは、Node のコードと同じ DB に SQL を送る。
`node pool.js` で追加した行は、SQL のタブで `select user_name from sessions order by id;` を実行すると、結果に出る。

## 書く人向けの置き方

- `playground.json` に `"database": true` を書き、初期データの SQL のファイルのパスを `initialSql` に書く。
- `package.json` の依存に `pg` を書く。
- 接続先は、コードに書かない。`new Pool()` か、`new Pool({ connectionString: process.env.DATABASE_URL })` と書く。実行環境が、接続先を環境変数（`PGHOST`、`PGUSER`、`PGDATABASE`、`DATABASE_URL`）で渡す。
- `host: "localhost"` と `port: 5432` では接続できない。実行環境は、TCP で待ち受けないためである。
