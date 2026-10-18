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
  - .github/workflows/
verified_commit: 63b37ad
---

# 技術スタック

## Toolchain

npm のパッケージのバージョンは、各 package の `package.json` に書いてある。  
Node.js、uv、apm、similarity-ts のバージョンは、`mise.toml` に書いてある。  
pnpm のバージョンは、ルートの `package.json` の `packageManager` に書いてある。

- ADR-0011: [ツールのバージョンを mise で固定する](../adr/0011-pin-tool-versions-with-mise.md)

ツールごとの役割と、使い方の取り決めは次のとおり。

- Astro は、全画面を描画する framework として使う。
  - 描画は Astro のページとして自前で組み、Starlight は使わない。
  - ADR-0001: [Starlight の採否](../adr/0001-starlight-as-docs-renderer.md)
- React と `@astrojs/react` は、実行パネルとサイドバーの island だけに使う。
- Tailwind CSS と `@tailwindcss/vite` は、CSS のスタイリングの基盤として使う。
  - preflight は読まない。
  - トークンは `@theme static` に置き、Expressive Code の `styleOverrides` から参照できる素のカスタムプロパティとして残す。
  - ADR-0010: [Tailwind CSS の採用](../adr/0010-tailwind-as-styling-base.md)
- `astro-expressive-code` は、コードブロックの描画に使う。スタイリングは `styleOverrides` から指定する。
- Pele（`pele`）は、Mermaid の図をビルド時に SVG へ変換する。ブラウザを使わない。
  - バージョンは範囲で書かず、1 つに固定する。上げるときは、図の見た目を撮って比べる。
  - ADR-0016: [mermaid の図を、ビルドでも島でも Pele で SVG にする](../adr/0016-render-mermaid-with-pele.md)
