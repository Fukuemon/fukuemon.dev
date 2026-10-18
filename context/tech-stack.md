---
type: context
title: 技術スタック
description: 採用しているツールの役割とバージョンの所在、使わないツール、Vite+ を入れるときの取り決め、バージョンの更新の確認、新しい package の作り始め。バージョンそのものと選んだ理由は書かない
status: draft
governs:
  - package.json
  - pnpm-workspace.yaml
  - mise.toml
  - .github/workflows/
verified_commit: 5fd820d
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
- `rehype-mermaid` は、Mermaid の図をビルド時に SVG へ変換する。peer dependency として `playwright` が要る。
- `pagefind` は、全文検索の索引を `astro build` の後に作る。
- `@electric-sql/pglite` は、ハンズオンの実行環境として Worker で動かす。COOP と COEP を要求しない。
- pnpm は、workspace の package manager として使う。ルートの script から `pnpm -r` で package を束ねる。
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

- 同梱のツールで足りるものを、別に入れない。
- バージョンを管理する手段を 1 つにする。
- beta のツールを採るときは、撤退の手段を書く。Vite+ に対する Turborepo がこれに当たる。

### Vite+ を入れるときの取り決め

Vite+（`vp`）はまだ入れていない。  
いまは、タスクをルートの `package.json` の scripts から実行する。  
この節は、Vite+ を入れるときに従う取り決めである。

Vite+ に任せる範囲は次のとおり。

- Node.js のバージョンの固定は mise が担い、`vp env` には移さない。ADR-0011 が、ADR-0003 のこの判断を置き換えた。
- package manager の実行は `vp install` が担う。
- monorepo のタスクの実行とキャッシュは `vp run` が担う。
- lint、format、test、typecheck は、Vite+ に同梱の Oxlint、Oxfmt、Vitest、tsgo が担う。
- Astro の dev と build は、Astro の CLI が担う。`vp dev` と `vp build` で Astro を置き換えない。
- ADR-0003: [monorepo と Vite+ の採否](../adr/0003-monorepo-and-vite-plus.md)

Vite+ を外せる状態を保つため、次を守る。

- タスクのコマンドは各 package の `package.json` の scripts に置き、ルートの `vite.config.ts` の `run.tasks` には依存関係だけを宣言する。
- 成果物を生むコマンドを `run.tasks` に書かない。
- `oxlint`、`oxfmt`、`vitest`、`typescript` を devDependencies にも宣言する。
- CI から各 package の script を直接実行できる状態を保つ。

## Upgrade Checks

- Astro のメジャーバージョンを上げるときは、`apps/web/src/lib/content/` のアダプタを直す。
  - アダプタの外に変更が広がるなら、[codebase.md](codebase.md#dependency-rules) の規約 1 か規約 3 が破られている。
- Vite+ を入れるときは、`vp run --cache` が `astro build` の入力を正しく推論するかを、次の 3 点で確かめる。
  1. `apps/web/src/content/` のファイルを 1 つ変えて `vp run --cache build` を実行し、キャッシュが外れる。
  2. `packages/design-system/` のトークンを変えて、`apps/web` の build のキャッシュが外れる。
  3. 何も変えずに 2 回目を実行し、キャッシュが当たる。
- 3 点のどれかを満たさなければ、キャッシュを無効にするか、Turborepo へ切り替える。
- それ以外のツールで、バージョンを上げるときに動かなくなりやすい箇所と確認の方法は、未定。

## Scaffolding

- 新しい package を作るときは、`packages/config` の共有の設定を参照する。設定を package ごとに複製しない。
  - 共有の設定の置き場は [conventions.md](conventions.md#shared-configuration) にある。
- shadcn/ui は、Command Palette や Dialog のような対話的なコンポーネントが要るようになってから入れる。
  - 出力先は `apps/web/src/components/ui/` にし、shadcn/ui のコンポーネントを手で作らない。
- 新しい package を切り出す条件は [codebase.md](codebase.md#placement-rules) にある。
