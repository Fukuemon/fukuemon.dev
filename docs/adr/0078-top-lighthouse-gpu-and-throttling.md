# ADR-0078: トップの Lighthouse の合否を、Metal の GPU と simulate のスロットリングで 5 回測った中央値で判定する

## Status

提案

## Context

トップの性能の作業が同じ条件で合否を判定できるように、測る条件を決める必要がある。

- PRD の性能の要求は、Lighthouse の Performance が 90 以上で、LCP が 2.5 秒以内であることを求める。条件は Moto G Power、Slow 4G 相当としか決めていない。
- トップの最初の訪問は、この要求の対象から除く。2 回目以降の訪問のトップは、対象に含める。
  - ADR-0026: [トップの最初の訪問で水墨の門を描き、門をくぐった立体の庭にプロフィールを置く](0026-sumi-gate-and-garden-on-top.md)
- ADR-0026 の承認の条件は、2 回目以降の訪問の LCP と Performance が要求を超えたら、ふつうの HTML を先に出し、「庭に入る」のボタンで庭を出す形に替えると決めている。
  - ADR-0026: [トップの最初の訪問で水墨の門を描き、門をくぐった立体の庭にプロフィールを置く](0026-sumi-gate-and-garden-on-top.md)
- 本文をシステムフォントにした後のトップの値は、Metal と simulate で Performance が 92、devtools で 80〜82 だった。
  - ADR-0075: [本文をシステムフォントで描き、Web フォントを記事の題と見出しの明朝と等幅だけにする](0075-system-font-for-body-text.md)
- トップの値は、`pnpm run measure:top`（`scripts/measure-top-lighthouse.mjs`）で測る。引数を付けないときは、Metal、simulate、2 回目以降の訪問、5 回の中央値である。`--visit reduced-motion` は、動きを減らす設定で庭を出さないトップを測る。
- CI は Lighthouse を流さない。合否は、手元の Mac で手で測って判定する。
- 庭は WebGL で描く。Metal は macOS の GPU で描き、macOS でだけ動く。SwiftShader は、GPU を使わずに CPU で描く。
  - CI の庭の E2E は、GPU に依らず同じ絵にするために SwiftShader で描く（`packages/e2e/playwright.config.ts`）。
  - PageSpeed Insights が GPU を使うかは確認していない。
- 測った端末は Apple M2 である。M2 の GPU は Moto G Power の GPU より速いと推測する（比べて測っていない）。
- simulate は Lighthouse のデフォルトで、スロットリングを掛けずに読み込んだ記録から、遅い端末の値を推定する。devtools は、通信と CPU にスロットリングを掛けて読み込む。
  - Lighthouse のスロットリングの設定は、通信の遅延と帯域と CPU の倍率だけで、GPU の項目は無い（レポートの `configSettings.throttling`）。
  - PageSpeed Insights と Lighthouse の CLI のデフォルトは simulate である。
    - 出典: [Lighthouse の Network Throttling](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md)
- スクリプトは、LCP が FCP と同じ値になった回を `lcpIsFcp` で示す。庭を出すトップの simulate では、庭の最初の 1 枚がページの最初の描画に入ったと推定された回に当たり、LCP と Performance が実際より良く出る。庭を出さないトップでは、本文の描画が LCP になるので、どの回も `lcpIsFcp` になる。

## Decision

トップの合否を、次の条件で `pnpm run measure:top` を引数なしで流した値で判定する。  
条件は、スクリプトの今のデフォルトと同じである。

| 項目             | 条件                                                                             |
| ---------------- | -------------------------------------------------------------------------------- |
| GPU              | Metal（macOS の GPU）                                                            |
| スロットリング   | simulate（Lighthouse のデフォルト）                                              |
| 回数と集計       | 5 回測り、`lcpIsFcp` の回を除いて、Performance と LCP をそれぞれ中央値で判定する |
| 訪問             | 2 回目以降の訪問。庭を出さないトップは `--visit reduced-motion` で同じ条件で測る |
| 端末の画面と回線 | Lighthouse のデフォルトの mobile（Moto G Power、Slow 4G）                        |

