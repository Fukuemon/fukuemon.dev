# トップの水墨の門と立体の庭

このディレクトリは、トップの最初の訪問に出す墨の絵の SVG を作るコードと、門の内側の立体の庭を three で描くコードを持つ。
墨の絵と立体の庭の場面の両方が読む、庭の配置も持つ。
トップのプロフィールの本文も持つ。
墨の絵の SVG を作るモジュール（`layout.ts`、`ink/brush.ts`、`ink/ink-art.ts`、`ink/ink-svg.ts`）は、React と DOM に依らない TypeScript である。
ビルドのときに Node で動く。
`ink/InkGate.astro` は、ヘッダーのロゴと同じ `sign.svg` を [`components/sign/`](../../components/sign/README.md) から読む。
`stage/stage.ts` の `stageScript` は、`stage/season.ts` と `stage/visit.ts` の関数と `applyStage` を、文字列にしてトップの `head` の inline script に埋め込む。
埋め込んだ関数は、ブラウザで、表示の前に動く。
`readOverride` は、開発のビルドの inline script にだけ埋め込む。

見た目の数値は、[トップの水墨の門と立体の庭の Design Doc](../../../../../docs/design/features/top-garden/DesignDoc.md) にある。
Design Doc の数値は、[試作](../../../../../docs/design/prototypes/top/README.md) のコードから取った。

## Structure

コードは、墨の絵、`head` のスクリプト、立体の場面という関心ごとで、3 つのディレクトリに分ける。
それぞれ、動く場所と制約が違う。
墨の絵と場面の両方が読む `layout.ts`、`rng.ts`、`intro-timing.ts` は、このディレクトリの直下に置く。
`Profile.astro` は、3 つのどれにも当たらないので、直下に置く。
ディレクトリの間の import は、`scene/` から `stage/` へは型だけ、`stage/` から `scene/` へは場面のバンドルの URL（`?worker&url`）だけにする。
`ink/` と `scene/` は、互いを import しない。
この 3 つの向きは、`oxlint.config.ts` の `no-restricted-imports` が止める。
`pnpm run lint` が、向きに反する import で失敗する。
`stage/` から `scene/` へは、`?worker&url` 以外の接尾辞と、接尾辞の無い import を止める。
`scene/` から `stage/` へは、`import type` だけを通す。
`import { type X }` の形は、Oxlint が通すので、`import type` を使う。
`../stage/../scene` のように、途中で戻るパスと、直下のファイルを通った間接の import は、止めない。

| ディレクトリ | 動く場所                                           | 制約                                                                                               |
| ------------ | -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `ink/`       | ビルドのときの Node                                | React、DOM、three に依らない                                                                       |
| `stage/`     | トップの `head` の inline script（ブラウザ）       | `season.ts`、`visit.ts`、`stage.ts` の関数は文字列にして埋め込むので、関数の外の名前を参照できない |
| `scene/`     | ブラウザの場面のバンドル（`garden-entry.ts` 起点） | three を import してよい                                                                           |

