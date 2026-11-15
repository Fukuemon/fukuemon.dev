# トップの水墨の門と立体の庭

このディレクトリは、トップの最初の訪問に出す墨の絵の SVG を作るコードと、門の内側の立体の庭を three で描くコードを持つ。

コードの構成と見た目の数値は、[トップの水墨の門と立体の庭の Design Doc](DesignDoc.md) にある。

## Testing

テストは、リポジトリの直下で次を実行する。

```sh
pnpm --filter @fukuemon/web exec vitest run src/features/top-garden
```

止めた庭の絵の見た目の回帰、和紙の間の移動、WebGL を使えないときの E2E は、`packages/e2e/tests/specs/garden/` にある。
実行の方法と基準のスナップショットの作り直し方は、[E2E のテスト](../../../../../context/testing/e2e.md) にある。

## Lighthouse で測る

トップの Lighthouse の値は、リポジトリの直下で、ビルドの後に次を実行して測る。

```sh
pnpm run build
pnpm run measure:top
```

引数を付けないときは、2 回目以降の訪問の状態で 5 回測り、中央値を出す。

PRD の性能の要求の合否は、[ADR-0078](../../../../../docs/adr/0078-top-lighthouse-gpu-and-throttling.md) の条件で判定する。

- 庭を出すトップは引数を付けずに、庭を出さないトップは `--visit reduced-motion` だけを付けて測る。
  - ほかの引数を付けて測った値は、合否に使わない。summary の `adrConditions` は、ADR-0078 の条件で測ったときに true になる。
- 合否には、`lighthouse-results/` の `<日時>-<条件>-summary.json` の `judged.median` を使う。同じファイルの `median` は全ての回の中央値で、合否に使わない。
  - `judged` は、庭を出すトップでは `lcpIsFcp` の回を除いて中央値を取る。除いた回数は `excludedRuns` に、残った回数は `keptRuns` にある。
  - 全ての回を除いたときは、`judged.median` が null になる。途中の回が失敗したときは、`judged` を書かない。
  - `excludedRuns` が 3 以上のときは、スクリプトが標準エラーに知らせる。5 回を 1 度だけ測り直す。測り直しても 3 以上のときは、判定せず、そのことを記録する。
- トップの性能を変える pull request には、合否の値に加えて、`--throttling devtools` で測った値を参考に添える。

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

## イントロの最長タスクとコマ落ちを測る

最初の訪問のイントロは、Lighthouse の記録が終わるより後まで続くので、`measure:top-intro` で測る。
リポジトリの直下で、ビルドの後に次を実行する。

```sh
pnpm run build
pnpm run measure:top-intro
```

スクリプトは、新しいプロファイルで Chrome を起動し、`fd-top-seen` の無い状態でトップを開く。
renderer のメインスレッドの CPU にスロットリングを掛けて、`garden-ready` の 1 秒後まで trace を撮る。

前提は、Playwright の Chromium が入った macOS で動かすことである。
GPU は Metal に固定する。

- `--runs` は回数で、デフォルトは 5 である。
- `--cpu` は CPU のスロットリングの倍率で、デフォルトは 4 である。
- `--bundle-delay <ms>` は、場面のバンドルの応答を遅らせる。場面の組み立てが、墨の線を描く遷移と重なる条件を作る。
- `--dist` は配信するディレクトリで、`--out` は結果の出力先である。
- 区間ごとに、メインスレッドの最長のタスクと、50 ms を超えたタスクの数と、`STATE_DROPPED` のフレームの数を出す。
- 回ごとの値と中央値を、`intro-results/` に書く。
- 区間の定義は、スクリプトの先頭のコメントにある。
- `intro-results/` は Git で追跡しない。

CPU のスロットリングは、メインスレッドだけに掛かる。
ラスタライズと GPU の処理には掛からない。
そのため、filter の描き直しに掛かる時間は、遅い端末より短く出る。
