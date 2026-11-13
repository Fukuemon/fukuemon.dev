# ADR-0016: mermaid の図を、ビルドでも島でも Pele で SVG にする

## Status

承認

## Context

ADR-0009 は、`mermaid` のフェンスをビルドのときに SVG にし、`mermaid run` のフェンスをクライアントの島で描くと決めた。  
ビルドのときの描画には `rehype-mermaid` を使っている。  
`rehype-mermaid` は `mermaid-isomorphic` を経由して `playwright` を peer dependency に持ち、headless の chromium の中で mermaid を動かす。  
ADR-0009: [サイトを about / blog / playground の 3 つのセクションに分け、playground を collection にする](0009-site-sections-and-playground-collection.md)

chromium を使う描画には、次の制約がある。

- CI の Check と Deploy の workflow は、build の前に chromium を取得する。
  - 取得の step は、Check で 22〜24 秒（成功した 5 回）、Deploy で 22〜30 秒（成功した 3 回）かかった。
- mermaid は箱の大きさを chromium の中の書体で測るので、図の書体を環境をまたいで字幅の揃う総称に固定している。
- mermaid は色を確定した文字列でしか受け取らない。
  - 目印の色で描かせ、SVG が出てから rehype のプラグインでトークンへ置き換えている。

Pele（npm の `pele`、MIT）は、mermaid の記法を、ブラウザを使わずに Node で SVG にする。  
依存を持たず、`render(source)` が同期で SVG の文字列を返す。  
色は `--pele-fg` や `--pele-line` のような CSS 変数で付き、描き直さずに配色を切り替えられる。  
出典: [Pele](https://pele.run/)  
出典: [Pele の Theming](https://pele.run/theming)

Pele は mermaid と別の実装で、レイアウトと見た目は mermaid と同じにならない。  
npm には、1.5.1、1.5.2、1.6.0 が 3 日のあいだに出ている。

`mermaid run` の島は、まだ実装していない。

## Decision

`mermaid` のフェンスを、ビルドのときに Pele で SVG にする。  
`apps/web/src/lib/rehype-mermaid.ts` が、Expressive Code より前に `<pre><code class="language-mermaid">` を Pele の SVG に置き換える。  
色は、`apps/web/src/styles/site.css` が Pele の CSS 変数をトークンへ対応させる。

理由は 3 つある。

- build に chromium が要らなくなる。CI の chromium の取得の step を消せる。
- 色を CSS 変数で渡せるので、目印の色を描かせて置き換える処理が要らない。
- 明暗の配色を、1 枚の SVG のまま CSS だけで切り替えられる。

Pele は Node では書体を測れず、組み込みの字幅で箱の大きさを決める。  
`render` に渡す書体を変えても箱の幅は変わらないので、図の書体を Arial と同じ字幅の総称に固定する。

`pele` のバージョンは、範囲で書かずに 1 つに固定する。  
リリースの間隔が短く、レイアウトが変わると図の見た目が変わるためである。

`mermaid run` の島も、Pele で描く。  
ビルドと島で同じ描画にすると、書き換える前と後で図の見た目が変わらない。  
配る量も減る。1 つのファイルにまとめた版で比べると、mermaid 11.17.2 の `mermaid.min.js` は gzip で 953 KiB、Pele 1.6.0 の `pele.global.js` は gzip で 246 KiB だった。  
flowchart だけを登録して esbuild でまとめると、Pele は gzip で 43 KiB だった。

この決定は、ADR-0009 の「mermaid はフェンスの `run` で 2 通りに分ける」のうち、描画の手段を置き換える。  
フェンスの `run` の有無で、ビルドのときの描画とクライアントの島の描画に分ける規則は変えない。

## Verification

- 計測は、手元の macOS で `astro build` を 3 回ずつ、`node_modules/.astro` と `.astro` と `dist` を消してから実行した。
  - `rehype-mermaid` のとき: 3.41 秒、2.51 秒、2.61 秒
  - Pele のとき: 3.07 秒、1.99 秒、1.95 秒
- `/labs/vacuum-and-bloat` の 4 つの flowchart を、明暗の配色と 500px と 1280px の幅で、変更の前後に撮って比べた。
  - 日本語のラベルは箱からはみ出さず、文字は重ならない。
  - 暗い配色でも、文字と線と枠が地から読み取れる。
- Pele 1.6.0 の `render` は、`fontFamily` を変えても同じ幅の SVG を返した。

## Considered Options

| 選択肢                                           | 強み                                                                                                                        | 弱み                                                                                                                                                                     |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **採用:** Pele で SVG にする                     | build に chromium が要らない。色を CSS 変数で渡せる。ビルドと島で同じ描画にできる。全部の図の種類を入れても gzip で 246 KiB | mermaid と別の実装で、レイアウトが mermaid と同じにならない。GitHub が描く図と見た目が変わる。リリースが新しく、間隔が短い。書体の字幅を組み込みの値に合わせる必要がある |
| `rehype-mermaid` で SVG にする（現状、ADR-0009） | mermaid 本体で描くので、レイアウトが mermaid と同じになる                                                                   | build と CI に chromium が要る。色を目印で描かせて置き換える処理が要る。書体を総称に固定する必要がある                                                                   |
| `@beoe/rehype-mermaid` で SVG にする             | 出力を svgo で縮められる                                                                                                    | `mermaid-isomorphic` を使うので、`rehype-mermaid` と同じく `playwright` と chromium が要る                                                                               |
| `@mermaid-js/mermaid-cli` で SVG にする          | mermaid の公式の CLI で、レイアウトが mermaid と同じになる                                                                  | `puppeteer` を peer dependency に持ち、chromium が要る。rehype のプラグインを自前で書く必要がある                                                                        |

## Consequences

### Positive

- build と CI に chromium が要らない。Check と Deploy の workflow から、chromium の取得の step を消せる。
- `apps/web` の依存から `rehype-mermaid` と `playwright` を外せる。
- 図の色を、トークンへの対応を書いた CSS だけで変えられる。
- `mermaid run` の島を足すとき、ビルドの描画と同じ見た目になる。

### Negative

- 同じフェンスを、GitHub は mermaid で、このサイトは Pele で描くので、図の見た目が違う。
- Pele が対応しない mermaid の記法を書くと、build が失敗する。
- `pele` を上げるときは、図の見た目の変化を撮って比べる必要がある。
- 図の書体は、Pele の組み込みの字幅に合う総称から変えられない。
