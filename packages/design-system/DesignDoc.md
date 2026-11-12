---
type: feature-design
title: Design System
description: サイト全体の動きの規則とトップの庭の例外、記事の図を SVG にする方針、トークンとコンポーネントと挿絵とページの骨格の所在
status: stable
---

# Design System

## Overview

サイトの画面は、`packages/ui`（`@fukuemon/ui`）のトークンとコンポーネントで組む。  
トークン、テーマ、色、文字、余白、コンポーネント、カタログの設計は [デザインシステム（packages/ui）の Design Doc](../ui/DesignDoc.md) に、画面を作るときの原則と手順は [packages/ui の DESIGN.md](../ui/DESIGN.md) にある。  
この文書は、サイト全体の動きの規則と、その例外のトップの庭を持つ。  
全体の構成は [Design Doc](../../design/DesignDoc.md#components) にある。

ADR-0024: [トークンを、fukuemon.dev の値のプリミティブトークン、セマンティックトークン、テーマ変数の 3 つの層にし、生成りの地と旧サイトの差し色で、角丸と影を使わない版面にする](../../adr/0024-tokens-of-fukuemon-dev.md)

## Scope

持つものは次のとおり。

- サイト全体の動きの規則
- トップの庭を動きの規則の例外にする範囲
- 記事の図を SVG にする方針
- トークン、コンポーネント、挿絵、ページの骨格の設計の所在

持たないものは次のとおり。

- トークン、テーマ、色、文字、余白、コンポーネントの設計。[デザインシステム（packages/ui）の Design Doc](../ui/DesignDoc.md) が持つ。
- 動きの時間と緩急のユーティリティと、動きを減らす設定での止め方。[デザインシステム（packages/ui）の Design Doc の「動き」](../ui/DesignDoc.md#動き) と [トークンの文書](../ui/design/tokens.md#レイアウト区切り重なり動き) が持つ。
- 挿絵の図柄と版の仕様。[挿絵の Design Doc](art/DesignDoc.md) が持つ。
- イントロの各段の時間と、庭の見た目の数値。[トップの水墨の門と立体の庭の Design Doc](../../design/features/top-garden/DesignDoc.md) が持つ。

## Design

### 動き

**動きは、状態の変化を伝えるときだけに使う**。  
規則はサイト全体で共通である。

- 位置を動かさない。位置が動くと、罫の位置が確定するまで読み始められない。
- 動きのために配る JavaScript は 0 バイトにする。
- 5 秒を超えて続く動きは、5 秒以内に止める。WCAG 2.2 の 2.2.2 は、自動で始まり、5 秒を超えて続き、ほかの内容と並んで出る動きに、止める手段を求める。
  - 出典: [Understanding SC 2.2.2: Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)

OS で動きを減らす設定にした訪問者への止め方は、[デザインシステム（packages/ui）の Design Doc の「動き」](../ui/DesignDoc.md#動き) にある。

#### トップの庭の例外

**トップの庭は、位置を動かさない規則と、配る JavaScript を 0 バイトにする規則の例外にする**。  
庭は 2 回目以降の訪問にも出すので、例外は最初の訪問に限らない。  
動きを減らす設定のときは、庭を出さず、同じ本文をふつうのページとして出す。

- three を配る。場面の束は別のファイルにし、庭を出すときだけ読み込む。
- カメラが動く。最初の訪問で門をくぐるときと、文から文へ移るときに動く。
- 舞う物（桜の花びら、蛍、紅葉、雪）が動き続ける。庭の中の「動きを止める」のボタンで止める。
- 最初の訪問だけに、約 8 秒のイントロを出す。イントロは画面の全体を使い、ほかの内容と並ばない。「飛ばす」のボタンと Esc と Tab で、動かさずに最後の状態にする。

イントロと舞う物は、5 秒以内に止める規則の例外にする。  
イントロは、画面の全体を使ってほかの内容と並ばず、「飛ばす」のボタンで止められるためである。  
舞う物は、「動きを止める」のボタンで止められるためである。

ADR-0026: [トップの最初の訪問で水墨の門を描き、門をくぐった立体の庭にプロフィールを置く](../../adr/0026-sumi-gate-and-garden-on-top.md)  
イントロの各段の時間は [トップの水墨の門と立体の庭の Design Doc](../../design/features/top-garden/DesignDoc.md) にある。

### 配布と層

トークンは、プリミティブトークン、セマンティックトークン、テーマ変数の 3 つの層に分ける。  
層ごとのファイルと、パッケージの外へ出すファイルは、[デザインシステム（packages/ui）の Design Doc の「トークンの層」](../ui/DesignDoc.md#トークンの層) と「Interface」にある。

### ページごとの骨格

サイトの帯、記事の一覧の行、プレイグラウンドの画面の配置は、Domain のコンポーネントにし、`apps/web/src/features/<機能>/components/` に置く。  
`packages/ui` には、ドメインを持たない Base と Case のコンポーネントだけを置く。  
分け方は [デザインシステム（packages/ui）の Design Doc の「コンポーネントの分類と置き場」](../ui/DesignDoc.md#コンポーネントの分類と置き場) にある。

### 当たり判定と読み上げ

押せる領域の大きさ、フォーカスの表示、コントラストの基準は、[packages/ui の DESIGN.md の「アクセシビリティ」](../ui/DESIGN.md#アクセシビリティ) にある。  
押せる領域は 44×44 CSS px 以上にする（`TARGET-SIZE`）。

### 図

記事の `mermaid` のコードフェンスは、ビルドのときに Pele で SVG にする。  
ページに、図を描くための JavaScript を配らない。

ADR-0016: [mermaid の図を、ビルドでも島でも Pele で SVG にする](../../adr/0016-render-mermaid-with-pele.md)

### 挿絵

挿絵を置く場所、図柄、版の仕様は、[挿絵の Design Doc](art/DesignDoc.md) にある。

## Verification

記事のコードブロックの Expressive Code は、セマンティックトークンから生成したコードのテーマを読む。  
テーマの作り方と、生成物のずれのチェックは、[デザインシステム（packages/ui）の Design Doc の「コードの色」](../ui/DesignDoc.md#コードの色) にある。
