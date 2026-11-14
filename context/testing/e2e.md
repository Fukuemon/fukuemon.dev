---
type: context
title: E2E のテスト
description: E2E のテストのツールでの書き方、testid の名前、lint の規則に渡す値、流すコマンドと環境、テストデータ、待つ時間の決め方
status: draft
---

# E2E のテスト

## Test Tool

<!-- E2E のテストのツール。ツールの API のうち、スキル write-e2e-test が一般の語で書いたものの名前。確認（自動で待つ assertion）、testid で要素を拾う方法、通信の差し替え、新しいタブの受け取り、ページを読み込むたびに実行するスクリプト、時計の差し替えと時刻の固定、準備の project とログインの状態のファイル -->

## Test IDs

<!-- testid の名前の付け方。画面 ID の形と、画面の接頭辞の付け方。共通のコンポーネントに渡した testid が付く先の調べ方 -->

## Lint Rule Options

<!-- テストの書き方の lint の規則（スキル setup-e2e-lint で写したもの）の置き場、渡す値、lint を流すディレクトリ。テストのディレクトリ（既定の tests と違うとき）、固定の待ちを許すファイル、待つ時間の名前を定めるファイル、widgets/ に書いてはいけない画面 ID の形、widgets/ が開いてよい URL。本物の backend につなぐ spec の形、モックを張る関数の名前、モックの置き場 -->

## Running Tests

<!-- 流すコマンド、テストのプロジェクトの分け方（準備と E2E）と CI で流す範囲、向ける環境と URL、worker の数とその理由、lint と型のチェックのコマンド。backend を差し替えて流す spec と本物の backend につなぐ spec の見分け方（ファイル名かプロジェクト）。エビデンスを撮る撮影の設定があれば、その置き場 -->

### apps/web の E2E と見た目の回帰

`apps/web/e2e/` の spec は、ビルドした `apps/web/dist/` を `astro preview` で配信して実行する。
記事のページの表と図の枠の E2E も、同じ config（`apps/web/e2e/playwright.config.ts`）とコマンドで実行する。
CI では、`pnpm run check` がビルドの後に実行する。
ローカル環境では、ビルドしてから次を実行する。

```sh
pnpm run build
pnpm run test:visual
```

- 庭は WebGL で描くので、GPU に依らないよう、chromium に SwiftShader で描かせる。
- 基準のスナップショットは、`apps/web/e2e/specs/__screenshots__/` に、Linux で作った 1 枚だけを置く。
  - 比べるときは、違うピクセルを全体の 1% まで許す（`maxDiffPixelRatio`）。
  - macOS の chromium で実行しても、この範囲に収まる。
- 場面を変えて基準のスナップショットを作り直すときは、CI と同じ Linux の Playwright のイメージで作る。
  - CI で実行する環境と同じ絵を基準にするためである。

基準のスナップショットの作り直し方は、次のとおり。
`apps/web/dist/` をローカル環境で配信し、コンテナから `host.docker.internal` で開く。
イメージのバージョンは、`@playwright/test` のバージョンに合わせる。

```sh
pnpm run build
python3 -m http.server 4400 --bind 127.0.0.1 --directory apps/web/dist
docker run --rm --platform linux/amd64 --ipc=host -v "$PWD":/work -w /work/apps/web \
  -e BASE_URL=http://host.docker.internal:4400 mcr.microsoft.com/playwright:v1.64.1-noble \
  node node_modules/@playwright/test/cli.js test -c e2e/playwright.config.ts --update-snapshots
```

`python3 -m http.server` は別のターミナルで実行し、作り直した後に止める。

## Test Data and Login

<!-- テストデータの作り方と片付け方。使い捨ての環境でデータを消さずに環境ごと作り直すなら、作り直すコマンドと、作り直してから流す spec。ログインの状態の保存先と、並列で共有しない理由。ID 基盤のログインやワンタイムのコードの扱い -->

## Timeouts

<!-- 待つ時間の名前を定めるファイルと、値を決めるときに集める所要時間の取り方。テストのレポートの置き場 -->