- GPU を Metal にするのは、多くの訪問者の端末は GPU で庭を描くと推測するためである。SwiftShader の値は、GPU の無い環境で CPU が描く時間を測る。
- スロットリングを simulate にするのは、PRD の条件が Lighthouse のデフォルトの mobile を指し、PageSpeed Insights と同じ方法で外から測り直せるためである。
- 庭を出すトップでは、`lcpIsFcp` の回を除く。この回の値は推定の誤りで、合格の側に出るためである。除いた回が 3 回以上のときは、5 回を 1 度だけ測り直す。測り直しても 3 回以上のときは、判定せず、そのことを記録する。
- 庭を出さないトップでは、`lcpIsFcp` の回を除かない。
- この条件では、庭を出すトップの LCP は 2.82 秒で、要求の 2.5 秒に届かない。
- devtools と SwiftShader の値は、合否に使わない。トップの性能を変える pull request では、参考の値として devtools の Metal の値を添える。
- 庭の描画を軽くする作業は、この要求に含めない。SwiftShader を合否に使わないためである。

## 承認の条件

運営者が、次の論点に答える。  
答えが推奨と違うときは、題、Decision、Considered Options の「採用:」の行、`docs/adr/index.md` の題、スクリプトのデフォルトを、答えに合わせる。

1. 合否に使う GPU。推奨は Metal。
2. 合否に使うスロットリング。推奨は simulate。
3. 回数と集計。推奨は 5 回の中央値で、庭を出すトップでは `lcpIsFcp` の回を除き、測り直しは 1 度だけにする。
4. 庭の描画を軽くする作業を要求に含めるか。推奨は含めない。
5. 庭を出すトップの LCP が、この条件で要求を超えることの扱い。ADR-0026 の承認の条件に当たる。推奨は、ADR-0026 の取り決めを当てるか、取り決めを変えるかを、別の issue で決めることである。
6. pull request に devtools の Metal の値を添えるか。推奨は添える。

承認の後に、PRD の「トップの最初の訪問は、この条件の対象から除く。」の項目の下に、次の 1 行を足す。

> トップの合否を判定する GPU、スロットリング、回数は、ADR-0078 にある。

`apps/web/src/features/top-garden/README.md` の「Lighthouse で測る」にも、引数を付けないときの条件で合否を判定することと、ADR-0078 へのリンクを足す。

## Verification

develop の 4286172 をビルドし、`pnpm run measure:top` で測った。  
端末は Apple M2 の macOS で、Lighthouse 13.6.0、HeadlessChrome 156 である。  
ほかのセッションが動いている状態で測り、ロードアベレージは 2.4〜7.3、`benchmarkIndex` は 2986〜3173 だった。

| 訪問         | GPU         | スロットリング | 回数 | Performance（中央値と範囲） | LCP（中央値と範囲）    | TBT（中央値） | `lcpIsFcp` の回 |
| ------------ | ----------- | -------------- | ---- | --------------------------- | ---------------------- | ------------- | --------------- |
| 2 回目以降   | Metal       | simulate       | 20   | 92（91〜97）                | 2.82 s（1.50〜2.87 s） | 183 ms        | 2               |
| 2 回目以降   | Metal       | devtools       | 10   | 81（81〜82）                | 3.59 s（3.58〜3.62 s） | 247 ms        | 0               |
| 2 回目以降   | SwiftShader | simulate       | 5    | 62（58〜62）                | 1.51 s（1.50〜2.29 s） | 5115 ms       | 5               |
| 2 回目以降   | SwiftShader | devtools       | 5    | 39（38〜39）                | 6.59 s（6.54〜6.62 s） | 2522 ms       | 0               |
| 庭を出さない | Metal       | simulate       | 5    | 100（100）                  | 1.50 s（1.50〜1.51 s） | 0 ms          | 5               |
| 庭を出さない | Metal       | devtools       | 5    | 98（98）                    | 1.90 s（1.90〜1.91 s） | 0 ms          | 5               |

