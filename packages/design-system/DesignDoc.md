---
type: feature-design
title: Design System
description: Design Tokens の層と使用制約、Typography、縦組み、色、余白と測度、版面、動き、アイコン、Tailwind の層と Expressive Code への橋渡し。挿絵は art/ の Design Doc が持つ
status: stable
governs:
  - packages/design-system/
  - apps/web/src/styles/
verified_commit: unverified
---

# Design System

## Overview

Design System は、技術資料としての硬質さを基礎にし、そこへ版画的な自然の図版と縦組みの見出しを足す。  
装飾は挿絵と差し色だけが担い、情報を運ぶ要素は罫線と余白で組む。  
全体の構成は [Design Doc](../../design/DesignDoc.md#components) にある。  
ADR-0004: [Typography の判断](../../adr/0004-typography-static-weights.md)  
ADR-0010: [Tailwind CSS の採用](../../adr/0010-tailwind-as-styling-base.md)

## Scope

持つものは次のとおり。

- Design Tokens（primitive と semantic）を `@theme static` で定義し、`:root` の CSS カスタムプロパティとして出力する
- Typography、縦組み、色、余白、Grid の値
- 明るい配色と暗い配色の両方
- 動きの規則と、退行したときの見え方
- アイコンを使ってよい範囲
- 版面のユーティリティ（`.g-rail`、`.g-doc`、`.tate`、`.hit`、罫の 3 段階）
- Tailwind の層の順と、状態を markup で書く形

持たないものは次のとおり。

- 汎用の UI コンポーネントのライブラリ。共通化はトークンと版面のユーティリティまでにする。
- Layout primitives のコンポーネント化。
  - `Stack` や `Frame` のような包むコンポーネントを作らず、class で当てる。
  - Astro と React を併用するので、コンポーネントにすると同じものを 2 度書くことになる。
- Portal のコンポーネント（`ContentRow`、`MetaLine` など）。`apps/web/src/features/listing/` のコンポーネントが持つ。
- 挿絵の版の仕様、図柄、帯の重ね順。[挿絵の Design Doc](art/DesignDoc.md) が持つ。
- 状態と配色の切り替えの書き方の規則。[context/conventions.md](../../context/conventions.md#styling) が持つ。

## Design

### デザインの方針

**情報を運ぶ要素は無彩色と罫線だけで組む**。
色を持つのは、挿絵・リンク・現在地マーカーの 3 つに限る。

| 規則                                      | 根拠                                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| カードを使わない                          | 枠を足すと 1 件あたりの視覚的重量が増え、一覧の走査が遅くなる                |
| 区画は罫線と余白で作る                    | 背景色で区切ると、暗い配色では背景どうしの明度差がほとんど取れず区別が消える |
| 罫線は 2px / 1px / 薄い 1px の 3 段階のみ | 段階を増やすと、どれがセクション境界か行境界かを読み取れなくなる             |
| 角丸を使わず、影で奥行きを作らない        | 紙に刷った版面の見えを保つ。角丸と影は画面上の物体を示唆する                 |
| 見出しをほとんど大きくしない              | 階層は small-caps・letter-spacing・罫線で作る                                |
| 状態を色だけで運ばない                    | forced colors mode では色と `box-shadow` が失われる。罫か字形を必ず併せる    |

背景色を塗ってよいのは次の 3 つに限る。
どれも輪郭に 1px 以上の罫を必須とする。
暗い配色では背景どうしの明度差がほとんど取れず、罫がないと境界が消える。

| 背景                       | 用途                        |
| -------------------------- | --------------------------- |
| 反転帯 (`data-band`)       | 読みの区切りに置く強い休符  |
| コード (`--color-code-bg`) | コードブロックとその chrome |
| 面 (`--color-tint-*`)      | コードの強調行、実行エラー  |
| 面 (`--color-panel`)       | 図の箱、写真の下地          |
| 反転 (`--color-ink`)       | ボタン (`.btn`) の hover    |

帯の中では semantic の変数を丸ごと差し替える。

### Typography

| 役割       | 書体                    | ウェイト         | 用途                                      |
| ---------- | ----------------------- | ---------------- | ----------------------------------------- |
| 和文 Serif | **Zen Old Mincho**      | 400 / 600 (静的) | 本文・見出し・UI のすべて                 |
| 欧文 Serif | **EB Garamond**         | 400 / 600 (可変) | 和文と同じ位置。Latin グリフを担当        |
| Mono       | **Geist Mono Variable** | 400 / 600        | 日付・種別・duration・`contentId`・コード |

書体の並びは `tokens.css` の `--font-serif` と `--font-mono` が持つ。  
`--font-serif` は EB Garamond を先に置く。
CSS は左から順にグリフを探すため、Latin は EB Garamond、和文は Zen Old Mincho が担当する。  
`--font-mono` も Geist Mono の次に Zen Old Mincho を置く。
Geist Mono は和文の字を持たないので、置かないと Mono の中の和文だけが OS のゴシックで描かれる。  
`.mono` は `font-variant-numeric: tabular-nums` で一覧の日付の桁を揃える。

**Fontsource で self-host し、外部 CDN から読まない**。  
`apps/web/src/styles/global.css` が、`tokens.css` より前に Fontsource の CSS を import する。  
Fontsource の依存は `apps/web` が持ち、`@fukuemon/design-system` は依存を持たない。  
読み込む CSS は、和文の 400 と 600、EB Garamond の roman と italic、Geist Mono の 5 つである。

可変の EB Garamond と Geist Mono は、1 つのファイルで 400 と 600 の両方を描く。  
ブラウザは、ページの文字に `unicode-range` が一致するスライスだけを取得する。  
フォントのファイルはビルドで `/_astro/` に出力され、サイトと同じオリジンから配信される。  
`apps/web/astro.config.ts` の `build.assetsInlineLimit` は、フォントを base64 で CSS に埋めない。  
埋めると、ページで使わないスライスまで、描画を止める CSS と一緒に配ることになる。

Zen Old Mincho のスライスは、build の後に、サイトの HTML と JS が使う字だけを持つファイルへ作り直す。
処理は `apps/web/src/lib/subset-fonts.ts` の Astro integration が持つ。
スライスの分け方と `unicode-range` は Fontsource のままで、ファイルの名前だけを中身の hash で付け直す。
検索の入力欄に、サイトで使っていない字を打つと、その字だけが `--font-serif` の次の書体で描かれる。
ADR-0004: [Typography の判断](../../adr/0004-typography-static-weights.md)

#### 型スケール

値は [utilities.css](styles/utilities.css) の `@layer base`（`body`、`h2`、`h3`）と、`.display`、`.meta`、`.label`、`.prose` が持つ。

- 大きくするのは表紙の 1 行（`.display`）だけにする。
- `h3` は本文と同じ大きさにし、太さで区別する。
- 日付や種別のような metadata は Mono で小さく組む。
- 節のラベルは small-caps と letter-spacing で区別する。

見出しには `font-feature-settings: "palt" 1` と `line-break: strict` を掛ける。
和文の詰めを適用し、禁則を厳格な側にする。

本文を両端揃え（`text-align: justify`）にしない。`.prose` は、行の高さ 1.75、字間 `.02em`、`overflow-wrap: anywhere` で組む。
字間を広げると、狭い画面で 1 行に入る字が減り、語のまとまりが読み取りにくくなる。

`.prose` の中の段落、リスト、表、コードの間は `--spacing-intra-3` を空ける。
行と行の間（約 12px）より広いので、段落の切れ目が行の切れ目と見分けられる。
`h2` の上は `--spacing-inter-2`、`h3` の上は `--spacing-inter-1` を空け、見出しの下は `--spacing-intra-2` だけにする。
見出しは下の段落と組に見える。

原稿は 1 文 1 行で書くので、和文の間の改行が HTML では空白になる。
`apps/web/src/lib/rehype-ja-linebreak.ts` が、build のときにこの改行を消す。

### 縦組み

節見出しを縦組みにする。

**縦組みへ入れてよいのは和文だけである**。

| 対象                      | 扱い                                                      |
| ------------------------- | --------------------------------------------------------- |
| 和文                      | そのまま正立する (`text-orientation: mixed` の既定)       |
| 3 文字までの数字・略語    | `text-combine-upright: all` で 1 マスにまとめて正立させる |
| 4 文字以上の欧文 (本文)   | 横倒しのまま残す。縦組みの通常の組み方である              |
| 4 文字以上の欧文 (見出し) | `text-orientation: upright` で 1 字ずつ正立させて積む     |
| ロゴなど正立必須の欧文    | **縦組みへ入れない**。 横組みのヘッダに置く               |

**本文では全部を正立させない**。
日本語組版処理の要件 (JLReq) では、縦組みの欧文は 90 度回転が原則である。
`text-orientation: upright` を掛けると `OpenTelemetry Collector` が縦に 21 文字積まれ、帯だけが伸びる。

まとめる長さの上限を 3 文字にするのは、4 文字を超えると 1 マスに収めたとき字が読めなくなるためである。

**見出しだけを例外にする**。
4 文字以上の欧文の見出しは、原則どおり回転させると横倒しのまま残る。
見出しは読み手が節を探すときに最初に当たる語なので、寝かせない。
長さの上限が要らないのは、見出しが数語で終わるためである。

割り振りは `apps/web/src/lib/tate.ts` の `tcy()` が行う。
見出しの例外は `<Tate upright />` で明示する。
著者は本文を書くときに意識しない。

```css
.tate {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-feature-settings:
    "vpal" 1,
    "vkrn" 1;
  line-break: strict;
}
.tcy {
  text-combine-upright: all;
}
```

#### 実装上の制約

**縦組みでは block 軸と inline 軸が入れ替わる**。
`block-size` は「高さ」ではなく「幅」を意味し、`flex-direction: column` は横方向に並ぶ。

規則: **`.tate` は縦組みにする要素そのものにだけ掛け、それを並べる親は横組みのまま置く**。

親に掛けると、位置と寸法の指定がすべて逆の意味になる。
`block-size: 520px` は高さではなく幅として解釈され、版面をその分だけ押し出す。

### Color

**値は [packages/design-system/styles/tokens.css](styles/tokens.css) が持つ**。
本書は値を複写しない。
複写すると実装と二重管理になり、片方が古くなったことに気づけない。

本書が定めるのは、トークンの**層**と**使用制約**である。

| 層        | 例                                                                       | 規則                                       |
| --------- | ------------------------------------------------------------------------ | ------------------------------------------ |
| primitive | `--color-ink` / `--color-green` / `--color-rule-strong`                  | 色そのもの。画面から直接参照しない         |
| semantic  | `--color-fg` / `--color-link` / `--color-now` / `--color-rule`           | 画面はここだけを参照する                   |
| 背景      | `--color-paper` / `--color-panel` / `--color-code-bg` / `--color-tint-*` | 輪郭に 1px 以上の罫を必須とする            |
| 帯        | `[data-band]` が差し替える 6 変数                                        | 帯専用の値。primitive のどれとも一致しない |
| 霞        | `--color-veil-1` / `--color-veil-0`                                      | 地の色そのものを透過させる                 |

**反転帯に入りうる領域では semantic だけを参照する**。
帯は `--color-ink` ではなく `--color-fg` を差し替えて成立する。
帯の中で `--color-ink` を直接参照した要素は、地に沈む。

帯に入らないことが確定している領域では primitive を直接参照してよい。
全画面へ一律に禁じると、守られない規約が文書に残り、自動のチェックを入れられなくなる。

#### コントラスト

**文字と UI 境界に使うトークンは、地（`--color-paper`）に対して WCAG AA（4.5:1）を満たす**。
`--color-rule-soft` だけが例外で、文字にも UI 境界にも使わない。
比は `pnpm run check:contrast` が明暗の両方の配色で計算し、閾値を下回ると失敗する。

反転帯の中では、`--color-rule` を除き、4.5:1 以上にする。
`--color-rule` は罫専用なので、UI コンポーネントの 3:1 で足りる。

#### 使用制約

- `--color-green` / `--color-blue` / `--color-rust` は**線と文字にのみ使う**。
  テキスト色、罫線、下線。
  背景を塗るときは同系の `--color-tint-*` を使う。
  太さ 3px 以下の線と、一辺 9px 以下の印は線として扱う。
  見出しの目印、手順のマーカー、進み具合の棒、一覧の題の上の短い線が該当する
- 各色の用途を固定する。
  数で制限しない。手順を持つ画面では現在地マーカーが複数必要になる

  | 色              | semantic           | 用途                                       |
  | --------------- | ------------------ | ------------------------------------------ |
  | `--color-green` | `--color-link`     | 内部リンク、ハンズオンであること、正常状態 |
  | `--color-blue`  | `--color-link-ext` | 外部リンク                                 |
  | `--color-rust`  | `--color-now`      | 現在地 (ヘッダ / タブ / 手順 / 目次)、注意 |

  外部リンクの判定は `a[href^="http"]` で行う。
  内部リンクは相対パスなので、絶対 URL だけが外を指す。

- `--color-rule-soft` は**情報を持たない区切りにのみ使う**。
  地に対する比が UI 境界の 3:1 に届かず、境界としては見えない。
  一覧の行の区切りのように、消えても情報が失われない場所に限る

#### コードの色

**5 トークンに絞り、輝度を単調な梯子に並べる**。
トークンは `--color-c-plain`、`--color-c-key`、`--color-c-ident`、`--color-c-lit`、`--color-c-com` の 5 つである。
`--color-c-key` は太字、`--color-c-com` は斜体を重ねる。

**装飾を色に重ねる**。
太字と斜体は、色の比が詰まったときの唯一の手掛かりになる。

隣接する 2 トークンの比の閾値は、`check-contrast.ts` の `MIN_LADDER_GAP` が持つ。

**トークンを増やさない**。
同じ明度域に 8 トークンを並べると、隣接比が 1.03 まで詰まる。
色の種類を増やすほど、隣り合う色の区別が消える。

暗い配色では、梯子の下の 2 段の comment と ident の比が最も詰まる。
**ここは斜体の有無だけが手掛かりである**。

#### 訪問済みリンク

読了状態はサイト側で持たず、**CSS の `:visited` に委ねる**。  
ADR-0008: [読者の identity を前提とする機能を作らない](../../adr/0008-no-reader-identity.md)

**`:visited` はプライバシー制限により色系のプロパティしか変えられない**。
下線の色だけを薄くする。
レイアウトや太さを変えようとしても適用されない。

### Spacing

**値は [packages/design-system/styles/tokens.css](styles/tokens.css) が持つ**。

数列を 2 つに分ける。

| 数列                | 用途                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| `--spacing-intra-*` | 節の内側。行間、ラベルと本文、列の溝。`--spacing-intra-0` はボタンや一覧の行の中の、字と罫、字と印 |
| `--spacing-inter-*` | 節の外側。区画の内側、節と節のあいだ                                                               |

**2 つの数列のあいだに段階を置かない**。
この空きが節の境界を作る。
段階を連続させると、どこで話題が変わったかを余白から読み取れなくなる。

余白（`margin`、`padding`、`gap`）に生の px を書かない。
書いた時点で、その値がどちらの数列に属するかが失われる。
罫を重ねるための負の `margin` は余白ではないので除く。
印の大きさ、列の幅、当たり判定のような要素の寸法も対象にしない。

### 測度と Grid

幅の値は [tokens.css](styles/tokens.css) の `:root` が持つ。

| 用途                           | トークン                            | 根拠                               |
| ------------------------------ | ----------------------------------- | ---------------------------------- |
| 本文 (記事 / ハンズオン)       | `--measure`（上限は `--measure-w`） | 日本語で 1 行 40 字前後            |
| 一覧の表、playground、検索の窓 | `--measure-wide`                    | 罫線で区切るため、行長より広く取る |
| 左右の余白                     | `--gutter`                          | 画面の幅に応じて伸び縮みさせる     |

**`ch` を使わない**。
`ch` は文字 `0` の幅であり、CJK グリフの半分以下である。
和文の行長を `ch` で指定すると、意図の半分以下の幅になって折り返す。
`em` を使う。

#### 折り返し

トークンが持つ折り返しは `--breakpoint-wide` と `--breakpoint-narrow` の 2 段だけにする。
markup からは `max-wide:` と `max-narrow:` で当てる。
一覧の表と実行パネルだけは、`apps/web/src/styles/site.css` に、それぞれ専用の折り返しの幅を持つ。

| 幅          | トークン              | 変わること                                                                                   |
| ----------- | --------------------- | -------------------------------------------------------------------------------------------- |
| 1100px 以下 | `--breakpoint-wide`   | 版面を 1 列にし、サイドバーを画面の左から滑り出す引き出しにする                              |
| 720px 以下  | `--breakpoint-narrow` | 縦組みの見出しを横へ倒す。表から分類の列を隠す。上部ヘッダのリンクの余白とロゴの字間を詰める |
| 520px 以下  | なし                  | 表から種類の列を隠す                                                                         |
| 1200px 以上 | なし                  | 記事とハンズオンの実行パネルを本文より右へ広く出す                                           |

**表を横スクロールさせない**。
列を隠す。
一覧は探す場面であり、横に隠れた列は探せない。

**縦組みは 720px を下回ったら横組みへ倒す**。
縦組みの見出しの列（`--rail`）と溝は、狭い画面では本文の幅を大きく削る。

**版面より広く出す囲み (`.bleed`) は、720px を下回ったら出さない**。
親に左の余白しか無いため、負のマージンが右へはみ出す。

**上部ヘッダは字の大きさを保ったまま 360px に収める**。
320px では字だけで 261px を占め、余白を詰めても入らないので、ナビの中を横に流す。

**ページを横に揺らさない**。
`html` に `overflow-x: clip` を置き、はみ出す要素が出てもページは横に動かさない。
はみ出しは、見た目の回帰と、狭い幅で `scrollWidth` が `clientWidth` を超えないかの計測で見つける。

#### 一覧の切り替え

見た目はタブだが、**実体はページ遷移である**。
`/blog` (すべて) / `/blog/articles` / `/blog/labs` の 3 ページを静的に書き出す。
`/` は表紙であり、一覧のタブを持たない。
ARIA の `tablist` は使わない。
根拠は [Design Doc](../../design/DesignDoc.md#種別と分類の切り分け) の設計不変量 8。

- 現在地はヘッダと同じ `--color-rust` の 2px 下線で示す
- タブに件数を添える。
  押す前に結果の量が分かる
- 絞り込み中は列の中身を変える。
  種別を 1 つに絞ったら、行から種別名を外す
- 表の列幅は固定する。
  自動幅にすると題の列だけが伸び、題と種類のあいだに 700px の空白が空く

### 版面

**寸法は [packages/design-system/styles/utilities.css](styles/utilities.css) が持つ**。
本書は構造と、どこに何を割り当てるかを定める。

#### 節の骨格

節は 2 列にする。
左が縦組みの見出し (`--rail`)、右が中身。
溝は `--spacing-intra-4`。

```html
<section style="display: grid; grid-template-columns: var(--rail) minmax(0, 1fr)">
  <h2 class="tate tate-head" style="grid-row: 1 / span 2">ハンズオン</h2>
  <div><!-- 右上: 一覧への導線 --></div>
  <div><!-- 中身 --></div>
</section>
```

見出しは `grid-row: 1 / span 2` で 2 行にまたがる。
`minmax(0, 1fr)` を使う。`1fr` だけだと中身が最小幅を持つとき列が溢れる。

`.tate-head` は右端に 2px の罫を立てる。
**この罫が縦組み見出しの見た目の中心である**。

#### ページごとの骨格

| ページ             | 列                      | 左         |
| ------------------ | ----------------------- | ---------- |
| トップ             | `--rail` + 1fr          | 節見出し   |
| 一覧と遊び場の一覧 | 1 列 (`--measure-wide`) | なし       |
| 記事               | `--drawer` + 1fr        | サイドバー |
| ハンズオン         | `--drawer` + 1fr        | サイドバー |
| 遊び場             | `--drawer` + 1fr        | サイドバー |

**一覧と遊び場の一覧は同じ形にする**。
説明の 1 行、表の順に置き、表は `.tbl` で組む。
ページの題はヘッダの現在地と重なるので、`.sr` の `h1` で読み上げにだけ渡す。

**本文を持つ 3 つのページは同じ骨格にする**。
サイドバーの幅と開閉のふるまいが揃うので、ページをまたいでも操作を覚え直さずに済む。
本文は `--measure-w` で止め、右の余りは版面の中で吸収する。

行長は `--measure-w` で止める。
日本語は 1 行 40〜45 字を超えると行を追いにくくなる。

記事の目次は**罫の長さで章の分量を示す**。
現在地の章だけ 2px の `--color-rust`、他は 1px の `--color-rule-strong`。

**サイドバーはたためる**。
`--drawer` と `--drawer-shut` を `[data-open]` で切り替える。
たたむと開閉ボタンだけが残り、本文が広がる。

**読み込み直後のサイドバーは動かさない**。
HTML には `[data-open]` を書かず、属性が無いあいだは CSS が 1101px 以上で開き、1100px 以下で閉じて描く。
開閉ボタンの直後の inline script が、面より先に保存した状態か画面の幅から `[data-open]` と `aria-expanded` を当てる。
面が描かれる前に状態が決まるので、読み込みのときに面は滑り出さない。
JavaScript が動かないときは、1100px 以下でも面が本文に覆いかぶさらず、開閉ボタンは働かない。

**1100px 以下では、開閉ボタンを画面の左下に固定し、その下に文字を置かない**。
ページの末尾に来る手順の移動と footer は、ボタンの高さの分だけ末尾の余白を足す。

| ページ     | サイドバーの中身            |
| ---------- | --------------------------- |
| 記事       | 目次 + 同じ種別の一覧       |
| ハンズオン | 手順の一覧 + いまのテーブル |
| playground | 試す + いまのテーブル       |

**サイドバーが並べるのは、開いている 1 文書の中身と、同じ種別の兄弟だけである**。
サイト全体のページツリーは持たない。  
ADR-0001: [Starlight の採否](../../adr/0001-starlight-as-docs-renderer.md)

ハンズオンの手順一覧は進捗バーと手順マーカーを持つ。
マーカーは完了 `--color-fg-2` / 現在 `--color-rust` + `outline` / 未着手 `inset` の罫。
**色だけで運ばない**。 完了と現在を `.sr` で読み上げに渡す。

サイドバーの面は sticky にし、起点は上部ヘッダの高さ（`--topbar`）に余白を足した位置にする。

**1101px 以上では、サイドバー自体はスクロールさせない**。 手順が多いときは一覧の中だけを流す。
「いまのテーブル」を画面の外へ押し出さないためである。

#### 罫の割り当て

| class          | 太さと色                  | 割り当て                         |
| -------------- | ------------------------- | -------------------------------- |
| (class なし)   | 2px `--color-rule-strong` | 節の境界                         |
| `.rule-struct` | 1px `--color-rule-strong` | 構造の境界、関連の節             |
| `.rule-row`    | 1px `--color-rule`        | 行の区切り、情報を持たない区切り |

class を持たない罫も同じ 3 段階に従う。
`.topbar` と `.tabs` の下端、表の `th` と `td`、前後ナビと footer の上端が該当する。

`.rule-cap` は罫の端に 1px × 1.4em の縦棒を立てる。
罫が「引かれた」ではなく「置かれた」に見える。

#### 背景色を置く場所

| 背景                       | 置く場所                    |
| -------------------------- | --------------------------- |
| 反転帯 (`data-band`)       | 各ページ 1 箇所まで         |
| コード (`--color-code-bg`) | コードブロックとその chrome |
| 面 (`--color-tint-*`)      | コードの強調行、実行エラー  |
| 面 (`--color-panel`)       | 図の箱、写真の下地          |
| 反転 (`--color-ink`)       | ボタン (`.btn`) の hover    |

反転帯を置いているのは、トップの「最近の更新」だけである。
帯は本文の左右へはみ出させる。
中身より広い帯が休符になる。

**footer は帯にせず、地の色（`--color-paper`）に置いて上端の罫で区切る**。
端を越えて引っぱると、footer の下に地の色が出る。
footer を帯にすると、ページの末尾が 2 色に割れる。
`html` と `body` に同じ地の色を置き、上下どちらの端で引っぱっても同じ色にする。

#### 当たり判定と読み上げ

- 押せる要素は 44px（`--hit`）の当たり判定を確保する。
  行の高さを本文の line-height に任せない。
  WCAG 2.2 の 2.5.8 は 24px を求める。44px は AAA (2.5.5) 相当である
  - `.hit` は、要素そのものの高さを 44px にする
  - 字の大きさと行の高さを変えずに確保するときは、`.hit-up` で疑似要素の当たり判定を上へ 44px まで広げる。
    下へ広げると、次の行の当たり判定に重なる。
    パンくずと「すべて見る →」が該当する
  - 広い画面の版面を変えたくない要素は、触る端末（`pointer-coarse:`）か 1100px 以下（`max-wide:`）に限って 44px にする
  - 本文の段落、項目、表の中のリンクは対象にしない。
    WCAG 2.5.8 は文中のリンクを除外している
- 一覧の表の行だけ 46px。`td` の罫と重なるため 2px 足す
- ページ先頭に `.sr` のスキップリンクを置く。
  **`.sr` はフォーカスで可視へ戻す**。 切り取ったままだと outline も一緒に切り取られ、何も描画されない
- `html` に `scroll-padding-block-start` を置く。
  sticky ヘッダの下へアンカー先とフォーカスが隠れる (WCAG 2.4.11)
- 色だけで運んでいる手順の状態 (完了 / 現在地) は `.sr` で補う
- フォーカスリングは `--color-focus`。
  帯と暗い配色で反転する
- `prefers-reduced-motion: reduce` は `::before` / `::after` も含め、`scroll-behavior` も止める
- `forced-colors: active` で現在地の手掛かりを罫として取得し直す。
  `box-shadow` はこのモードで消える

### 挿絵

挿絵の版の仕様、図柄、帯の重ね順と上端は、[挿絵の Design Doc](art/DesignDoc.md) にある。

### 動き

**動きは状態の変化を伝えるときだけに使う**。
about だけを例外にする。  
ADR-0009: [サイトのセクションと playground](../../adr/0009-site-sections-and-playground-collection.md)

規則はサイト全体で共通である。

| 規則                        | 理由                                                     |
| --------------------------- | -------------------------------------------------------- |
| 位置を動かさない            | 罫の位置が確定するまで読み始められない                   |
| 変えるのは濃度と罫の長さ    | 版面が動かないので、読み手は待たずに読み始められる       |
| 配る JavaScript は 0 バイト | `@starting-style` と `animation-timeline: view()` で組む |

| 対象                         | 動き                               |
| ---------------------------- | ---------------------------------- |
| 一覧の行                     | 濃度。段送りは行の添字で決める     |
| 縦組み見出しの罫             | 上から伸びる (`background-size`)   |
| 挿絵の帯                     | 濃度                               |
| about の名乗り               | 1 字ずつ濃度。字はビルド時に分ける |
| about の一覧                 | 画面に入ったところで行ごとに濃度   |
| サイドバーの面 (1100px 以下) | 左から滑り出す (`transform`)       |

**本文の上に重なる面だけは位置を動かす**。
面の下の本文は動かないので、読み手は待たずに読み続けられる。
どこから出てどこへ戻るかが、開閉ボタンとの対応を示す。
実装は `apps/web/src/components/Side.astro` が持ち、`prefers-reduced-motion: reduce` では動かさない。

**退行の受け皿を必ず持つ**。

- `animation-timeline` は Chrome 115 以降でだけ適用される。対応しない環境では規則ごと無視され、最初から見えている
- `prefers-reduced-motion: reduce` では最初から見えている
- `border-width` を動かさない。レイアウトが動く。罫は `background-size` で伸ばす

`animation` の短縮形で書かない。
ビルドの CSS 圧縮が `animation-timeline` ごと削除する。長い形で書く。

サイドバーの面を除く実装は [apps/web/src/styles/motion.css](../../apps/web/src/styles/motion.css) にある。

### アイコン

**語よりも形のほうが速く見分けられるものにだけ使う**。
現在の対象は外部サービスへのリンク (GitHub / X / Zenn / RSS) だけである。

- ブランドのアイコンは simple-icons (CC0-1.0) の path を写す。RSS は商標ではないので自分で描く
- 塗りは `currentColor`。差し色はリンク側が決める
- 名前は `aria-label` が持ち、`<svg>` は `aria-hidden`
- 当たり判定は 44px を保つ

**ページ内の移動先には使わない**。
「一覧」「遊び場」に定着したアイコンは無く、アイコンにすると語より読むのが遅くなる。

### 図

本文の `mermaid` のコードフェンスは、ビルドのときに Pele で SVG へ変換する。  
ページに描画のための JavaScript を配らない。  
ADR-0016: [mermaid の図を、ビルドでも島でも Pele で SVG にする](../../adr/0016-render-mermaid-with-pele.md)

- 図の色は、`apps/web/src/styles/site.css` が Pele の CSS 変数（`--pele-fg` など）を semantic のトークンへ対応させる。
  - 明暗どちらの地でも、1 枚の SVG が成り立つ。
- 図の角は丸めない。`--pele-radius` を 0 にする。
- 図の書体は、Arial と同じ字幅の総称に固定する。
  - Pele は Node では書体を測れず、組み込みの字幅で箱の大きさを決めるので、本文の書体を流し込むと文字が箱からはみ出す。

著者が図に色を指定しない規則は [context/conventions.md](../../context/conventions.md#記事とハンズオンの本文) にある。  
ADR-0009: [サイトのセクションと playground](../../adr/0009-site-sections-and-playground-collection.md)

### コンポーネント構成 (C4 L3)

```mermaid
flowchart TD
    tokens["packages/design-system/styles/tokens.css<br/>primitive / semantic"]
    utils["packages/design-system/styles/utilities.css<br/>版面・型・当たり判定・縦組み・罫"]
    art["packages/design-system/art/<br/>挿絵の生成器"]
    theme["packages/design-system/code-theme.ts<br/>Expressive Code の配色"]
    global["apps/web/src/styles/global.css<br/>4 本を束ねる入口"]
    site["apps/web/src/styles/site.css<br/>このサイトの部品"]
    motion["apps/web/src/styles/motion.css<br/>動き"]
    tokens --> utils
    tokens --> art
    tokens -. 値を写す .-> theme
    tokens --> global
    utils --> global
    site --> global
    motion --> global
    global --> portal["Portal UI"]
    art --> portal
    theme --> ec["astro-expressive-code"]
```

**コンポーネントの CSS は `apps/web` に置く**。
`packages/design-system` が配るのはトークンと版面までにする。
1 サイトでしか使わないコンポーネントを package へ上げると、変更のたびに 2 つの repo 境界をまたぐ。

### 配布と層

CSS スタイリングの基盤は Tailwind CSS v4 である。  
ADR-0010: [Tailwind CSS の採用](../../adr/0010-tailwind-as-styling-base.md)

```css
/* apps/web/src/styles/global.css */
@layer theme, base, components, utilities;

@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);

@import "@fontsource/zen-old-mincho/400.css";
@import "@fontsource/zen-old-mincho/600.css";
@import "@fontsource-variable/eb-garamond/wght.css";
@import "@fontsource-variable/eb-garamond/wght-italic.css";
@import "@fontsource-variable/geist-mono/wght.css";

@import "@fukuemon/design-system/tokens.css";
@import "@fukuemon/design-system/utilities.css";
@import "./site.css";
@import "./motion.css";
```

| 層           | 中身                                             |
| ------------ | ------------------------------------------------ |
| `theme`      | Tailwind の既定と `@theme static` のトークン     |
| `base`       | 要素の既定 (`body` / `a` / `h1, h2, h3` / `pre`) |
| `components` | コンポーネント。markup では表せないものだけ      |
| `utilities`  | Tailwind の utility                              |

**utility を最後に置く**。 markup 側の 1 語がコンポーネントの規則に勝つ。

**preflight を読み込まない**。
本文の段落間隔は UA 既定の `margin-block: 1em` に依存しており、preflight はそれを 0 にする。
ただし **border の初期化だけは `base` に自前で持つ**。
`border-width: 0; border-style: solid` が無いと、`border-b` を当てた要素の
他 3 辺に `medium` (3px) の枠が付く。

**版面とコンポーネントのクラスを `@utility` にしない**。
`@utility` は utilities 層に入り、`[data-open="false"].g-doc` のような状態つきの上書きにも、
`.g-rail > .tate-head` の狭い画面の上書きにも勝つ。
ADR-0010: [Tailwind CSS の採用](../../adr/0010-tailwind-as-styling-base.md)

**第三者の CSS が使う class 名を避ける**。
Expressive Code は `.expressive-code` 以下を使う。
そこへは触らず、スタイリングは `styleOverrides` から指定する。
**上書きが要るときは cascade layer の外に置く**。
Expressive Code の CSS は層に属さないので、層の中からは詳細度でも勝てない。

### 状態の書き方

状態を markup のバリアントで書く規則は [context/conventions.md](../../context/conventions.md#状態の書き方) にある。

#### 配色の切り替え

色は `light-dark(明, 暗)` で書き、どちらを解決するかは `color-scheme` が決める。  
書き方の規則は [context/conventions.md](../../context/conventions.md#配色の切り替え) にある。

| 選択子  | `color-scheme` | 役割               |
| ------- | -------------- | ------------------ |
| `:root` | `light dark`   | システム設定に追随 |

**`color-scheme` を宣言する**。
スクロールバーとフォームのコントロールの既定色は、この宣言でしか切り替わらない。
宣言しないと、暗い配色でページ本体だけが暗くなり、UA 由来の UI は明るいまま残る。

全ページが自前のレイアウトを通るため、宣言は `tokens.css` の `:root` と、`SiteLayout` の `<meta name="color-scheme">` で足りる。

### トークン共有の必要条件

トークンは `@theme static` に置く。
`--color-paper` は `bg-paper` / `text-paper` を生み、同時に `var(--color-paper)` として残る。
`--breakpoint-*` の値は「その幅から上」を指すので、`max-narrow:` は `max-width: 720.98px` になる。

**`static` を付ける**。
付けないと、utility から参照された変数しか出力されない。
挿絵の SVG は `fill="var(--color-wood-1)"` で色を参照するので Tailwind の走査に映らず、
3 階調が消える。

`astro-expressive-code` が挿す CSS は、こちらのビルドを通らない。
`styleOverrides` から参照できるのは素の CSS カスタムプロパティだけである (設計不変量 5)。
`@theme` は変数を `:root` に出すので、この条件を満たす。

### Expressive Code への橋渡し

コードブロックだけは `astro-expressive-code` が描く。
スタイリングは class を上書きせず、`styleOverrides` から指定する。

```ts
// apps/web/astro.config.ts
import expressiveCode, { ExpressiveCodeTheme } from "astro-expressive-code";
import { codeThemeDark, codeThemeLight } from "@fukuemon/design-system/code-theme";

expressiveCode({
  // --color-c-* を写した自前のテーマ
  themes: [new ExpressiveCodeTheme(codeThemeLight), new ExpressiveCodeTheme(codeThemeDark)],
  minSyntaxHighlightingColorContrast: 0,
  styleOverrides: {
    borderColor: "var(--color-rule-strong)",
    borderRadius: "0",
    codeBackground: "var(--color-code-bg)",
    codeFontFamily: "var(--font-mono)",
    frames: {
      frameBoxShadowCssValue: "none",
      editorTabBarBackground: "var(--color-code-bg)",
      editorActiveTabBackground: "var(--color-code-bg)",
      editorActiveTabIndicatorTopColor: "var(--color-green)",
      editorActiveTabBorderColor: "var(--color-rule-strong)",
      editorBackground: "var(--color-code-bg)",
      terminalBackground: "var(--color-code-bg)",
      terminalTitlebarBackground: "var(--color-code-bg)",
      tooltipSuccessBackground: "var(--color-green)",
    },
    textMarkers: {
      markBackground: "var(--color-tint-green)",
      markBorderColor: "var(--color-green)",
      lineMarkerAccentWidth: "2px",
    },
  },
});
```

**テーマは自前で持つ**。
既製のテーマを使うと、地を `--color-code-bg` へ差し替えたときに比が崩れる。
GitHub のテーマで測ったところ、コメントが明 4.15 / 暗 3.48、`const` が明 3.95 で AA を下回った。

実装は [packages/design-system/code-theme.ts](code-theme.ts) にある。
**値は `tokens.css` の `--color-c-*` と同じである**。
Shiki はビルド時に色を解決するため CSS カスタムプロパティを参照できない。
片方を変えたらもう片方も変える。

`minSyntaxHighlightingColorContrast` は 0 にする。
自前で 4.5:1 を満たしているので、自動の補正が、輝度の梯子の並びを変えてしまう。

実行パネル (RUN / 出力) は Expressive Code の枠の外に置く。

### 共通化の範囲

| 層                         | 内容                                                         | 置き場                                                                                                                                                                                          |
| -------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design Tokens              | primitive / semantic                                         | `packages/design-system/styles/tokens.css`                                                                                                                                                      |
| 版面                       | `.g-rail` / `.g-doc` / `.tate` / `.hit` / 罫                 | `packages/design-system/styles/utilities.css`                                                                                                                                                   |
| 挿絵                       | 図柄の SVG と生成器                                          | `packages/design-system/art/`                                                                                                                                                                   |
| コードの配色               | Expressive Code のテーマと配色のチェック                     | `packages/design-system/code-theme.ts`、`packages/design-system/check-contrast.ts`                                                                                                              |
| このサイトのコンポーネント | `ContentRow` / `MetaLine` / 実行パネル / サイドバー / `.btn` | サイドバーは `apps/web/src/components/`、`ContentRow` と `MetaLine` は `apps/web/src/features/listing/`、実行パネルは `apps/web/src/features/lab/panel/`、CSS は `apps/web/src/styles/site.css` |
| 動き                       | サイト全体の動きの実装                                       | `apps/web/src/styles/motion.css`                                                                                                                                                                |

**このサイトのコンポーネントを `packages/design-system` に入れない**。
消費者が `apps/web` の 1 つだけであり、「2 つ以上の消費者が実在するまで package にしない」規約に従う。  
規約は [context/codebase.md](../../context/codebase.md#packages) にある。

## Interface

### 置くファイル

- `packages/design-system/styles/tokens.css`: Design Tokens（primitive と semantic）
- `packages/design-system/styles/utilities.css`: 版面、型（`.prose`、`.meta` など）、当たり判定、縦組み、罫、挿絵の帯、コードの字の色
- `packages/design-system/art/`: 挿絵の SVG と生成器。[挿絵の Design Doc](art/DesignDoc.md) がある
- `packages/design-system/code-theme.ts`: Expressive Code のテーマ
- `packages/design-system/check-contrast.ts`: 配色のチェック
- `apps/web/src/styles/global.css`、`site.css`、`motion.css`: 層をまとめるファイル、このサイトのコンポーネント、動き

package の外へは、`package.json` の `exports` にある `tokens.css`、`utilities.css`、`art/*`、`code-theme` だけを出す。

### チェック

テストの共通の規約は [context/testing.md](../../context/testing.md) にある。

- Design Tokens に単体テストを書かない。分岐を持たないためである。
- コントラスト比は、`pnpm run check:contrast` が自動でチェックする。
  - 地とテキスト、地と `--color-rule-strong`、`--color-code-bg` とコードの 5 トークンの比を、明暗の両方の配色で計算して閾値と比べる。値を手で書き換えたときに気づけない種類の劣化である。
  - コードの 5 トークンは、比を並べ替えて、隣り合う比が閾値以上かをチェックする。
  - 対象のトークンが `tokens.css` にあること、`code-theme.ts` と `tokens.css` の `--color-c-*` と `--color-code-bg` の値の一致もチェックする。
- `react-doctor design` の指摘のうち、この Design System の規則と衝突するものは無効にし、理由を [context/conventions.md](../../context/conventions.md#check-exclusions) に記録する。
  - 「カードを使わない」「見出しを大きくしない」は、汎用の規則に反する可能性がある。
- 動きは、自動のテストの対象にしない。
  - 退行の受け皿（`prefers-reduced-motion`、`animation-timeline` に対応しない環境）では最初から見えているので、動かないこと自体は不具合にならない。

## Verification

- `astro-expressive-code` で、画面案のコードの見た目を出せることを確かめた。スタイリングは `styleOverrides` から指定する。
- 実行パネルを Expressive Code の枠の外に置いても見た目がそろうことを確かめた。
