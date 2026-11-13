# ADR-0019: 欧文の書体に、x-height と線の太さが和文に近い STIX Two Text を使う

## Status

承認

## Context

- 本文には、`PostgreSQL`、`EXPLAIN`、`Buffers` のような欧文の技術用語が、ほぼ全ての段落に出てくる。
  - 欧文の語は、和文の行の中に混ぜて組む。
  - 欧文の字の大きさと線の太さが和文とずれると、技術用語だけが小さく薄く見え、読む速さが落ちる。
- 和のテイストは、和文の Zen Old Mincho が担う。
  - ADR-0004: [Typography の判断](0004-typography-static-weights.md)
- 欧文の候補 3 つと Zen Old Mincho を、ウェイト 400 で測った。
  - x-height と H の高さは、em に対する比である。
  - 濃度は、字の面積を、送り幅 × em で割った値である。`nohepdas` の 8 字で測った。値が大きいほど線が太い。
  - 転送量は、Fontsource の roman と italic の woff2 の合計である。

| 書体                        | x-height | H の高さ | 濃度  | 転送量（全体） | 転送量（latin のみ） |
| --------------------------- | -------- | -------- | ----- | -------------- | -------------------- |
| EB Garamond                 | 0.405    | 0.653    | 0.163 | 489 KiB        | 90 KiB               |
| **STIX Two Text**           | 0.473    | 0.657    | 0.198 | 263 KiB        | 58 KiB               |
| Source Serif 4              | 0.492    | 0.670    | 0.216 | 356 KiB        | 100 KiB              |
| Zen Old Mincho が持つ Latin | 0.430    | 0.726    | 0.184 | —              | —                    |

- 3 つとも Fontsource の可変フォントがあり、ライセンスは SIL OFL 1.1 である。
  - `@fontsource-variable/eb-garamond` と `@fontsource-variable/stix-two-text` は 5.3.0 である。
  - `@fontsource-variable/source-serif-4` は 5.3.1 である。
- どの書体の latin のスライスも `smcp` を持たない。`.label` の small-caps は、どれを選んでもブラウザが合成する。

## Decision

欧文の書体に STIX Two Text を使う。  
`--font-serif` の先頭に `"STIX Two Text Variable"` を置き、Latin を STIX Two Text、和文を Zen Old Mincho に描かせる。  
Fontsource の `@fontsource-variable/stix-two-text` の roman と italic を self-host する。

理由は次の 3 つ。

- x-height と濃度が、Zen Old Mincho が持つ Latin の値に最も近い。
  - 和文の行の中で、欧文の語が小さくも黒くも見えない。
- 転送量が 3 つの中で最も小さい。
- 和のテイストは和文が担うので、欧文は読みやすさだけで選べる。

## Verification

- x-height、H の高さ、濃度は、Fontsource の latin のスライスを fontTools で wght 400 に固定して測った。
- 記事 `/articles/index-not-used/` とハンズオン `/labs/rdbms-query-execution/` を、3 つの書体で撮り比べた。
  - EB Garamond は、`Postgres` や `SQL` が仮名より小さく細く見えた。
  - Source Serif 4 は、欧文の語が周りの仮名より黒く見えた。
  - STIX Two Text は、欧文の語の大きさと黒さが仮名と揃って見えた。

## Considered Options

| 選択肢                  | 強み                                                                          | 弱み                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **採用:** STIX Two Text | x-height と濃度が和文に近い。転送量が最小。参考サイトと同じ書体で、質感が近い | Times 系の骨格で、オールドスタイル明朝とは骨格が揃わない                                 |
| EB Garamond             | オールドスタイルのヒューマニストで、Zen Old Mincho と骨格が揃う               | x-height が 0.405 と小さく線が細い。和文の行の中で技術用語が小さく薄く見える             |
| Source Serif 4          | x-height が最も大きく、画面での判読性が高い                                   | 濃度が 0.216 で、Zen Old Mincho より黒い。欧文の語だけが太く目立つ。latin の転送量が最大 |

## Consequences

### Positive

- 本文の技術用語が、和文と同じ大きさと黒さで読める。
- 欧文の書体の転送量が減る。

### Negative

- 欧文の骨格が、和文のオールドスタイルと揃わない。
  - 見出しの欧文のように大きく組む場所で、骨格の違いが目に入りやすい。
