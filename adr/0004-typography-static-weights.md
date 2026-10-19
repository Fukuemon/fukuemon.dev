# ADR-0004: 和文に静的 2 ウェイトの Zen Old Mincho を採り、可変フォントを使わず self-host する

## Status

承認（Decision 1 の欧文の書体を ADR-0019 に置換）

## Context

- Design System は、日本庭園の設計思想をモチーフではなく構造規則へ翻訳する。
  - 桜、鳥居、筆文字、竹、和柄、庭園写真のような直接的な和風のモチーフを使わない。
  - **和のテイストは書体で担う。**
- 参考サイト（torus-engineering）の `styles.css` を計測した。
  - 本文、見出し、UI がすべて Serif で、Sans は 0 件だった。
  - `border-radius` と `box-shadow` は 0 件、色は 6 値だった。
  - h2 は 1.25rem、h3 は 1.05rem で、本文の 1.05rem とほぼ同じ寸法だった。
  - **階層は、サイズの差ではなく、small-caps と letter-spacing と罫線で作られている。**
- この型スケールを採ると、**使うウェイトは 400 と 600 の 2 段だけになる。**
- Google Fonts は CJK を約 122 のスライスに分けて配信する。
  CSS API で計測した値は次のとおり。

| フォント                        | スライス数 | 1 スライスの平均 | ファミリの総量（推定） |
| ------------------------------- | ---------- | ---------------- | ---------------------- |
| Noto Serif JP（可変 400–700）   | 124        | 56 KB            | 約 7.0 MB              |
| Zen Old Mincho（静的 400+700）  | 244        | 20 KB            | 約 4.9 MB              |
| Shippori Mincho（静的 400+700） | 244        | 30 KB            | 約 7.3 MB              |
| Hina Mincho（400 のみ）         | 123        | 19 KB            | 約 2.4 MB              |

- 本文には、`PostgreSQL`、`RDBMS`、`Rolldown` のような Latin の技術用語が頻繁に出てくる。
- 将来、`/playground/*` に `COEP: require-corp` を掛ける。
  COEP の下では、CORP を返さないクロスオリジンのリソースがブロックされる。
  - ADR-0006: [手を動かす場所の 4 分類](0006-interactive-content-levels.md)
- Fontsource の `@fontsource/zen-old-mincho` と `@fontsource-variable/eb-garamond` は 5.3.0 で、Noto Serif JP も同じ 5.3.0 だった。
  - どれも peer 依存を持たず、CSS の `@import` だけで使える。
  - SIL OFL のため fork でき、Google Fonts と Fontsource の両方から入手できる。

## Decision

### 1. 和文に Zen Old Mincho、欧文に EB Garamond、Mono に Geist Mono を使う

| 役割       | 書体                    | ウェイト          |
| ---------- | ----------------------- | ----------------- |
| 和文 Serif | **Zen Old Mincho**      | 400 / 600（静的） |
| 欧文 Serif | **EB Garamond**         | 400 / 600（可変） |
| Mono       | **Geist Mono Variable** | 400 / 600         |

フォールバックの列は、EB Garamond、Zen Old Mincho、Yu Mincho の順に並べる。  
CSS は左から順にグリフを探すので、Latin は EB Garamond が、和文は Zen Old Mincho が受け持つ。

