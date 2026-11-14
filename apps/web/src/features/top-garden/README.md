# トップの水墨の門と立体の庭

このディレクトリは、トップの最初の訪問に出す墨の絵の SVG を作るコードと、門の内側の立体の庭を three で描くコードを持つ。

コードの構成と見た目の数値は、[トップの水墨の門と立体の庭の Design Doc](DesignDoc.md) にある。
Design Doc の数値は、[試作](../../../../../docs/design/prototypes/top/README.md) のコードから取った。

## Testing

テストは、リポジトリの直下で次を実行する。

```sh
pnpm --filter @fukuemon/web exec vitest run src/features/top-garden
```

止めた庭の絵の見た目の回帰、和紙の間の移動、WebGL を使えないときの E2E は、`packages/e2e/tests/specs/garden/` にある。
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
