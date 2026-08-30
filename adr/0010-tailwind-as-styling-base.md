# ADR-0010: Tailwind CSS v4 を見た目の基盤にし、部品の CSS を utility へ移す

## 状態

承認

## 決定日

2026-08-30

## 背景

- `context/toolchain.md` の標準スタックに Tailwind CSS 4 が載っていた。
  制約欄は「`@astrojs/starlight-tailwind` 5.0.0 が peer に要求」であり、
  **Starlight を採る前提で選ばれた依存だった。**
- [ADR-0001](0001-starlight-as-docs-renderer.md) で Starlight を採らないと決めたが、
  表から Starlight も Tailwind も消さなかった。
- 実装は最初から素の CSS で組んでいた。
  `git log -S tailwind` を全ブランチで見ても、依存に入ったコミットは 1 つも無い。
  **文書だけが 1 世代前の前提を持ち続けていた。**
- 2026-08-30 に現行 CSS の宣言を数えた。

  | 分類                                                        | 件数   | Tailwind での扱い                            |
  | ----------------------------------------------------------- | ------ | -------------------------------------------- |
  | `display` / `background` / `color` / `gap` / `padding` など | 約 200 | 素で対応。`py-*` は `padding-block` で論理軸 |
  | `light-dark()`                                              | 33     | `@theme` の中に書けば維持できる              |
  | `border-block-*` / `inline-size` / `block-size`             | 49     | 物理軸のみ                                   |
  | 縦組み (`writing-mode` / `text-orientation` / 縦中横)       | 10     | utility 無し                                 |
  | `@starting-style`                                           | 7      | バリアント無し                               |
  | `animation-timeline` / `animation-range`                    | 4      | 同上                                         |

- 素の CSS のままでも成立していた。
  10 ページで約 1000 行、部品ごとに命名済みで、knip と oxlint が未使用を検出する。

## 決定

### 1. Tailwind CSS v4 を採る

見た目の基盤を Tailwind にし、**部品の CSS を utility へ移して統一する。**

採る理由は技術的な優位ではなく、**規約が 1 つであることの価値**である。
utility と手書き CSS が混在すると、どちらの規約に従うべきかがファイルごとに変わり、
どちらの読み方も身に付かない。

### 2. preflight を読み込まない

```css
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);
```

本文の段落間隔は UA 既定の `margin-block: 1em` に依存している。
preflight はそれを 0 にする。

**preflight の border の初期化だけは自前で持つ。**
`border-width: 0; border-style: solid` が無いと、`border-b` を当てた要素の
他 3 辺に `medium` (3px) の枠が付く。

### 3. トークンは `@theme static` に置く

```css
@theme static {
  --color-paper: light-dark(#fcfbf8, #17140f);
  --spacing-intra-2: 13px;
  --breakpoint-narrow: 721px;
}
```

`static` を付ける。
**既定では utility から参照された変数しか出力されない。**
挿絵の SVG は `fill="var(--color-wood-1)"` で色を参照するので Tailwind の走査に映らず、
3 階調が消えて木立が真っ黒になる。

折り返しは `--breakpoint-*` として持つ。
値は「その幅から上」を指すので、`max-narrow:` が `max-width: 720.98px` になる。

### 4. 版面と部品のクラスを `@utility` にしない

`@utility` は utilities 層に入る。
`[data-open="false"].g-doc` のような状態つきの上書きにも、
`.g-rail > .tate-head` の狭い画面の上書きにも勝ってしまう。

実測では、`@utility` 化した時点で 40 枚中 28 枚が退行した
(サイドバーの開閉と縦組みの横倒しが壊れた)。

markup 側の 1 語が部品に勝つ順序は、**層分けだけで足りる。**

### 5. 基準値と状態の上書きは同じ層に置く

**これが移行中の退行の唯一の型である。**

utility は CSS より層が上なので、基準値だけ markup へ移すと状態の規則に勝つ。