- `pagefind` は、全文検索の索引を `astro build` の後に作る。
- `@electric-sql/pglite` は、ハンズオンの実行環境として Worker で動かす。COOP と COEP を要求しない。
- pnpm は、workspace の package manager として使う。ルートの script から `pnpm -r` で package を束ねる。
- Vite+ の `vp run` は、`apps/web` の build のタスクの実行とキャッシュに使う。取り決めは [Vite+ の取り決め](#vite-の取り決め) にある。
- Oxlint は lint に、Oxfmt は format に使う。Oxlint は `--type-aware` で実行する。
- 型のチェックには、`apps/web` では `astro check` を、`packages/content-model` では `tsc` を使う。
  - tsgo は、`oxlint-tsgolint` を通して、Oxlint の `--type-aware` の型の情報に使う。
- knip は、未使用の export、依存、ファイルの検出に使う。
- Vitest は unit test に使う。
- Playwright は、見た目の回帰のチェック（`e2e/`）で画面を撮るのに使う。
- textlint は文書の文章のチェックに、commitlint はコミットのメッセージの形式のチェックに使う。
- Terraform と `cloudflare/cloudflare` provider は、Cloudflare の基盤の管理に使う。
- Wrangler は、Worker の deploy に使う。
- 品質のチェックには、react-doctor、knip、similarity-ts、Lefthook を使う。
  - 各ツールをチェックのどこで実行するかは [conventions.md](conventions.md#shared-configuration) にある。
  - ADR-0007: [品質のチェックの採否](../adr/0007-quality-gates.md)

パッケージマネージャーが管理しないツールのバージョンの決め方は次のとおり。

- Terraform の CLI は、CI では `.github/workflows/check.yml` と `.github/workflows/apply.yml` の `terraform_version` に固定する。
  - provider のバージョンは `infra/*/.terraform.lock.hcl` にある。
- react-doctor は依存に入れず、`npx` で実行する。`check` から呼ぶときは、ルートの `package.json` の `check:doctor` にバージョンを書く。
- similarity-ts は、GitHub のリリースにある prebuilt のバイナリを、mise の `github` backend で入れる。npm にも mise の registry にもないため。

Bun と Biome は使わない。  
ADR-0007: [品質のチェックの採否](../adr/0007-quality-gates.md)

ツールを足すときは、次の方針に従う。

- 同梱のツールで足りるものを、別に入れない。vite-plus の同梱のツールは例外で、[Vite+ の取り決め](#vite-の取り決め) に従う。
- バージョンを管理する手段を 1 つにする。
- beta のツールを採るときは、撤退の手段を書く。Vite+ に対する Turborepo がこれに当たる。

### Vite+ の取り決め

Vite+（`vite-plus`）は、`apps/web` の build を `vp run` でキャッシュすることだけに使う。  
ADR-0017: [Vite+ の適用範囲](../adr/0017-vp-run-cache-for-web-build.md)

- `apps/web` の build のコマンドは、`apps/web/vite.config.ts` の `run.tasks` に置く。
  - `apps/web/package.json` の `build` の script は、`vp run` でタスクを呼ぶだけにする。
  - 同じ名前のタスクを `run.tasks` と package.json の scripts の両方には置けない。
- `run.tasks` に足すのは、成果物を作るタスクだけにする。lint、typecheck、test、ほかのチェックは、package.json の scripts から pnpm で実行し、キャッシュに載せない。
- タスクの `cache.input` から、タスク自身が書くファイルを外す。外さないと、2 回目もキャッシュが当たらない。
- タスクの `cache.output` は、成果物のディレクトリを明示する。
  - `astro build` では、自動の記録が `dist/_astro/` を拾わない。
- Astro の dev と build は、Astro の CLI が担う。`vp dev` と `vp build` で Astro を置き換えない。
  - ADR-0003: [monorepo と Vite+ の採否](../adr/0003-monorepo-and-vite-plus.md)
- `vp lint`、`vp fmt`、`vp test`、`vp check`、`vp install`、`vp env` は使わない。
  - Oxlint、Oxfmt、Vitest は devDependencies に宣言したバージョンを実行する。vite-plus の同梱のバージョンとは別に上がる。
  - Node.js のバージョンは mise が固定する。
- vitest を使う package は、vitest を自分の devDependencies に宣言する。
  - 宣言しないと、`@vitest/coverage-v8` が vite-plus の依存の vitest 5 に解決され、`test:cov` が失敗する。
- `vp` は、`apps/web` の devDependency の `vite-plus` のものを使う。global の CLI と `voidzero-dev/setup-vp` は要らない。
- タスクのキャッシュは `node_modules/.vite/task-cache` にある。消すときは `pnpm --filter @fukuemon/web exec vp cache clean` を実行する。
- CI は、タスクのキャッシュを run をまたいで持ち越さない。
- キャッシュの指紋には、環境変数も入る。ルートの `pnpm run build` と `pnpm --filter @fukuemon/web run build` は、互いのキャッシュを使わない。

Vite+ を外す手順は、ADR-0017 の Decision 7 にある。

## Upgrade Checks

- Astro のメジャーバージョンを上げるときは、`apps/web/src/lib/content/` のアダプタを直す。
  - アダプタの外に変更が広がるなら、[codebase.md](codebase.md#dependency-rules) の規約 1 か規約 3 が破られている。
- `vite-plus` か Astro を上げるときと、`apps/web/vite.config.ts` のタスクを変えるときは、build のキャッシュを次の 4 点で確かめる。
  1. `apps/web/src/content/` のファイルを 1 つ変えて `pnpm --filter @fukuemon/web run build` を実行し、キャッシュが外れる。
  2. `packages/design-system/` のトークンを変えて実行し、キャッシュが外れる。
  3. 何も変えずに 2 回目を実行し、キャッシュが当たる。
  4. `apps/web/dist/` を消して実行し、`dist/` のファイルの一覧が、キャッシュを使わない build の後と一致する。
- 4 点のどれかを満たさなければ、キャッシュを無効にするか、Turborepo へ切り替える。
- それ以外のツールで、バージョンを上げるときに動かなくなりやすい箇所と確認の方法は、未定。

## Scaffolding

- 新しい package を作るときは、`packages/config` の共有の設定を参照する。設定を package ごとに複製しない。
  - 共有の設定の置き場は [conventions.md](conventions.md#shared-configuration) にある。
- shadcn/ui は、Command Palette や Dialog のような対話的なコンポーネントが要るようになってから入れる。
  - 出力先は `apps/web/src/components/ui/` にし、shadcn/ui のコンポーネントを手で作らない。
- 新しい package を切り出す条件は [codebase.md](codebase.md#placement-rules) にある。
