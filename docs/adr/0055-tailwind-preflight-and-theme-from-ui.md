# ADR-0055: Tailwind CSS v4 を CSS スタイリングの基盤にし、サイトの共通の CSS で preflight を読み、トークンを packages/ui のテーマ変数から使う

## Status

承認

## Context

CSS スタイリングの基盤と、`apps/web` のサイトの共通の CSS で、preflight を読むかと、トークンをどこから読むかを決める必要がある。

新しい `apps/web` は、全てのページを `packages/ui` のトークンとコンポーネントで組む。  
ADR-0029: [リポジトリの構成を buddy に合わせ、文書を `docs/` に、E2E を `packages/e2e` に置く](0029-repository-layout-like-buddy.md)

古いサイトの CSS は、次の 2 つの形だった。

- preflight を読み込まない。古いサイトの本文の段落の間隔が、UA のデフォルトの `margin-block: 1em` に依存していたためである。
- トークンを `@theme static` に置く。`static` を付けないと、ユーティリティから参照されない変数が出力されず、挿絵の SVG が `fill="var(--color-wood-1)"` で参照する色が消えるためである。

トークンを `@theme static` に置くことには、もう 1 つ理由があった。  
Expressive Code が挿す CSS はこのリポジトリのビルドを通らないので、`styleOverrides` から参照するトークンを、素のカスタムプロパティとして出しておく必要があった。

古いサイトの CSS の宣言を数えた。

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

今の `packages/ui` は、次の形になっている。

- トークンの値は、`packages/ui/src/tokens/primitive.css` と `semantic.css` の `:root` に、素のカスタムプロパティとして書いてある。
- テーマ変数は、`packages/ui/src/tokens/theme.css` の `@theme inline` に置き、セマンティックトークンを参照する。
  - ADR-0024: [トークンを、fukuemon.dev の値のプリミティブトークン、セマンティックトークン、テーマ変数の 3 つの層にし、生成りの地と旧サイトの差し色にする](0024-tokens-of-fukuemon-dev.md)
- 挿絵の SVG は、`fill="var(--fd-color-surface)"` のように、セマンティックトークンの素のカスタムプロパティを参照する。
- カタログ（`packages/ui/.storybook/preview.css`）は、`@import "tailwindcss"` で preflight を読み、コンポーネントを preflight の上で描いている。

古いサイトの本文の CSS と挿絵の CSS は、リポジトリに無い。

## Decision

### Tailwind CSS v4 を採り、スタイルを utility で書く

CSS スタイリングの基盤を Tailwind にし、スタイルを utility で書いて統一する。

採る理由は技術的な優位ではなく、**規約が 1 つであることの価値**である。  
utility と手書き CSS が混在すると、どちらの規約に従うべきかがファイルごとに変わり、どちらの読み方も身に付かない。

### 1. preflight を読む

`apps/web` のサイトの共通の CSS は、`@import "tailwindcss"` で preflight を読む。  
層の順は、Tailwind CSS のデフォルトの `theme`、`base`、`components`、`utilities` にする。

- カタログは、`packages/ui` のコンポーネントを preflight の上で描く。サイトで preflight を外すと、カタログと同じ見た目にならない。
- preflight を外す理由だった古いサイトの本文の CSS は、リポジトリに無い。
- 記事の本文の段落の間隔は、記事のページを作るときに、`packages/ui` のトークンで指定する。

### 2. `@theme static` を使わない

サイトの共通の CSS は、`packages/ui` の `theme.css` をそのまま読み、`@theme static` を書かない。

- トークンの値は、`primitive.css` と `semantic.css` の `:root` に素のカスタムプロパティとして出る。ユーティリティから参照されない変数も出力される。
- `@theme static` を求めていた Expressive Code の `styleOverrides` は、まだ無い。

## Considered Options

| 選択肢                                                                                            | 強み                                                                                                                                                                                                               | 弱み                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **採用:** Tailwind CSS v4 を採り、preflight を読み、トークンを `packages/ui` のテーマ変数から使う | スタイリングの規約が 1 つになる。トークンが utility を生むので、値を手で書き写す箇所が減る。状態が markup に出る。サイトとカタログで、コンポーネントの見た目がそろう。CSS の読み込みが、カタログと同じ形になる     | markup の class 文字列が長くなる。Tailwind のバージョンに追随する必要が生まれる。記事の本文の段落の間隔、見出しと箇条書きのデフォルトの見た目を、記事のページを作るときに自前で書く |
| Tailwind を採らない                                                                               | 退行の危険が無い。Tailwind が解く問題 (CSS が増え続ける、1 要素の変更が他を壊す) は、10 ページ約 1000 行のこの規模では起きていない。縦組みと動きという、このサイトを特徴づける部分は Tailwind の弱い場所と一致する | 標準的でない基盤を自前で維持し続けることになる。新しく触る人が最初に読むものが増える                                                                                                |
| トークンだけ `@theme` に集約し、コンポーネントの CSS は残す                                       | 退行の危険が小さい。トークンが utility を生むので、新規のコードは utility で書ける                                                                                                                                 | **utility と手書き CSS が混在する。** どちらの規約に従うかがファイルごとに変わり、どちらも身に付かない。Tailwind を入れて utility を使わない状態になる                              |
| React の島だけ CSS に残す                                                                         | 状態を多く持つコンポーネントの退行を避けられる                                                                                                                                                                     | 境界が「島かどうか」になり、スタイリングの都合と無関係な線が引かれる                                                                                                                |
| preflight を読まず、`@theme static` を使う                                                        | UA のデフォルトの本文の見た目を使える                                                                                                                                                                              | カタログと違う初期化の上で、`packages/ui` のコンポーネントを描く。border の初期化を自前で持ち続ける                                                                                 |
| preflight を読まず、`packages/ui` の側に border の初期化と要素の初期化を持たせる                  | サイトの CSS が UA のデフォルトに近いまま残る                                                                                                                                                                      | カタログとサイトの両方に、初期化を 2 つ持つ。初期化の差が、コンポーネントの見た目の差になる                                                                                         |

## Consequences

### Positive

- スタイリングの規約が 1 つになる。
- トークンが utility を生むので、値を手で書き写す箇所が減る。
- 状態が markup に出る。
  - CSS を開かずに、その要素が何で変わるかが読める。
- サイトとカタログで、同じコンポーネントが同じ見た目になる。
- サイトの共通の CSS が、`packages/ui` の `fonts.css`、`theme.css`、`sources.css` を読むだけになる。

### Negative

- markup の class 文字列が長くなる。
- Tailwind のバージョンに追随する必要が生まれる。
- 記事の本文の段落、見出し、箇条書き、表の見た目を、記事のページを作るときに書く。
- Expressive Code を入れるときに、`styleOverrides` から参照する変数を、`@theme static` に頼らずに決め直す。