| 元の CSS                                  | markup での書き方                          |
| ----------------------------------------- | ------------------------------------------ |
| `[data-open="false"] .side__panel`        | `data-[open=false]:...`                    |
| `.steps__link[aria-current]`              | `aria-[current]:...`                       |
| `.steps__link[aria-current] .steps__text` | 親に `group`、子に `group-aria-[current]:` |
| `.steps__mark[data-state="done"]`         | `data-[state=done]:...`                    |
| `.runner__bar:has(.btn)`                  | `has-[.btn]:...`                           |
| `.sheet[open]`                            | `open:...`                                 |

手順の現在地は `aria-current="step"` である。
組み込みの `aria-current:` は `[aria-current="true"]` なので当たらない。
`aria-[current]:` を使う。

### 6. CSS に残すもの

| 残すもの                                 | 理由                                     |
| ---------------------------------------- | ---------------------------------------- |
| `::before` / `::after` / `::backdrop`    | markup に無い要素                        |
| `@starting-style` / `animation-timeline` | バリアントが無い                         |
| Expressive Code の上書き                 | cascade layer の外に置く必要がある       |
| SVG の内部要素へ当てる規則               | 描画コードが組み立てるので markup に無い |
| Pagefind が実行時に作る要素へ当てる規則  | 同上                                     |
| 背景の多重グラデーション                 | class 名にすると読めなくなる             |

## 代替案

### 1. Tailwind を採らない

#### Pros

- 退行の危険が無い。
- Tailwind が解く問題 (CSS が増え続ける、1 要素の変更が他を壊す) は、
  10 ページ約 1000 行のこの規模では起きていない。
- 縦組みと動きという、このサイトを特徴づける部分は Tailwind の弱い場所と一致する。

#### Cons

- 標準的でない基盤を自前で維持し続けることになる。
- 新しく触る人が最初に読むものが増える。

### 2. トークンだけ `@theme` に集約し、部品の CSS は残す

#### Pros

- 退行の危険が小さい。
- トークンが utility を生むので、新規のコードは utility で書ける。

#### Cons

- **utility と手書き CSS が混在する。**
  どちらの規約に従うかがファイルごとに変わり、どちらも身に付かない。
- Tailwind を入れて utility を使わない状態になる。

### 3. React の島だけ CSS に残す

#### Pros

- 状態を多く持つ部品の退行を避けられる。

#### Cons

- 境界が「島かどうか」になり、見た目の都合と無関係な線が引かれる。

## 影響

### 良い影響

- 見た目の規約が 1 つになる。
- トークンが utility を生むので、値を手で書き写す経路が減る。
- 状態が markup に出る。CSS を開かずに、その要素が何で変わるかが読める。

### 悪い影響 / トレードオフ

- **移行中に退行が出る。** 全て「基準値と状態が別の層に分かれた」型である。
  1 区画ごとに 40 枚 (10 ページ × 明暗 2 配色 × 2 幅) の画素比較で検出する。
- markup の class 文字列が長くなる。
- Tailwind の版に追随する必要が生まれる。

### 影響範囲

- 対象モジュール / package: `apps/web` (全 component と `styles/`)、
  `packages/design-system` (`styles/`、`check-contrast.ts`)

## 検証

移行の各段で、Playwright で 10 ページ × 明暗 2 配色 × 2 幅 = 40 枚を撮り、
移行前と画素比較して全て一致することを確認する。

**「見た目を変えない」を目視で確かめない。** 3px の差は目で追えない。

## 実装・運用への反映

- spec 更新要否: 不要
- context / AI 向け設定更新要否: 要。
  [context/toolchain.md](../context/toolchain.md) の標準スタック、
  [design-system](../design/features/design-system/DesignDoc_design-system.md) の層と規約

## 関連ドキュメント / チケット

- [ADR-0001](0001-starlight-as-docs-renderer.md): Starlight を採らない決定
- [design-system](../design/features/design-system/DesignDoc_design-system.md): 見た目の正本
- [Tailwind CSS v4 のカスタムスタイル](https://tailwindcss.com/docs/adding-custom-styles)
- [cascade layer と第三者 CSS の衝突](https://github.com/tailwindlabs/tailwindcss/discussions/20306)
