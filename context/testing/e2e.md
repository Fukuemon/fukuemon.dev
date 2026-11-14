---
type: context
title: E2E のテスト
description: E2E のテストのツールでの書き方、testid の名前、lint の規則に渡す値、流すコマンドと環境、テストデータ、待つ時間の決め方
status: draft
---

# E2E のテスト

## Test Tool

E2E は Playwright（`@playwright/test`）で書く。
要素は testid（`getByTestId`）で拾い、確認は `expect(locator)` の自動の待ちに任せる。
画面の文字を比べるときは、`packages/e2e/tests/fixtures/articles.ts` の定数を、確認の両側に渡す。値を読んでから比べない。

## Test IDs

記事の一覧のリンクは `article-link`、記事のページの見出しは `article-title` である。
testid は、アプリのコンポーネント（`apps/web/src/features/articles/ArticleRow.astro`、`apps/web/src/pages/articles/[...slug].astro`）に付ける。
`@fukuemon/ui` の `Link` は、渡された `data-testid` を `<a>` に付ける。

## Lint Rule Options

規則は `packages/e2e/eslint/e2e-authoring-rule.mjs` にある。スキル setup-e2e-lint の規則を写したものである。
ESLint の設定は `packages/e2e/eslint.config.mjs` で、`packages/e2e/tests/**/*.ts` だけに当てる。
渡す値は、`testsDir: "tests"` と `fixedWaitAllowedFiles: ["tests/fixtures/caption.ts"]` の 2 つである。
規則は spec を `*.e2e.ts` の名前で見分けるので、spec はこの名前にする。

```sh
pnpm --filter @fukuemon/e2e lint
```

`pnpm run check` は、ルートの `lint:e2e` で同じ lint を流す。

## Running Tests

### packages/e2e のサイトの E2E

`packages/e2e` の E2E は、ビルドした `apps/web/dist/` を `astro preview` で配信して実行し、dev server を対象にしない。
先に `apps/web` をビルドする。

```sh
pnpm --filter @fukuemon/web run build
pnpm --filter @fukuemon/e2e test
```

- 配信のポートは、実行のたびに空きポートを選ぶ。`PREVIEW_PORT` で決められる。`BASE_URL` を渡したときは、配信を立てない。
- project は `chromium` と `visual` である。`pnpm --filter @fukuemon/e2e test` は `chromium` だけを流し、`visual` は `pnpm --filter @fukuemon/e2e test:visual` で流す。
- 型のチェックは `pnpm --filter @fukuemon/e2e typecheck` で流す。
- ルートの `pnpm run test:e2e` は、サイトの E2E の後に、カタログの Show code の E2E（`pnpm --filter @fukuemon/ui e2e`）を流す。
  - カタログの E2E は、config が Storybook をビルドしてポート 6126 で配信する。そのポートが使用中なら、起動が失敗する。
- CI は `.github/workflows/e2e.yml` が、pull request だけで `pnpm run test:e2e` を流す。develop への push では流さない。
- `pnpm run check` は、E2E を流さず、E2E の lint だけを流す。

エビデンスを撮る config は `packages/e2e/playwright.capture.config.ts` である。
字幕の関数は `packages/e2e/tests/fixtures/caption.ts` にある。
出力は `packages/e2e/tests/evidence/` にでき、Git で追跡しない。

```sh
pnpm --filter @fukuemon/e2e capture
node .claude/skills/playwright-capture/scripts/collect.mjs packages/e2e/tests/evidence/.playwright/改修後.json packages/e2e/tests/evidence
```

### 庭の見た目の回帰と、表と図の枠の E2E

`packages/e2e/visual/specs/` の spec は、ビルドした `apps/web/dist/` を `astro preview` で配信して実行する。
config は `packages/e2e/playwright.config.ts` の project `visual` である。
記事のページの表と図の枠の E2E も、同じ project で実行する。
この spec は `tests/` の外にあるので、E2E の lint の規則は掛からない。
CI では、`pnpm run check` がビルドの後に実行する。
ローカル環境では、ビルドしてから次を実行する。

```sh
pnpm run build
pnpm run test:visual
```

- 配信のポートは、実行のたびに空きポートを選ぶ。
  - 別の worktree の preview が動いていても、並べて実行できる。
  - ポートを決めたいときは、環境変数 `PREVIEW_PORT` に渡す。そのポートが使用中なら、preview の起動が失敗する。
  - 1〜65535 の整数でない値は、config がエラーで止める。
  - `BASE_URL` を渡したときは、配信を立てないので、ポートを決めない。
- 庭は WebGL で描くので、GPU に依らないよう、project `visual` が chromium に SwiftShader で描かせる。
- 基準のスナップショットは、`packages/e2e/visual/specs/__screenshots__/` に、Linux で作った 1 枚だけを置く。
  - 比べるときは、違うピクセルを全体の 1% まで許す（`maxDiffPixelRatio`）。
  - 合否は CI の Linux で決める。
    本文はシステムフォントで描くので、macOS の chromium で実行すると、庭の上の字の差で 1% を超えることがある。
- 場面を変えて基準のスナップショットを作り直すときは、CI と同じ Linux の Playwright のイメージで作る。
  - CI で実行する環境と同じ絵を基準にするためである。

基準のスナップショットの作り直し方は、次のとおり。
`apps/web/dist/` をローカル環境で配信し、コンテナから `host.docker.internal` で開く。
イメージのバージョンは、`@playwright/test` のバージョンに合わせる。

```sh
pnpm run build
python3 -m http.server 4400 --bind 127.0.0.1 --directory apps/web/dist
docker run --rm --platform linux/amd64 --ipc=host -v "$PWD":/work -w /work/packages/e2e \
  -e BASE_URL=http://host.docker.internal:4400 mcr.microsoft.com/playwright:v1.64.1-noble \
  node node_modules/@playwright/test/cli.js test --project visual --update-snapshots
```

`python3 -m http.server` は別のターミナルで実行し、作り直した後に止める。

## Test Data and Login

<!-- テストデータの作り方と片付け方。使い捨ての環境でデータを消さずに環境ごと作り直すなら、作り直すコマンドと、作り直してから流す spec。ログインの状態の保存先と、並列で共有しない理由。ID 基盤のログインやワンタイムのコードの扱い -->

## Timeouts

<!-- 待つ時間の名前を定めるファイルと、値を決めるときに集める所要時間の取り方。テストのレポートの置き場 -->