Zen Old Mincho は、大平善道の ZEN オールド明朝 R（1997） を原型とするオールドスタイル明朝で、Positype が SIL OFL で発行している。  
縦組みのために描いた手描きの輪郭を持ち、仮名の重心が現代の明朝より低い。  
この重心が「和」として読める。  
起筆と終筆に筆意は残るが、活字なので筆文字には当たらない。  
和のテイストを出しつつ直接的な和風の表現を避ける、という制約にちょうど合う。  
提供されるウェイトは 400、500、600、700、900 で、800 はない。  
出典: [googlefonts/zen-oldmincho](https://github.com/googlefonts/zen-oldmincho)

EB Garamond は、オールドスタイルのヒューマニストで、Zen Old Mincho と骨格が揃う。  
可変で Latin が中心のため軽く、roman と italic の全 14 スライスで 489 KB に収まる。

### 2. CJK に可変フォントを使わない

**可変フォントは全スライスにウェイトの軸を持つので、1 スライスが 2.8 倍重い**（Noto Serif JP の 56 KB に対し、Zen Old Mincho は 20 KB）。  
型スケールが 400 と 600 の 2 段しか使わないので、可変の軸の分の転送量を払う理由がない。

### 3. Fontsource で self-host し、外部の CDN から読まない

`@fontsource/zen-old-mincho`、`@fontsource-variable/eb-garamond`、`@fontsource-variable/geist-mono` を使う。
理由は次の 2 つ。

- cross-origin isolation から独立できる。
  - Google Fonts は今は `cross-origin-resource-policy: cross-origin` を返すので、COEP の下でも読める。
  - それでも、サードパーティのヘッダの方針に、このサイトが動くかどうかを預け続ける理由がない。
  - self-host なら同一オリジンになり、この論点自体がなくなる。
- 使うウェイトだけを配れる。Zen Old Mincho の 5 ウェイトのうち、使うのは 2 つだけ。

Geist Mono は Google Fonts にないので、どちらにしても Fontsource が要る。  
3 書体の取得元を Fontsource に揃える。

## Verification

- Google Fonts の CSS API の値は、次の手順で測った。
  - `https://fonts.googleapis.com/css2?family=<Family>:wght@<weights>` を Chrome の User-Agent で取得する。
  - `src: url(...)` が指す woff2 のサイズを測る。
- Google Fonts のフォントが `cross-origin-resource-policy: cross-origin` を返し、COEP の下でも読めることを計測で確かめた。

## Considered Options

| 選択肢                                                                                                             | 強み                                                                                   | 弱み                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **採用:** 和文 Zen Old Mincho（静的 400 / 600）、欧文 EB Garamond、Mono Geist Mono を Fontsource で self-host する | 和のテイストが出る。1 スライスが 20 KB と軽い。COEP の下でも外部のヘッダに左右されない | ウェイトが 400 と 600 に固定される。配信物にフォントが入る                                                                                                                 |
| Noto Serif JP（当初の案）                                                                                          | 最も標準的。可変で 200–900 を持つ                                                      | 和のテイストが出ず、書体に和を担わせる Design System の決定と合わない。可変のため 1 スライスが 56 KB で、Zen Old Mincho の 2.8 倍。使うウェイトは 2 段だけなので見合わない |
| Shippori Mincho                                                                                                    | 和のテイストは Zen Old Mincho と同じくらい強い。静的な 5 ウェイトを持つ                | 装飾が多く、技術文書には過剰。1 スライスの平均が 30 KB で、Zen Old Mincho の 1.5 倍                                                                                        |
| Hina Mincho                                                                                                        | 和のテイストが最も強く、Hero に置くと印象が立つ。ファミリの総量が最小（約 2.4 MB）     | 1 ウェイトだけで極細なので、本文の 1.05rem に使えず、見出し専用になる                                                                                                      |
| Klee One、Kaisei の各書体                                                                                          | なし                                                                                   | 筆意が強く、筆文字を避ける制約に反する                                                                                                                                     |
| BIZ UDMincho                                                                                                       | 判読性が高い                                                                           | 和のテイストが出ない。Noto Serif JP と同じ理由で退ける                                                                                                                     |
| 欧文に STIX Two Text（参考サイトと同じ）                                                                           | 「論文」らしさが最も強い。参考サイトの質感をそのまま再現できる                         | Times 系で、和より学術に寄る。参考サイトとの差が弱まる。オールドスタイル明朝と骨格を揃える点でも EB Garamond に劣る                                                        |
| 欧文の専用書体を入れず、Zen Old Mincho が内蔵する Latin を使う                                                     | 追加のダウンロードがない。和文と欧文の骨格が完全に一致する                             | 欧文だけを見た品質が専用書体に劣る。本文に技術用語が頻繁に出てくるので、その差が常に目に入る                                                                               |
| Google Fonts の CDN を使う                                                                                         | 導入が最も簡単。CDN のキャッシュに乗る可能性がある                                     | サードパーティのヘッダの方針に依存する。今 CORP を返すことは確かめたが、変わらない保証がない。Geist Mono がないので Fontsource と併用になり、取得元が 2 系統になる         |

## Consequences

### Positive

- 1 スライスあたりの転送量が、Noto Serif JP と比べて約 1/3 になる。
  - 成功条件「初回表示が実用速度に収まる」（LCP 2.5 秒以内）の達成を助ける。
- 和のテイストをモチーフではなく書体で担うので、桜や和柄を使わずに済む。
- self-host なので、`/playground/*` に COEP を掛けるときにフォントを載せ替えずに済む。

### Negative

- ウェイトが 400 と 600 に固定される。
  - 強調の手段は、サイズ、small-caps、letter-spacing、罫線に限られる。
  - この制限は Design System の意図でもある。
- self-host なので配信物にフォントが入り、ビルドの成果物が増える。
- 和文のフォールバック先を明示するため、フォールバックの列に `Yu Mincho` を必ず含める。