- Metal と simulate は、5 回ずつ 4 組を測った。組ごとの Performance の中央値は 92、93、92、92 だった。
- Metal と simulate の `lcpIsFcp` の 2 回は、Performance が 97 と 93、LCP が 1.50 秒と 2.27 秒だった。2 回を除いた 18 回は、Performance の中央値が 92、LCP が 2.82〜2.87 秒だった。
- Metal と devtools の 10 回は、1 つの山に収まった。本文をシステムフォントにする前は、load が延びる回があり、値が 2 つの山に分かれた。
- SwiftShader と simulate の 5 回は、全てが `lcpIsFcp` だった。
- 最初の訪問、記事のページ、macOS 以外の端末は測っていない。

## Considered Options

| 選択肢                                                    | 強み                                                                                                                                    | 弱み                                                                                                                     |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **採用:** Metal と simulate の 5 回の中央値               | GPU で描く端末に近い。PRD の条件の Lighthouse のデフォルトで、PageSpeed Insights と同じ方法である。スクリプトのデフォルトを変えずに済む | macOS でしか測れない。LCP は推定の値で、20 回に 2 回は実際より良く出た。M2 の GPU で描くので、GPU の時間を少なく見積もる |
| Metal と devtools の 5 回の中央値                         | 実際にスロットリングを掛けて読み込むので、LCP が描いた時刻になる。`lcpIsFcp` の回が出ず、10 回の範囲が simulate より狭い                | PageSpeed Insights と方法が違い、外から同じ値で測り直せない。macOS でしか測れない。M2 の GPU で描く                      |
| SwiftShader と simulate の 5 回の中央値                   | どの OS でも測れる。CI の庭の E2E と同じ描き方である                                                                                    | 5 回とも `lcpIsFcp` で、LCP の値を判定に使えない。GPU の無い環境で CPU が描く時間を測り、GPU で描く端末の値と離れる      |
| SwiftShader と devtools の 5 回の中央値                   | どの OS でも測れる。GPU の無い環境の値を測る                                                                                            | GPU で描く端末の値と離れる。合否に使うなら、庭の描画を軽くする作業を要求に含めることになる                               |
| 庭の描画を軽くする作業を要求に含める                      | GPU の無い端末と、GPU を使えないブラウザの訪問者も、要求の対象になる                                                                    | SwiftShader を合否に使うときにだけ要る。作業の範囲が、測る条件を決めることから、庭の描き方を変えることに広がる           |
| 回数を 5 回より増やすか、中央値の代わりに最も悪い値を使う | 外れた回が判定に入る                                                                                                                    | 測る時間が延びる。Metal と simulate の 4 組では、組ごとの中央値の差が 1 だった                                           |

## Consequences

### Positive

- トップの性能の作業が、同じ条件で合否を判定できる。
- スクリプトのデフォルトを変えずに済む。今までの Metal と simulate の値と、そのまま比べられる。

### Negative

- この条件でも、庭を出すトップの LCP は 2.5 秒に届かない。ADR-0026 の承認の条件の扱いを、別に決める必要がある。
- M2 の GPU で描くので、Moto G Power で庭を描く時間を少なく見積もる。
- macOS の無い環境では、合否を判定できない。
- GPU の無い端末と、GPU を使えないブラウザの訪問者の遅さは、合否に入らない。SwiftShader では、M2 の CPU でも庭の最初の描画に数秒かかる。
- simulate の推定が、実際の読み込みより速く出ることがある。devtools の値を参考に添えないと、気づきにくい。
- `lcpIsFcp` の回を除く集計は、スクリプトの中央値と違う。判定する人が、`rows` から数え直す。
