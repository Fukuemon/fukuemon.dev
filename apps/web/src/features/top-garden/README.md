# トップの水墨の門と立体の庭

このディレクトリは、トップの最初の訪問に出す墨の絵の SVG を作るコードと、門の内側の立体の庭を three で描くコードを持つ。
墨の絵と立体の庭の場面の両方が読む、庭の配置も持つ。
トップのプロフィールの本文も持つ。
墨の絵の SVG を作るモジュール（`layout.ts`、`brush.ts`、`ink-art.ts`、`ink-svg.ts`）は、React と DOM に依らない TypeScript で、ビルドのときに Node で動く。
`InkGate.astro` は、ヘッダーのロゴと同じ `sign.svg` を [`components/sign/`](../../components/sign/README.md) から読む。
`stage.ts` の `stageScript` は、`season.ts` と `visit.ts` の関数と `applyStage` を、文字列にしてトップの `head` の inline script に埋め込む。
埋め込んだ関数は、ブラウザで、表示の前に動く。
`readOverride` は、開発のビルドの inline script にだけ埋め込む。

見た目の数値は、[トップの水墨の門と立体の庭の Design Doc](../../../../../docs/design/features/top-garden/DesignDoc.md) にある。
Design Doc の数値は、[試作](../../../../../docs/design/prototypes/top/README.md) のコードから取った。

## Structure

| ファイル               | 持つもの                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layout.ts`            | 門、塀、飛び石、山並み、池、和紙を掛ける 4 つの場所の配置と、最初のカメラの投影                                                                   |
| `rng.ts`               | 墨の絵と立体の場面の両方が使う、シードから決まった順の値を返す乱数                                                                                |
| `brush.ts`             | 筆の線と松の円を配列に足していく `brush`                                                                                                          |
| `ink-art.ts`           | 墨の絵の線を、山並み、塀、門、飛び石、石、松の順に作る                                                                                            |
| `ink-svg.ts`           | 線を、線ごとの `path` を持つ 1 枚の SVG の文字列にする                                                                                            |
| `InkGate.astro`        | 墨の絵と署名を、アニメーションなしの、描き終えた状態で出す Astro のコンポーネント                                                                 |
| `Profile.astro`        | プロフィールの 4 つのセクションの本文                                                                                                             |
| `season.ts`            | 端末の日付と時刻から、季節と時間帯を返す                                                                                                          |
| `visit.ts`             | 端末で初めてトップを開いたかを返す                                                                                                                |
| `stage.ts`             | 季節と時間帯を `html` の属性に、庭を出すかと最初の訪問かを class に書く。URL の引数を読む関数と、`head` の inline script を組み立てる関数も持つ   |
| `TopStageScript.astro` | `stage.ts` が組み立てた inline script を、トップの `head` に置く。場面のバンドルの URL を渡す                                                     |
| `scene-colors.ts`      | 時間帯ごとの場面の色と光の表、季節の木の葉の色、2 つを掛け合わせて場面の色を決める関数。場面の色の値は、このファイルだけに書く                    |
| `scene-parts.ts`       | 石、木、灯籠を作る関数と、canvas に描いた絵をテクスチャにする関数。石、木、灯籠は、後から絵やモデルに差し替えられるよう、物ごとに関数を分けてある |
| `scene.ts`             | 配置と場面の色から、門、塀、飛び石、石、池、灯籠、松、季節の木、空、遠景、地面を組み立てる                                                        |
| `ink-pass.ts`          | 場面を描いた絵に、墨の輪郭線、淡彩、紙の質感、端の余白を重ねる全画面のパス                                                                        |
| `garden.ts`            | canvas に庭を描く。WebGL を使えないときは何も描かない                                                                                             |
| `garden-entry.ts`      | 場面のバンドルで最初に動くファイル。庭を描けないときは、`stage-on` と `intro` を外してふつうのページに戻す                                        |
| `GardenStage.astro`    | 庭を描く canvas を置く。`stage-on` が付いたときだけ、画面の全体に出す                                                                             |

## 同じシードから同じ絵ができる

同じシードからは、同じ線のデータと、同じ SVG の文字列ができる。
乱数を使う順は、試作の `docs/design/prototypes/top/src/h-strokes.mjs` と同じにしてある。
線を足すか、消すか、並べ替えると、それより後の線がすべて変わる。

出力は、線が 281 本、`path` が 415 本で、試作の `i-mon.html` の墨の絵と同じ文字列である。
SVG のサイズの上限は gzip で 40 KB で、ユニットテストが確認する。

## Testing

テストは、リポジトリの直下で次を実行する。

```sh
pnpm --filter @fukuemon/web exec vitest run src/features/top-garden
```

止めた庭の絵の見た目の回帰と、WebGL を使えないときの E2E は、`apps/web/e2e/` にある。
実行の方法と基準のスナップショットの作り直し方は、[E2E のテスト](../../../../../context/testing/e2e.md) にある。
