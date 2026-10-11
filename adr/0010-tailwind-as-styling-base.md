# ADR-0010: Tailwind CSS v4 を CSS スタイリングの基盤にし、コンポーネントの CSS を utility へ移す

## Status

承認

## Context

`context/toolchain.md` の標準スタックに Tailwind CSS 4 が載っていた。  
制約欄は「`@astrojs/starlight-tailwind` 5.0.0 が peer に要求」であり、**Starlight を採る前提で選ばれた依存だった。**

Starlight を採らないと決めたが、表から Starlight も Tailwind も消さなかった。  
ADR-0001: [Starlight を採らず、Astro 単体 + Expressive Code + Pagefind で組む](0001-starlight-as-docs-renderer.md)

実装は最初から素の CSS で組んでいた。  
`git log -S tailwind` を全ブランチで見ても、依存に入ったコミットは 1 つも無い。  
**文書だけが 1 世代前の前提を持ち続けていた。**

現行 CSS の宣言を数えた。

| 分類                                                        | 件数   | Tailwind での扱い                            |
| ----------------------------------------------------------- | ------ | -------------------------------------------- |
| `display` / `background` / `color` / `gap` / `padding` など | 約 200 | 素で対応。`py-*` は `padding-block` で論理軸 |
| `light-dark()`                                              | 33     | `@theme` の中に書けば維持できる              |
| `border-block-*` / `inline-size` / `block-size`             | 49     | 物理軸のみ                                   |
| 縦組み (`writing-mode` / `text-orientation` / 縦中横)       | 10     | utility 無し                                 |
| `@starting-style`                                           | 7      | バリアント無し                               |
| `animation-timeline` / `animation-range`                    | 4      | バリアント無し                               |

素の CSS のままでも成立していた。  
10 ページで約 1000 行、コンポーネントごとに命名済みで、knip と oxlint が未使用を検出する。

## Decision

### Tailwind CSS v4 を採り、コンポーネントの CSS を utility へ移して統一する

CSS スタイリングの基盤を Tailwind にし、**コンポーネントの CSS を utility へ移して統一する。**

採る理由は技術的な優位ではなく、**規約が 1 つであることの価値**である。  
utility と手書き CSS が混在すると、どちらの規約に従うべきかがファイルごとに変わり、どちらの読み方も身に付かない。

### preflight を読み込まない

本文の段落間隔は UA 既定の `margin-block: 1em` に依存している。  
preflight はそれを 0 にする。

**preflight の border の初期化だけは自前で持つ。**  
`border-width: 0; border-style: solid` が無いと、`border-b` を当てた要素の他 3 辺に `medium` (3px) の枠が付く。

### トークンは `@theme static` に置く

`static` を付ける。  
**`static` を付けないと、utility から参照された変数しか出力されない**。  
挿絵の SVG は `fill="var(--color-wood-1)"` で色を参照するので Tailwind の走査に映らず、3 階調が消えて木立が真っ黒になる。  
出典: [Tailwind CSS v4 のカスタムスタイル](https://tailwindcss.com/docs/adding-custom-styles)

折り返しは `--breakpoint-*` として持つ。

### 版面とコンポーネントのクラスを `@utility` にしない

`@utility` は utilities 層に入る。  
`[data-open="false"].g-doc` のような状態つきの上書きにも、`.g-rail > .tate-head` の狭い画面の上書きにも勝ってしまう。

測ると、`@utility` 化した時点で 40 枚中 28 枚が退行した。  
サイドバーの開閉と縦組みの横倒しが正しく表示されなくなった。

markup 側の 1 語がコンポーネントに勝つ順序は、**層分けだけで足りる。**

### 基準値と状態の上書きは同じ層に置く

**これが移行中の退行の唯一の型である。**  
utility は CSS より層が上なので、基準値だけ markup へ移すと状態の規則に勝つ。

### CSS に残すものを決める

| 残すもの                                 | 理由                                     |
| ---------------------------------------- | ---------------------------------------- |
| `::before` / `::after` / `::backdrop`    | markup に無い要素                        |
| `@starting-style` / `animation-timeline` | バリアントが無い                         |
| Expressive Code の上書き                 | cascade layer の外に置く必要がある       |
| SVG の内部要素へ当てる規則               | 描画コードが組み立てるので markup に無い |
| Pagefind が実行時に作る要素へ当てる規則  | 描画コードが組み立てるので markup に無い |
| 背景の多重グラデーション                 | class 名にすると読めなくなる             |

出典: [cascade layer と第三者 CSS の衝突](https://github.com/tailwindlabs/tailwindcss/discussions/20306)

## Verification

移行の各段で、Playwright で 10 ページ × 明暗 2 配色 × 2 幅 = 40 枚を撮り、移行前と画素比較して全て一致することを確認する。

**「見た目を変えない」を目視で確かめない。** 3px の差は目で追えない。

この画素比較は `check` には入れない。  
ビルドと preview の起動が要り、かつ「変更前」を撮っておく必要があるため、CI では自動化できない。  
スタイリングに触れる変更のときに手で回す。

## Considered Options

| 選択肢                                                                             | 強み                                                                                                                                                                                                               | 弱み                                                                                                                                                   |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **採用:** Tailwind CSS v4 を採り、コンポーネントの CSS を utility へ移して統一する | スタイリングの規約が 1 つになる。トークンが utility を生むので、値を手で書き写す箇所が減る。状態が markup に出る                                                                                                   | 移行中に退行が出る。markup の class 文字列が長くなる。Tailwind のバージョンに追随する必要が生まれる                                                    |
| Tailwind を採らない                                                                | 退行の危険が無い。Tailwind が解く問題 (CSS が増え続ける、1 要素の変更が他を壊す) は、10 ページ約 1000 行のこの規模では起きていない。縦組みと動きという、このサイトを特徴づける部分は Tailwind の弱い場所と一致する | 標準的でない基盤を自前で維持し続けることになる。新しく触る人が最初に読むものが増える                                                                   |
| トークンだけ `@theme` に集約し、コンポーネントの CSS は残す                        | 退行の危険が小さい。トークンが utility を生むので、新規のコードは utility で書ける                                                                                                                                 | **utility と手書き CSS が混在する。** どちらの規約に従うかがファイルごとに変わり、どちらも身に付かない。Tailwind を入れて utility を使わない状態になる |
| React の島だけ CSS に残す                                                          | 状態を多く持つコンポーネントの退行を避けられる                                                                                                                                                                     | 境界が「島かどうか」になり、スタイリングの都合と無関係な線が引かれる                                                                                   |

## Consequences

### Positive

- スタイリングの規約が 1 つになる。
- トークンが utility を生むので、値を手で書き写す箇所が減る。
- 状態が markup に出る。
  - CSS を開かずに、その要素が何で変わるかが読める。

### Negative

- **移行中に退行が出る。** 全て「基準値と状態が別の層に分かれた」型である。
  - 1 区画ごとに 40 枚 (10 ページ × 明暗 2 配色 × 2 幅) の画素比較で検出する。
- markup の class 文字列が長くなる。
- Tailwind のバージョンに追随する必要が生まれる。