| ファイル                     | 持つもの                                                                                                                                                                                                                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layout.ts`                  | 門、塀、飛び石、山並み、池、和紙を掛ける 4 つの場所の配置と、最初のカメラの投影                                                                                                                                                                                                              |
| `rng.ts`                     | 墨の絵と立体の場面の両方が使う、シードから決まった順の値を返す乱数                                                                                                                                                                                                                           |
| `intro-timing.ts`            | 最初の訪問のイントロの時刻。墨の絵の CSS（`ink/InkGate.astro`）と、場面のバンドルの両方が読む                                                                                                                                                                                                |
| `Profile.astro`              | プロフィールの 4 つのセクションの本文と、庭を出すときにセクションを和紙の上の文として見せる CSS                                                                                                                                                                                              |
| `ink/brush.ts`               | 筆の線と松の円を配列に足していく `brush`                                                                                                                                                                                                                                                     |
| `ink/ink-art.ts`             | 墨の絵の線を、山並み、塀、門、飛び石、石、松の順に作る                                                                                                                                                                                                                                       |
| `ink/ink-svg.ts`             | 線を、線ごとの `path` を持つ 1 枚の SVG の文字列にする                                                                                                                                                                                                                                       |
| `ink/InkGate.astro`          | 墨の絵と署名を、描き終えた状態で出す Astro のコンポーネント。トップでは、`scene/GardenStage.astro` の slot に置く。`html` に class `intro` と `enter` が付いている間の、筆の順に描く動きと、線を消す動きの CSS も持つ                                                                        |
| `stage/season.ts`            | 端末の日付と時刻から、季節と時間帯を返す                                                                                                                                                                                                                                                     |
| `stage/visit.ts`             | 端末で初めてトップを開いたかを返す                                                                                                                                                                                                                                                           |
| `stage/stage.ts`             | 季節と時間帯を `html` の属性に、庭を出すかと最初の訪問かを class に書く。場面の準備が 6 秒で終わらなければ、ふつうのページに戻す。URL の引数を読む関数と、`head` の inline script を組み立てる関数も持つ                                                                                     |
| `stage/TopStageScript.astro` | `stage.ts` が組み立てた inline script を、トップの `head` に置く。場面のバンドルの URL を渡す                                                                                                                                                                                                |
| `scene/scene-colors.ts`      | 時間帯ごとの場面の色と光の表、季節の木の葉の色、2 つを掛け合わせて場面の色を決める関数。場面の色の値は、このファイルだけに書く                                                                                                                                                               |
| `scene/scene-parts.ts`       | 石、木、灯籠を作る関数と、canvas に描いた絵をテクスチャにする関数。石、木、灯籠は、後から絵やモデルに差し替えられるよう、物ごとに関数を分けてある                                                                                                                                            |
| `scene/scene.ts`             | 配置と場面の色から、門、塀、飛び石、石、池、灯籠、松、季節の木、空、遠景、地面を組み立てる                                                                                                                                                                                                   |
| `scene/paper.ts`             | 和紙と軸木と紐を組む。和紙を掛ける木から和紙の上の両端へ枝を伸ばす                                                                                                                                                                                                                           |
| `scene/ink-pass.ts`          | 場面を描いた絵に、墨の輪郭線、淡彩、紙の質感、端の余白を重ねる全画面のパス                                                                                                                                                                                                                   |
| `scene/garden.ts`            | canvas に庭を描く。最初の訪問では、墨だけの絵から色を差し、カメラが門をくぐる。プロフィールの 4 つのセクションを CSS3DRenderer で和紙の位置に置く。カメラが動く間だけフレームごとに描く。WebGL を使えないときは何も描かない                                                                  |
| `scene/garden-entry.ts`      | 場面のバンドルで最初に動くファイル。最初の訪問のイントロの段を進め、「飛ばす」のボタン、Esc、Tab で最後の状態にする。庭の中のボタン、矢印キー、セクションへのフォーカスを和紙の間の移動につなぐ。庭を描けないときは、庭とイントロの class をすべて外してふつうのページに戻す                 |
| `scene/GardenStage.astro`    | canvas と、庭の中のボタンと、画面の上端と下端の霞を置く。イントロの墨の絵を slot に受け取り、「飛ばす」のボタンと、イントロの間の canvas とヘッダーと霞の CSS と、フォーカスが当たった「本文へスキップ」を庭とヘッダーより上に出す CSS を持つ。`stage-on` が付いたときだけ、画面の全体に出す |

## 同じシードから同じ絵ができる

同じシードからは、同じ線のデータと、同じ SVG の文字列ができる。
乱数を使う順は、試作の `docs/design/prototypes/top/src/h-strokes.mjs` と同じにしてある。
線を足すか、消すか、並べ替えると、それより後の線がすべて変わる。

試作の `i-mon.html` の墨の絵の 281 本の線の後ろに、`ink/ink-trees.ts` が、塀の向こうと門の奥の木の線を足す。
木の線は、試作の線より後に乱数を使うので、試作の線を変えない。
出力は、線が 393 本、`path` が 543 本である。
SVG のサイズの上限は gzip で 45 KB で、ユニットテストが確認する。

## Testing

テストは、リポジトリの直下で次を実行する。

```sh
pnpm --filter @fukuemon/web exec vitest run src/features/top-garden
```

止めた庭の絵の見た目の回帰、和紙の間の移動、WebGL を使えないときの E2E は、`packages/e2e/visual/specs/` にある。
実行の方法と基準のスナップショットの作り直し方は、[E2E のテスト](../../../../../context/testing/e2e.md) にある。

## Lighthouse で測る

トップの Lighthouse の値は、リポジトリの直下で、ビルドの後に次を実行して測る。
引数を付けないときは、2 回目以降の訪問の状態で 5 回測り、中央値を出す。

```sh
pnpm run build
pnpm run measure:top
```

前提は次のとおり。

- Playwright の Chromium が入っている（`pnpm exec playwright install chromium`）。
- 引数を付けないときの GPU の条件（Metal）は、macOS でだけ動く。

引数は、`pnpm run measure:top --visit first` のように後ろに付ける。

- `--visit` は、測る訪問の種類を選ぶ。
  - `first` は最初の訪問を測る。
  - `reduced-motion` は、動きを減らす設定で庭を出さないトップを測る。
- `--gpu swiftshader` は、GPU を使わずに CPU で WebGL を描く条件で測る。
  - 付けないときは、macOS の Metal で描く。
- `--throttling devtools` は、通信と CPU にスロットリングを掛けて読み込んで測る。
  - 付けないときの `simulate` は、スロットリングを掛けずに読み込んだ記録から値を推定する。

結果と、本番との違いは次のとおり。

- 結果は `lighthouse-results/` に書く。
  - 実行ごとのレポートの JSON と最後のスクリーンショット、中央値の JSON を書く。
  - Git では追跡しない。
- 値は手元の負荷で変わる。
  - 結果の JSON には、実行の前と後のロードアベレージと、Lighthouse の `benchmarkIndex` を書く。
- 配信は TLS の無い HTTP/1.1 と gzip なので、本番の配信とは通信の値が違う。
- 2 回目以降の訪問として再現するのは、`fd-top-seen` の値だけである。
  - HTTP のキャッシュとシェーダのキャッシュは空にして測る。
  - 本番の `/_astro/` は長くキャッシュされるので、実際の 2 回目以降の訪問とは通信の条件が違う。
