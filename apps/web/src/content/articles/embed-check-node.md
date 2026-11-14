---
contentId: embed-check-node
title: Node の実行環境を埋め込む記事
description: 記事の中で、初期ファイルを持つ Node の実行環境を開けることを確認する検証用の記事である。
tags: [検証]
status: published
publishedAt: 2026-11-13
---

この記事は、Node の実行環境を埋め込む検証用の原稿である。
ボタンを押すと、`index.js` と `package.json` を持つ実行環境が開き、3000 番のポートでサーバーが動く。

```playground
node-server
```

ボタンを押すまで、ブラウザは実行環境へのリクエストを送らない。

## 認可コードフロー

次の実行環境は、モックの認可サーバー（4000 番）とクライアント（3000 番）を動かす。
プレビューで「認可サーバーでログインする」を押し、認可サーバーの画面で「許可する」を押すと、HTTP の一覧に 8 件のやり取りが起きた順に並ぶ。

```playground
oauth-code-flow
```
