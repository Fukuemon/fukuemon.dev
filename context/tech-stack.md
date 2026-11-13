---
type: context
title: 技術スタック
description: 採用しているツールの役割とバージョンの所在、使わないツール、Vite+ の取り決め、バージョンの更新の確認、新しい package の作り始め。バージョンそのものと選んだ理由は書かない
status: draft
governs:
  - package.json
  - pnpm-workspace.yaml
  - mise.toml
  - apps/web/package.json
  - apps/web/vite.config.ts
  - apps/playground/package.json
  - .github/workflows/
verified_commit: 63b37ad
---

# 技術スタック

## Toolchain

npm のパッケージのバージョンは、各 package の `package.json` に書いてある。  
Node.js、Go、uv、apm、similarity-ts のバージョンは、`mise.toml` に書いてある。  
Yaegi のバージョンは、`packages/go-runtime/go/go.mod` に書いてある。  
pnpm のバージョンは、ルートの `package.json` の `packageManager` に書いてある。

- ADR-0011: [ツールのバージョンを mise で固定する](../docs/adr/0011-pin-tool-versions-with-mise.md)

ツールごとの役割と、使い方の取り決めは次のとおり。

- Astro は、全画面を描画する framework として使う。
  - 描画は Astro のページとして自前で組み、Starlight は使わない。
  - ADR-0001: [Starlight の採否](../docs/adr/0001-starlight-as-docs-renderer.md)
- React は、`packages/ui` のコンポーネントと、`apps/web` の island に使う。`@astrojs/react` は、`packages/ui` のコンポーネントを Astro のページに `client:*` なしで描くのにも使う。
- `apps/playground` は、Vite の React のアプリで、画面の全体を React で描く。React Compiler を、`apps/playground` のビルドにだけ入れる。
  - ADR-0046: [プレイグラウンドのアプリの構成](../docs/adr/0046-playground-as-vite-react-app.md)
  - ADR-0047: [React Compiler を入れる範囲](../docs/adr/0047-react-compiler-in-playground.md)
