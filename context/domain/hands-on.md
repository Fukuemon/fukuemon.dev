---
type: context
title: ハンズオン
description: 手順と進捗の遷移、手を動かす場所ごとにページに出るもの、実行環境の不変条件、著者と開発者がしてはいけないこと
status: stable
---

# ハンズオン

形式、実行環境、実行環境を足す手順の設計は [ハンズオンと Interactive の Design Doc](../../apps/web/src/features/lab/DesignDoc.md) にある。

## States and Transitions

- 本文の 1 つの `h2` が 1 つの手順になり、1 画面に出る。
  - 最初の `h2` より前の本文は、「はじめに」の画面になる。
  - 読者は、サイドバーと前後のボタンで手順を切り替える。
- `embedded` のハンズオンでは、手順の中の実行パネルで実行が成功すると、その手順が完了になる。
  - 最初の `h2` より前に置いた実行パネルは、どの手順も完了にしない。
- `local` のハンズオンでは、読者が通り過ぎた手順に完了の印が付く。
- 進捗は、読者のブラウザの `localStorage` に `contentId` と手順の index で保存し、再訪したときに戻す。
- 実行環境のデータはメモリに置く。再読み込みすると初期の状態に戻る。
  - 「初めから」を押すと、`setup` を流し直す。

## Invariants

- `interactive.level` が、ページに置くものを決める。
  - `embedded` は実行パネルを置き、本文は `.mdx` で書く。
  - `local` は clone と起動の手順を置き、本文は `.md` で書く。ページに JavaScript を配らない。
- `run` を付けたフェンスを `.md` に書くと、ビルドが失敗する。
- schema は、実装した `interactive.runtime` の値だけを受け付ける。`sandbox` も受け付けない。
  - 先に受け付けると、ビルドを通ったコンテンツが、読者が押したときに初めて失敗する。

## Prohibitions

- 手順の数を frontmatter に書かない。本文と食い違う。
- 実装していない実行環境と `sandbox` を、schema に先回りして足さない。足すのは実装するときにする。
