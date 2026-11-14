# ADR-0078: トップの Lighthouse の合否を、Metal の GPU と simulate のスロットリングで 5 回測った中央値で判定する

## Status

提案

## Context

トップの性能の作業が同じ条件で合否を判定できるように、測る条件を決める必要がある。

- PRD の性能の要求は、Lighthouse の Performance が 90 以上で、LCP が 2.5 秒以内であることを求める。条件は Moto G Power、Slow 4G 相当としか決めていない。
- トップの最初の訪問は、この要求の対象から除く。2 回目以降の訪問のトップは、対象に含める。
  - ADR-0026: [トップの最初の訪問で水墨の門を描き、門をくぐった立体の庭にプロフィールを置く](0026-sumi-gate-and-garden-on-top.md)
- 本文をシステムフォントにした後のトップの値は、Metal と simulate で Performance が 92、devtools で 80〜82 だった。
  - ADR-0075: [本文をシステムフォントで描き、Web フォントを記事の題と見出しの明朝と等幅だけにする](0075-system-font-for-body-text.md)
- トップの値は、`pnpm run measure:top`（`scripts/measure-top-lighthouse.mjs`）で測る。引数を付けないときは、Metal、simulate、2 回目以降の訪問、5 回の中央値である。
- CI は Lighthouse を流さない。合否は、手元の Mac で手で測って判定する。
- 庭は WebGL で描く。Metal は macOS の GPU で描き、macOS でだけ動く。SwiftShader は、GPU を使わずに CPU で描く。
  - CI の庭の E2E は、GPU に依らず同じ絵にするために SwiftShader で描く（`packages/e2e/playwright.config.ts`）。
  - PageSpeed Insights が GPU を使うかは確認していない。
- simulate は Lighthouse のデフォルトで、スロットリングを掛けずに読み込んだ記録から、遅い端末の値を推定する。devtools は、通信と CPU にスロットリングを掛けて読み込む。どちらも GPU の速さは落とさない。
  - PageSpeed Insights は simulate で測る。出典: [Lighthouse の Network Throttling](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md)
- simulate では、庭の最初の 1 枚がページの最初の描画に入った回に、LCP が FCP と同じ値になる。スクリプトは、その回を `lcpIsFcp` で示す。この回の LCP は、庭が速く出たことを示さない。

## Decision

トップの合否を、次の条件で `pnpm run measure:top` を引数なしで流した値で判定する。  
条件は、スクリプトの今のデフォルトと同じである。

| 項目             | 条件                                                      |
| ---------------- | --------------------------------------------------------- |
| GPU              | Metal（macOS の GPU）                                     |
| スロットリング   | simulate（Lighthouse のデフォルト）                       |
| 回数と集計       | 5 回測り、Performance と LCP をそれぞれ中央値で判定する   |
| 訪問             | 2 回目以降の訪問                                          |
| 端末の画面と回線 | Lighthouse のデフォルトの mobile（Moto G Power、Slow 4G） |

- GPU を Metal にするのは、訪問者の端末は GPU で庭を描くためである。Moto G Power も GPU を持つ。SwiftShader の値は、GPU の無い環境で CPU が描く時間を測る。
- スロットリングを simulate にするのは、Lighthouse のデフォルトで、同じ条件の 20 回の Performance が 91〜97 に収まったためである。
- 中央値を使うのは、5 回のうち `lcpIsFcp` の回が 1 回あっても、中央値が動かないためである。20 回のうち `lcpIsFcp` の回は 2 回だった。
- 5 回のうち 3 回以上が `lcpIsFcp` なら、LCP の中央値で判定せず、測り直す。
- devtools と SwiftShader の値は、合否に使わない。トップの性能を変える pull request では、参考の値として devtools の Metal の値を添える。
- 庭の描画を軽くする作業は、この要求に含めない。SwiftShader を合否に使わないためである。

## 承認の条件

運営者が、次の 4 つの論点に答える。  
答えが推奨と違うときは、この ADR の Decision と、スクリプトのデフォルトを答えに合わせる。

1. 合否に使う GPU。推奨は Metal。
2. 合否に使うスロットリング。推奨は simulate。
3. 回数と集計。推奨は 5 回の中央値。
4. 庭の描画を軽くする作業を要求に含めるか。推奨は含めない。

## Verification

