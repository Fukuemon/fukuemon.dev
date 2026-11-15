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
画面の文字を比べるときは、`packages/e2e/tests/fixtures/` の定数（記事の題は `articles.ts`、プレイグラウンドのツールは `playground.ts`）を、確認の両側に渡す。
値を読んでから比べない。

## Test IDs

記事の一覧のリンクは `article-link`、記事のページの見出しは `article-title` である。
testid は、アプリのコンポーネント（`apps/web/src/features/articles/ArticleRow.astro`、`apps/web/src/pages/articles/[...slug].astro`）に付ける。
`@fukuemon/ui` の `Link` は、渡された `data-testid` を `<a>` に付ける。

プレイグラウンドの一覧のツールのリンクは `playground-tool-link` で、`apps/web/src/pages/playground/index.astro` に付ける。
ヘッダーのリンクは `SITE_NAV` から並べるので testid を付けず、`selectors/site-header.ts` に置いた関数が、リンクの名前で指す。

トップの庭の testid は次のとおり。

- 庭の舞台は `garden-stage`、庭の中の移動の帯は `garden-nav`、ヘッダーは `site-header` である。
- 4 つの文へ移るボタンは `garden-station-0` から `garden-station-3` である。イントロの「飛ばす」は `garden-skip`、読み上げの通知は `garden-live` である。
- 文のセクションは `garden-card-profile`、`garden-card-career`、`garden-card-stack`、`garden-card-portfolio` である。プロフィールの見出しは `garden-title` である。
- testid は、次のファイルに付ける。
  - `apps/web/src/features/top-garden/Profile.astro`
  - `apps/web/src/features/top-garden/scene/GardenStage.astro`
  - `apps/web/src/components/SiteHeader.astro`

表示の設定の testid は次のとおり。

- 歯車のボタンは `site-settings-open`、設定の面は `site-settings` である。
- アニメーションのスイッチは `setting-motion`、トップの庭のスイッチは `setting-garden`、「イントロをもう一度見る」は `intro-again` である。
- 季節と時間帯の帯は `setting-season` と `setting-time`、帯の中のボタンは `setting-season-<値>` と `setting-time-<値>` である。
  値には、`auto` か、季節と時間帯の区分（`spring`、`morning` など）が入る。
- testid は、`apps/web/src/components/site-settings/` の `SiteSettingsPopover.astro` と `SiteSettingsButton.tsx` に付ける。
- 開く前に設定を保存した状態にするときは、`tests/widgets/actions/preset-settings.ts` の `presetSettings` を使う。

testid を付けられない要素は、`packages/e2e/tests/selectors/` にまとめる。
記事の本文の表、図、コードブロックは Markdown の変換が作る要素なので、`selectors/article-body.ts` で指す。
庭の `main` の中のセクションのように、複数の要素をまとめて拾う指し方は、`selectors/garden.ts` に置く。

## Lint Rule Options

規則は `packages/e2e/eslint/e2e-authoring-rule.mjs` にある。スキル setup-e2e-lint の規則を写したものである。
ESLint の設定は `packages/e2e/eslint.config.mjs` で、`packages/e2e/tests/**/*.ts` だけに当てる。
渡す値は、`testsDir` と `fixedWaitAllowedFiles` の 2 つである。
`testsDir` は `"tests"`、`fixedWaitAllowedFiles` は `["tests/fixtures/caption.ts", "tests/fixtures/delay-response.ts"]` である。
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
- project は `chromium` と `garden` である。`pnpm --filter @fukuemon/e2e test` は `chromium` だけを流し、`garden` は `pnpm --filter @fukuemon/e2e test:garden` で流す。
  - `chromium` は `tests/specs/garden/` 以外の spec を流す。記事のページの表と図とコードブロックの枠の spec（`scroll-box-fade.e2e.ts`）と、コピーの吹き出しの spec（`code-copy-feedback.e2e.ts`）もここで流す。いずれも `tests/specs/articles/` にある。
