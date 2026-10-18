---
type: feature-design
title: 挿絵
description: 版画風の挿絵の版の仕様、図柄と向く場所、帯の重ね順と上端、文字を重ねるときの霞、生成器と ArtBand の使い方
status: stable
governs:
  - packages/design-system/art/
  - apps/web/src/components/ArtBand.astro
verified_commit: 01101c7
---

# 挿絵

## Overview

挿絵は、技術資料の版面に足す、版画風の自然の図版である。  
装飾を担うのは挿絵と差し色だけで、挿絵は情報を運ばない。  
Design System の全体は [Design System の Design Doc](../DesignDoc.md) にある。

## Scope

持つものは次のとおり。

- 5 つの図柄に共通する版の仕様
- 図柄と、それぞれが向く場所
- 帯の重ね順と、帯の上端の処理
- 挿絵の上に文字を重ねるときの霞

持たないものは次のとおり。

- 色の値。`--color-wood-*` と `--color-veil-*` の値は [tokens.css](../styles/tokens.css) が持つ。
- 帯が現れるときの動き。規則は [Design System の Design Doc](../DesignDoc.md#動き) にある。
- 配色を切り替える書き方の規則。[context/conventions.md](../../../context/conventions.md#配色の切り替え) にある。

## Design

### 外部の画像ファイルを持たない

挿絵は、`art/` の SVG をビルドのときにページへ埋め込む。  
3 階調は `--color-wood-1`、`--color-wood-2`、`--color-wood-3` を `fill` と `stroke` から参照する。  
配色を切り替えると、挿絵の色も一緒に変わる。

SVG はパラメータから `generate.py` が組み、画像生成を経由しない。

### 版の仕様

5 つの図柄は、次の表の版の仕様を共有する。  
数値は `generate.py` の `defs()` と、[utilities.css](../styles/utilities.css) の `.wood-grain` が持つ。

| 要素       | 実装                                                                                    | 目的                           |
| ---------- | --------------------------------------------------------------------------------------- | ------------------------------ |
| 輪郭の荒れ | `feTurbulence` と `feDisplacementMap`。水面だけ変位を小さくする                         | 刷りのずれ。刷ったものに見せる |
| 霧         | 縦のグラデーションを `mask` に掛ける。下端が濃く、上端で紙へなじむ                      | 上端で紙へなじませる           |
| 粒         | CSS の層に置いた turbulence のタイル。明るい配色で multiply、暗い配色で screen で重ねる | 紙の目                         |
| 3 階調     | 遠景 `--color-wood-3`、中景 `--color-wood-2`、近景 `--color-wood-1`                     | 奥行き                         |
| 断ち落とし | `preserveAspectRatio="xMidYMax slice"`                                                  | 帯の高さに関わらず下端を保つ   |

viewBox は `0 0 1200 400` にする。  
縦長のパネルに使う竹（`bamboo_tall.svg`）だけは、縦長の viewBox を持つ。

**粒を SVG フィルタで作らない**。  
`feFlood flood-color="var(--color-wood-1)"` は CSS カスタムプロパティを解決しない。  
粒は CSS の層に置く。

**帯の下端では、粒に継ぎ目が出る**。  
`.wood-grain` は `mask-image` で下端の粒を消す。

### 帯の重ね順

`ArtBand` は、`.wood-band` の中に、下から挿絵の SVG と粒（`.wood-grain`）を重ねる。  
帯は `position: relative` と `overflow: hidden` を持ち、SVG は `position: absolute; inset: 0` で帯を埋める。  
帯の中に文字を重ねるときは、粒の上に霞（`.wood-veil`）を、その上に文字（`.wood-fg`）を置く。

`ArtBand` は、SVG の `role="img"` と `aria-label` を外し、帯に `aria-hidden="true"` を付ける。  
挿絵は装飾であり、読み上げに渡さない。

### 文字を重ねるとき

挿絵の上に文字を直接置かない。  
**地の色そのものを透過させた霞（`--color-veil-1` から `--color-veil-0`）を挟み、文字は必ず無地の紙の上に載せる**。  
挿絵の濃さに関わらず、文字のコントラストは `--color-ink` と `--color-paper` の比に固定される。

霞は横方向のグラデーション（`linear-gradient(96deg, ...)`）である。  
挿絵が右へ寄り、文字が左に載る配置を、この霞が作る。

**720px 以下では、霞を縦方向へ掛け直す**。  
本文が版面の全幅を使うので、横方向のままだと図の枝が文字に掛かる。

about は、帯の外に `.about__veil` を重ね、文字を帯の兄弟の要素に置く。  
霞の範囲は `apps/web/src/styles/site.css` の `.about__veil` が持つ。

### 図柄

| 名前   | ファイル                        | 特徴                         | 向く場所              |
| ------ | ------------------------------- | ---------------------------- | --------------------- |
| 木立   | `woodland.svg`                  | 幹と枝。手前を斜面が横切る   | about（トップの表紙） |
| 竹     | `bamboo.svg`、`bamboo_tall.svg` | 節を地の色で切る。縦に強い   | 縦長のパネル          |
| 水面   | `ripple.svg`                    | 同心の波紋の群れと、浮かぶ葉 | 章の切れ目            |
| 遠い山 | `ridge.svg`                     | 稜線の重なり。最も静か       | 静かな表紙            |
| 草     | `grass.svg`                     | 穂を持つ葉。最も細かく密     | 末尾、細い帯          |

挿絵の帯を置くのは次の 2 箇所。
帯の高さは、置く側が `ArtBand` の props で決める。

- トップの about: 木立を `fill` で about の全体に広げる（`apps/web/src/features/about/About.astro`）
- トップの末尾: 草を `fade` で置く（`apps/web/src/pages/index.astro`）

**140px 以下の細い帯には密な図柄を使う**。  
`xMidYMax slice` は下端の付近だけを残す。  
木立のように要素が縦に伸びる図柄は、細い帯では幹の根元しか映らず、左右に空白ができる。  
草は、どの高さで断っても幅いっぱいが埋まる。

### 帯の上端

図の霧（`mask`）は viewBox の全体に掛かる。  
**帯が低いと霧の範囲が映らず、切り口が直線で出る**。  
直線の切り口は、絵ではなく区切りに見える。  
低い帯では、帯の側でも上端を紙へなじませる（`ArtBand` の `fade`）。

低い帯で霧を見せようとして、図の停止点を動かさない。  
動かすと、`fill` で使ったときに図が全体に薄くなる。

## Interface

### 置くファイル

- `packages/design-system/art/<図柄>.svg`: 図柄ごとの SVG
- `packages/design-system/art/generate.py`: 版の仕様を共有して SVG を組む生成器
- `apps/web/src/components/ArtBand.astro`: SVG を帯として描くコンポーネント

`@fukuemon/design-system` は、`package.json` の `exports` の `./art/*` で SVG を出す。  
`ArtBand` は `?raw` で SVG を文字列として読み込む。

### ArtBand の props

| prop     | 意味                                                         |
| -------- | ------------------------------------------------------------ |
| `motif`  | 図柄の名前。`woodland`、`bamboo`、`grass`、`ridge`、`ripple` |
| `height` | 帯の高さ                                                     |
| `fill`   | 親の全体に広げる。`height` を使わない                        |
| `fade`   | 帯の上端を紙へなじませる                                     |

`motif` の `bamboo` は、縦長の `bamboo_tall.svg` を描く。

### 生成器

`generate.py` は、実行したディレクトリに図柄ごとの `_art_<図柄>.svg.frag` を書き出す。  
`art/` の SVG は、その出力を図柄の名前で置いたものである。

### チェック

挿絵は、見た目の回帰のテストの対象にしない。  
乱数による刷りのずれを含むので、画素の比較が安定しない。
