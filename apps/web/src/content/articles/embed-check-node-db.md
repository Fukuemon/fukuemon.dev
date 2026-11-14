---
contentId: embed-check-node-db
title: Node のコードから DB に接続する記事
description: 記事の中で開いた Node の実行環境から、pg で DB に接続し、SQL のペインと同じ DB を読み書きできることを確認する検証用の記事である。
tags: [検証]
status: published
publishedAt: 2026-11-13
---

この記事は、Node のコードから DB に接続する実行環境を埋め込む検証用の原稿である。
ボタンを押すと、`sessions` のテーブルを持つ DB と、3000 番のポートで一覧を返すサーバーが動く。

```playground
node-pg
```

端末で、次のコマンドを実行できる。

- `node pool.js`: 引数なしの `new Pool()` で、行を追加してから数える。
- `node url.js`: `process.env.DATABASE_URL` を渡した `Pool` で、一覧を読む。
- `node client.js`: `new Client()` で接続し、3 つのクエリを実行する。

右下の SQL のペインは、Node のコードと同じ DB に SQL を送る。