- 型のチェックは `pnpm --filter @fukuemon/e2e typecheck` で流す。
- ルートの `pnpm run test:e2e` は、サイトの E2E の後に、カタログの Show code の E2E（`pnpm --filter @fukuemon/ui e2e`）を流す。
  - カタログの E2E は、config が Storybook をビルドしてポート 6126 で配信する。そのポートが使用中なら、起動が失敗する。
- CI は `.github/workflows/e2e.yml` が、pull request だけで `pnpm run test:e2e` を流す。develop への push では流さない。
- `pnpm run check` は、E2E の lint と、トップの庭の E2E（`test:garden`）を流す。サイトのほかの E2E は流さない。

エビデンスを撮る config は `packages/e2e/playwright.capture.config.ts` である。
字幕の関数は `packages/e2e/tests/fixtures/caption.ts` にある。
出力は `packages/e2e/tests/evidence/` にでき、Git で追跡しない。

```sh
pnpm --filter @fukuemon/e2e capture
node .claude/skills/playwright-capture/scripts/collect.mjs packages/e2e/tests/evidence/.playwright/改修後.json packages/e2e/tests/evidence
```

### トップの庭の E2E

`packages/e2e/tests/specs/garden/` の spec は、ビルドした `apps/web/dist/` を `astro preview` で配信して実行する。
config は `packages/e2e/playwright.config.ts` の project `garden` である。
この spec にも、E2E の lint の規則が掛かる。
CI では、`pnpm run check` がビルドの後に実行する。
ローカル環境では、ビルドしてから次を実行する。

```sh
pnpm run build
pnpm run test:garden
```

- 配信のポートは、実行のたびに空きポートを選ぶ。
  - 別の worktree の preview が動いていても、並べて実行できる。
  - ポートを決めたいときは、環境変数 `PREVIEW_PORT` に渡す。そのポートが使用中なら、preview の起動が失敗する。
  - 1〜65535 の整数でない値は、config がエラーで止める。
  - `BASE_URL` を渡したときは、配信を立てないので、ポートを決めない。
- 庭は WebGL で描くので、GPU に依らないよう、project `garden` が chromium に SwiftShader で描かせる。
  - SwiftShader は 1 フレームを描くのが遅く、ほかの spec と並べると、最初の絵が画面に出るまでに数秒かかる。
  - `garden-appearance.e2e.ts`、`garden-intro.e2e.ts`、`garden-stations.e2e.ts` は、`test.slow()` で時間の上限を 3 倍にする。
  - project `garden` は、`expect` の待ちを 45 秒にする。カメラが行き先に着くまでの待ちが、デフォルトの 5 秒を超えるためである。
  - `page.clock` を使うと、ページの `requestAnimationFrame` は 16ms のタイマーに替わり、画面にフレームが出るのを待たない。本物の `requestAnimationFrame` を待つときは、`tests/widgets/waits/presented-frames.ts` の `waitForPresentedFrames` を使う。
  - カメラの移動の動きを確認しない庭の spec は、アニメーションをオフにした設定で開いてから移る。オフのカメラは 1 フレームで行き先に着く。
- 基準のスナップショットは、`packages/e2e/tests/specs/garden/__screenshots__/<spec のファイル名>/` に、Linux で作った 1 枚だけを置く。
  - 比べるときは、違うピクセルを全体の 1% まで許す（`maxDiffPixelRatio`）。
  - 合否は CI の Linux で決める。
    本文はシステムフォントで描くので、macOS の chromium で実行すると、庭の上の字の差で 1% を超えることがある。
    macOS で落ちた結果は、合否に使わない。
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
  node node_modules/@playwright/test/cli.js test --project garden --update-snapshots
```

`python3 -m http.server` は別のターミナルで実行し、作り直した後に止める。

## Test Data and Login

<!-- テストデータの作り方と片付け方。使い捨ての環境でデータを消さずに環境ごと作り直すなら、作り直すコマンドと、作り直してから流す spec。ログインの状態の保存先と、並列で共有しない理由。ID 基盤のログインやワンタイムのコードの扱い -->

## Timeouts

<!-- 待つ時間の名前を定めるファイルと、値を決めるときに集める所要時間の取り方。テストのレポートの置き場 -->