- `@webcontainer/api` は、Node の実行環境の package（`@fukuemon/node-runtime`）だけに使う。import できるディレクトリは、[プレイグラウンドの Design Doc](../apps/playground/DesignDoc.md#ディレクトリ) にある。
- Tailwind CSS と `@tailwindcss/vite` は、CSS のスタイリングの基盤として使う。
  - サイトの共通の CSS は preflight を読み、`@theme static` を使わない。
  - ADR-0010: [Tailwind CSS の採用](../docs/adr/0010-tailwind-as-styling-base.md)
  - ADR-0055: [サイトの共通の CSS で Tailwind CSS の preflight を読み、トークンを packages/ui のテーマ変数から使う](../docs/adr/0055-tailwind-preflight-and-theme-from-ui.md)
  - `packages/ui` は、トークンを `@theme inline` のテーマ変数に置き、Tailwind のデフォルトの色、文字の大きさ、角丸、影、ブレークポイントを消す。層の分け方は [packages/ui/DesignDoc.md](../packages/ui/DesignDoc.md#トークンの層) にある。
- Storybook は、`packages/ui` のカタログに使う。a11y、docs、vitest、themes のアドオンと、hover の見た目を出す `storybook-addon-pseudo-states` を使う。
  - story は、Vitest のブラウザのモードでテストとして動かす。ブラウザは Playwright の chromium を使う。
  - ADR-0021: [packages/ui に Base と Case の React のコンポーネントを置き、packages/ui の Storybook をカタログにする](../docs/adr/0021-ui-components-and-catalog.md)
- `@electric-sql/pglite` は、プレイグラウンドで、`@fukuemon/sql-runtime` が SQL だけを動かすツールに使う。Node の実行環境の中の DB のプロセスには、`@fukuemon/node-runtime` の `guest/` の `package.json` に書いた同じバージョンを、実行環境の中で `npm install` する。
- Go と Yaegi は、プレイグラウンドの Go を動かすツールに使う。`@fukuemon/go-runtime` の `build` の script が、Yaegi で訪問者のコードを動かす WASM を、`mise.toml` の Go でビルドする。`wasm_exec.js` は、同じ Go のものをコミットする。
  - Go のバージョンを上げるときは、`$(go env GOROOT)/lib/wasm/wasm_exec.js` を `packages/go-runtime/src/worker/vendor/` にコピーする。ビルドの script は、2 つが違うと失敗する。
  - ADR-0037: [Go のコードを、Yaegi のインタプリタの WASM で動かす](../docs/adr/0037-go-with-yaegi.md)
- CodeMirror 6 は、プレイグラウンドのツールの入力欄のエディタに使う。色は、`packages/ui` のテーマ変数を読む。
- CodeMirror 6 は、プレイグラウンドのツールのエディタに使う。
- pnpm は、workspace の package manager として使う。ルートの script から `pnpm -r` で package を束ねる。
- Vite+ の `vp run` は、`apps/web` の build のタスクの実行とキャッシュに使う。`vp build` は、`apps/playground` の build に使う。取り決めは [Vite+ の取り決め](#vite-の取り決め) にある。
- Oxlint は lint に、Oxfmt は format に使う。Oxlint は `--type-aware` で実行する。
  - Oxlint の設定は、ルートの `oxlint.config.ts` に書く。
  - 組み込みのプラグインは、デフォルトの `eslint`、`typescript`、`unicorn`、`oxc` に、`react`、`jsx-a11y`、`import` を加えて有効にする。`plugins` を書くとデフォルトのプラグインが外れるので、デフォルトのプラグインも並べる。
  - 外部のプラグインは、`jsPlugins` で `eslint-plugin-better-tailwindcss` を読む。
  - react-doctor は差分だけを見るので、全てのファイルに掛ける React の規則は Oxlint が持つ。
- 型のチェックには、`apps/web` では `astro check` を、`packages/content-model` と `packages/ui` では `tsc` を使う。
  - tsgo は、`oxlint-tsgolint` を通して、Oxlint の `--type-aware` の型の情報に使う。
- knip は、未使用の export、依存、ファイルの検出に使う。
- Vitest は unit test に使う。
- Playwright は、次のことに使う。
  - `packages/ui` の story のテスト、カタログの E2E と撮影（`packages/ui/e2e/`）
  - トップの庭の見た目の回帰と、記事のページの E2E（`apps/web/e2e/`）
  - トップの試作の録画
- three は、トップの立体の庭を描く場面のバンドルにだけ使う。
  - 庭を出すときだけ読み込み、ほかのページには配らない。
- textlint は文書の文章のチェックに、commitlint はコミットのメッセージの形式のチェックに使う。
- Terraform と `cloudflare/cloudflare` provider は、Cloudflare の基盤の管理に使う。
- Wrangler は、サイトの Worker（`apps/web`）、カタログの Worker（`packages/ui`）、プレイグラウンドの Worker（`apps/playground`）の deploy に使う。
- 品質のチェックには、react-doctor、knip、similarity-ts、Lefthook を使う。
  - 各ツールをチェックのどこで実行するかは [conventions.md](conventions.md#shared-configuration) にある。
  - ADR-0007: [品質のチェックの採否](../docs/adr/0007-quality-gates.md)

パッケージマネージャーが管理しないツールのバージョンの決め方は次のとおり。

- Terraform の CLI は、CI では `.github/workflows/check.yml` と `.github/workflows/apply.yml` の `terraform_version` に固定する。
  - provider のバージョンは `infra/*/.terraform.lock.hcl` にある。
- react-doctor は依存に入れず、`npx` で実行する。`check` から呼ぶときは、ルートの `package.json` の `check:doctor` にバージョンを書く。
- similarity-ts は、GitHub のリリースにある prebuilt のバイナリを、mise の `github` backend で入れる。npm にも mise の registry にもないため。

Bun と Biome は使わない。  
ADR-0007: [品質のチェックの採否](../docs/adr/0007-quality-gates.md)

ツールを足すときは、次の方針に従う。

- 同梱のツールで足りるものを、別に入れない。vite-plus の同梱のツールは例外で、[Vite+ の取り決め](#vite-の取り決め) に従う。
- バージョンを管理する手段を 1 つにする。
- beta のツールを採るときは、撤退の手段を書く。Vite+ に対する Turborepo がこれに当たる。

### Vite+ の取り決め

Vite+（`vite-plus`）は、`apps/web` の build を `vp run` でキャッシュすることと、`apps/playground` の dev、build、preview を `vp` で実行することだけに使う。  
ADR-0017: [Vite+ の適用範囲](../docs/adr/0017-vp-run-cache-for-web-build.md)

- `apps/web` の build のコマンドは、`apps/web/vite.config.ts` の `run.tasks` に置く。
  - `apps/web/package.json` の `build` の script は、`vp run` でタスクを呼ぶだけにする。
  - 同じ名前のタスクを `run.tasks` と package.json の scripts の両方には置けない。
- `run.tasks` に足すのは、成果物を作るタスクだけにする。lint、typecheck、test、ほかのチェックは、package.json の scripts から pnpm で実行し、キャッシュに載せない。
- タスクの `cache.input` から、タスク自身が書くファイルを外す。外さないと、2 回目もキャッシュが当たらない。
- タスクの `cache.output` は、成果物のディレクトリを明示する。
  - `astro build` では、自動の記録が `dist/_astro/` を拾わない。
- Astro の dev と build は、Astro の CLI が担う。`vp dev` と `vp build` で Astro を置き換えない。
  - ADR-0003: [monorepo と Vite+ の採否](../docs/adr/0003-monorepo-and-vite-plus.md)
- `apps/playground` の dev、build、preview は、`vp dev`、`vp build`、`vp preview` で実行する。
  - `pnpm-workspace.yaml` の catalog の `vite` は `@voidzero-dev/vite-plus-core` で、`vite` のコマンドを持たない。
  - `vite build` と書くと、ほかの依存が持ち込んだ別のバージョンの vite のコマンドが、ルートの `node_modules/.bin` から動く。
- `vp lint`、`vp fmt`、`vp test`、`vp check`、`vp install`、`vp env` は使わない。
  - Oxlint、Oxfmt、Vitest は devDependencies に宣言したバージョンを実行する。vite-plus の同梱のバージョンとは別に上がる。
  - Node.js のバージョンは mise が固定する。
- vitest を使う package は、vitest を自分の devDependencies に宣言する。
  - 宣言しないと、`@vitest/coverage-v8` が vite-plus の依存の vitest 5 に解決され、`test:cov` が失敗する。
- `vp` は、`apps/web` と `apps/playground` の devDependency の `vite-plus` のものを使う。global の CLI と `voidzero-dev/setup-vp` は要らない。
- タスクのキャッシュは `node_modules/.vite/task-cache` にある。消すときは `pnpm --filter @fukuemon/web exec vp cache clean` を実行する。
- CI は、タスクのキャッシュを run をまたいで持ち越さない。
- キャッシュの指紋には、環境変数も入る。ルートの `pnpm run build` と `pnpm --filter @fukuemon/web run build` は、互いのキャッシュを使わない。

Vite+ を外す手順は、ADR-0017 の Decision 7 にある。

## Upgrade Checks

- `vite-plus` か Astro を上げるときと、`apps/web/vite.config.ts` のタスクを変えるときは、build のキャッシュを次の 4 点で確認する。
  1. `apps/web/src/` のファイルを 1 つ変えて `pnpm --filter @fukuemon/web run build` を実行し、キャッシュが外れる。
  2. `packages/ui/src/tokens/` のトークンを変えて実行し、キャッシュが外れる。
  3. 何も変えずに 2 回目を実行し、キャッシュが当たる。
  4. `apps/web/dist/` を消して実行し、`dist/` のファイルの一覧が、キャッシュを使わない build の後と一致する。
- 4 点のどれかを満たさなければ、キャッシュを無効にするか、Turborepo へ切り替える。
- それ以外のツールで、バージョンを上げるときに動かなくなりやすい箇所と確認の方法は、未定。

## Scaffolding

- 新しい package を作るときは、`packages/config` の共有の設定を参照する。設定を package ごとに複製しない。
  - 共有の設定の置き場は [conventions.md](conventions.md#shared-configuration) にある。
- shadcn/ui は使わない。対話的なコンポーネント（`Dialog`、`ActionMenu` など）は、`packages/ui` の Base に React と clsx で書く。
  - クラスを組むときに使わないライブラリの一覧は、[packages/ui/DesignDoc.md](../packages/ui/DesignDoc.md#コンポーネントの分類と置き場) にある。
- 新しい package を切り出す条件は [codebase.md](codebase.md#placement-rules) にある。
