# ADR-0055: サイトの共通の CSS で Tailwind CSS の preflight を読み、トークンを packages/ui のテーマ変数から使う

## Status

提案

## Context

`apps/web` のサイトの共通の CSS で、preflight を読むかと、トークンをどこから読むかを決める必要がある。

新しい `apps/web` は、全てのページを `packages/ui` のトークンとコンポーネントで組む。  
ADR-0029: [リポジトリの構成を buddy に合わせ、文書を `docs/` に、E2E を `packages/e2e` に置く](0029-repository-layout-like-buddy.md)

ADR-0010 は、古いサイトの CSS について次の 2 つを決めている。  
ADR-0010: [Tailwind CSS v4 を CSS スタイリングの基盤にし、コンポーネントの CSS を utility へ移す](0010-tailwind-as-styling-base.md)

- preflight を読み込まない。古いサイトの本文の段落の間隔が、UA のデフォルトの `margin-block: 1em` に依存していたためである。
- トークンを `@theme static` に置く。`static` を付けないと、ユーティリティから参照されない変数が出力されず、挿絵の SVG が `fill="var(--color-wood-1)"` で参照する色が消えるためである。

今の `packages/ui` は、次の形になっている。

- トークンの値は、`packages/ui/src/tokens/primitive.css` と `semantic.css` の `:root` に、素のカスタムプロパティとして書いてある。
- テーマ変数は、`packages/ui/src/tokens/theme.css` の `@theme inline` に置き、セマンティックトークンを参照する。
  - ADR-0024: [トークンを、fukuemon.dev の値のプリミティブトークン、セマンティックトークン、テーマ変数の 3 つの層にし、生成りの地と旧サイトの差し色で、角丸と影を使わない版面にする](0024-tokens-of-fukuemon-dev.md)
- 挿絵の SVG は、`fill="var(--fd-color-surface)"` のように、セマンティックトークンの素のカスタムプロパティを参照する。
- カタログ（`packages/ui/.storybook/preview.css`）は、`@import "tailwindcss"` で preflight を読み、コンポーネントを preflight の上で描いている。

古いサイトの本文の CSS と挿絵の CSS は、リポジトリに無い。

## Decision

ADR-0010 の Decision の「preflight を読み込まない」と「トークンは `@theme static` に置く」を、次の決定に置き換える。

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

ADR-0010 のほかの Decision（Tailwind CSS v4 を採り、コンポーネントの CSS を utility へ移す、`@utility` にしない、基準値と状態の上書きを同じ層に置く、CSS に残すもの）は変えない。

## Considered Options

| 選択肢                                                                           | 強み                                                                                         | 弱み                                                                                                |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **採用:** preflight を読み、トークンを `packages/ui` のテーマ変数から使う        | サイトとカタログで、コンポーネントの見た目がそろう。CSS の読み込みが、カタログと同じ形になる | 記事の本文の段落の間隔、見出しと箇条書きのデフォルトの見た目を、記事のページを作るときに自前で書く  |
| ADR-0010 のとおり preflight を読まず、`@theme static` を使う                     | ADR-0010 を置き換えない。UA のデフォルトの本文の見た目を使える                               | カタログと違う初期化の上で、`packages/ui` のコンポーネントを描く。border の初期化を自前で持ち続ける |
| preflight を読まず、`packages/ui` の側に border の初期化と要素の初期化を持たせる | サイトの CSS が UA のデフォルトに近いまま残る                                                | カタログとサイトの両方に、初期化を 2 つ持つ。初期化の差が、コンポーネントの見た目の差になる         |

## Consequences

### Positive

- サイトとカタログで、同じコンポーネントが同じ見た目になる。
- サイトの共通の CSS が、`packages/ui` の `fonts.css` と `theme.css` を読むだけになる。

### Negative

- 記事の本文の段落、見出し、箇条書き、表の見た目を、記事のページを作るときに書く。
- Expressive Code を入れるときに、`styleOverrides` から参照する変数を、`@theme static` に頼らずに決め直す。