develop の 4286172 をビルドし、`pnpm run measure:top` で 2 回目以降の訪問を測った。  
端末は Apple M2 の macOS で、Lighthouse 13.6.0、HeadlessChrome 156 である。  
ほかのセッションが動いている状態で測り、ロードアベレージは 2.4〜7.3、`benchmarkIndex` は 2986〜3173 だった。

| GPU         | スロットリング | 回数 | Performance（中央値と範囲） | LCP（中央値と範囲）    | TBT（中央値） | `lcpIsFcp` の回 |
| ----------- | -------------- | ---- | --------------------------- | ---------------------- | ------------- | --------------- |
| Metal       | simulate       | 20   | 92（91〜97）                | 2.82 s（1.50〜2.87 s） | 183 ms        | 2               |
| Metal       | devtools       | 10   | 81（81〜82）                | 3.59 s（3.58〜3.62 s） | 247 ms        | 0               |
| SwiftShader | simulate       | 5    | 62（58〜62）                | 1.51 s（1.50〜2.29 s） | 5115 ms       | 5               |
| SwiftShader | devtools       | 5    | 39（38〜39）                | 6.59 s（6.54〜6.62 s） | 2522 ms       | 0               |

- Metal と simulate は、5 回ずつ 4 組を測った。組ごとの中央値は 92、93、92、92 で、どの組も 90 を超えた。
- Metal と simulate の LCP は、`lcpIsFcp` の 2 回を除くと 2.82〜2.87 秒だった。どの組の中央値も 2.5 秒に届かない。
- Metal と devtools の 10 回は、1 つの山に収まった。本文をシステムフォントにする前は、load が延びる回があり、値が 2 つの山に分かれた。
- SwiftShader と simulate の 5 回は、全てが `lcpIsFcp` だった。LCP の 1.51 秒は、庭が速く出たことを示さない。
- 最初の訪問、記事のページ、macOS 以外の端末は測っていない。

## Considered Options

| 選択肢                                                    | 強み                                                                                                                                                        | 弱み                                                                                                                                                         |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **採用:** Metal と simulate の 5 回の中央値               | GPU で描く訪問者に近い。Lighthouse のデフォルトなので、PageSpeed Insights と同じスロットリングの方法である。20 回の範囲が狭く、組ごとの中央値が合否で揃った | macOS でしか測れない。simulate の LCP は推定の値で、`lcpIsFcp` の回は実際より速く出る。M2 の GPU は Moto G Power の GPU より速く、GPU の時間を少なく見積もる |
| Metal と devtools の 5 回の中央値                         | 実際にスロットリングを掛けて読み込むので、LCP が描いた時刻になる。`lcpIsFcp` の回が出ない                                                                   | Performance は 81 で、本文の書体を変えた後も 90 に届かない。本文をシステムフォントにする前は、値が 2 つの山に分かれた。macOS でしか測れない                  |
| SwiftShader と simulate の 5 回の中央値                   | どの OS でも測れる。CI の庭の E2E と同じ描き方である                                                                                                        | 5 回とも `lcpIsFcp` で、LCP の値を判定に使えない。TBT は 5 秒を超え、GPU の無い環境で CPU が描く時間を測る                                                   |
| SwiftShader と devtools の 5 回の中央値                   | どの OS でも測れる。GPU の無い環境で最も遅い場合を測る                                                                                                      | Performance は 39 で、合否に使うには、庭の描画を軽くする作業が要る。GPU で描く訪問者の値と離れる                                                             |
| 回数を 5 回より増やすか、中央値の代わりに最も悪い値を使う | 外れた回が判定に入る                                                                                                                                        | 測る時間が延びる。Metal と simulate の 20 回では、どの 5 回の組も合否が揃ったので、増やしても判定が変わらなかった                                            |

## Consequences

### Positive

- トップの性能の作業が、同じ条件で合否を判定できる。
- スクリプトのデフォルトを変えずに済む。今までの Metal と simulate の値と、そのまま比べられる。

### Negative

- この条件でも、LCP の 2.5 秒には届かない。届かせる作業は、別に要る。
- macOS の無い環境では、合否を判定できない。
- GPU の無い端末と、GPU を使えないブラウザの訪問者の遅さは、合否に入らない。SwiftShader では、庭の最初の描画に CPU で数秒かかる。
- simulate の推定が、実際の読み込みより速く出ることがある。devtools の値を参考に添えないと、気づきにくい。
