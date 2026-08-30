---
type: context
title: Toolchain
description: 採用ツールと版、Vite+ の適用範囲、品質ゲートの採否、依存規約の検査手段。
keywords:
  [Vite+, vp run, vp env, pnpm workspace, Oxlint, Oxfmt, react-doctor, knip, similarity-ts, Astro 7]
governs:
  - package.json
  - vite.config.ts
  - pnpm-workspace.yaml
verified_commit: unverified
---

# Toolchain

採用ツールと、それぞれをどこまで使うかを定める。
判断の理由は [ADR-0003](../adr/0003-monorepo-and-vite-plus.md) と [ADR-0007](../adr/0007-quality-gates.md)。

## 標準スタック

版の正本は各 `package.json` である。下表は 2026-08-30 時点の実測。

| 用途            | ツール                              | version           | 制約                                              |
| --------------- | ----------------------------------- | ----------------- | ------------------------------------------------- |
| framework       | Astro                               | 7.2.9             | Node.js 22.12 以上                                |
| island          | React + `@astrojs/react`            | 19.2.8 / 6.0.4    | 実行パネルとサイドバーだけに使う                  |
| CSS             | Tailwind CSS + `@tailwindcss/vite`  | 4.3.3             | preflight は読まない (ADR-0010)                   |
| コードブロック  | `astro-expressive-code`             | 0.44.1            | スタイリングは `styleOverrides` から指定する      |
| 図              | `rehype-mermaid`                    | 3.0.0             | peer に `playwright`。ビルド時に SVG へ変換する   |
| 全文検索        | `pagefind`                          | 1.5.2             | `astro build` のあとに索引を作る                  |
| WASM の実行環境 | `@electric-sql/pglite`              | 0.5.8             | Worker で動かす。COOP/COEP を要求しない           |
| package manager | pnpm (workspace)                    | 10.27.0           | `vp install` が wrap                              |
| toolchain 入口  | Vite+ (`vp`)                        | beta (2026-07-02) | MIT。"stable, but not yet complete"               |
| lint            | Oxlint                              | 1.80.0            | `--type-aware` で実行する                         |
| format          | Oxfmt                               | 0.48.0            | —                                                 |
| typecheck       | `astro check` + tsgo                | —                 | —                                                 |
| 未使用の検出    | knip                                | 6.32.2            | `check` に含める                                  |
| unit test       | Vitest                              | 4.1.11            | 対象は `packages/content-model` と `apps/web/src` |
| e2e             | Playwright                          | 1.62.1            | root の `e2e/`                                    |
| infra           | Terraform + `cloudflare/cloudflare` | 1.14.3 / provider 5.24.0 | CI は 1.14.3 に固定。認証は `CLOUDFLARE_API_TOKEN` |
| deploy          | Wrangler                            | 4.127.1           | 認証は `CLOUDFLARE_API_TOKEN` (2026-08-30 実測)    |

**Starlight は採らない** ([ADR-0001](../adr/0001-starlight-as-docs-renderer.md))。
描画は Astro のページとして自前で組む。

CSS スタイリングの基盤は Tailwind CSS v4 である ([ADR-0010](../adr/0010-tailwind-as-styling-base.md))。
トークンは `@theme static` に置き、`styleOverrides` から参照できる素のカスタムプロパティとして残す。

## Vite+ の適用範囲

| 領域                              | 担当                                        |
| --------------------------------- | ------------------------------------------- |
| Node.js のバージョン固定          | `vp env`                                    |
| package manager の実行            | `vp install` (pnpm を wrap)                 |
| monorepo のタスク実行とキャッシュ | `vp run`                                    |
| lint / format / test / typecheck  | Vite+ 同梱の Oxlint / Oxfmt / Vitest / tsgo |
| **Astro の dev / build**          | **Astro CLI (package.json script)**         |

**`vp dev` / `vp build` で Astro を置き換えない。** Vite+ の `dev` / `build` は素の Vite アプリを対象とし、Astro を外側から駆動する経路がない。
Astro 7 は既に内部で Vite 8 + Rolldown を使うため、ビルド速度の利得も Vite+ 由来では発生しない。

### タスクの定義場所

`vp run` はタスクを 2 箇所から拾う。
package.json scripts (既定でキャッシュしない。`--cache` で有効化) と `vite.config.ts` の `run.tasks` (既定でキャッシュし `dependsOn` を明示できる) である。
同名タスクを両方に置くことはできない。

**実際のコマンドは各 package の `package.json` scripts に置き、root の `vite.config.ts` には依存関係だけを宣言する。**

```ts
// vite.config.ts (workspace root)
export default defineConfig({
  run: {
    tasks: {
      build: { dependsOn: [{ task: "build", from: "dependencies" }] },
      typecheck: { dependsOn: [{ task: "build", from: "dependencies" }] },
      test: { dependsOn: ["build"] },
    },
  },
});
```

### Vite+ への依存を切れる状態を保つ規約

- **成果物を生むコマンドを `run.tasks` に書かない。** 書くと `vp` 必須になる
- **`oxlint` / `oxfmt` / `vitest` / `typescript` を devDependencies にも宣言する。** 同梱版だけに頼ると `vp` の無い環境で検査が動かない
- CI は `vp run` を使うが、失敗時の切り分けのため各 package の script を直接叩ける状態を保つ

**この形により `vp` の無い環境でも `pnpm -r run build` が同じことをする。**

### キャッシュの検証と撤退

`vp run --cache` が `astro build` の入力を正しく推論できるかは**未確認**である。
Astro の入力は `src/content/**` / `astro.config.ts` / `public/**` / 依存 package の成果物で、外から入力集合が自明でない。**キャッシュ誤ヒットは「更新したページが出ない」形で表面化し、検知が遅れる。**

導入時に次を確認する。

1. `apps/web/src/content/` のファイルを 1 つ変更して `vp run --cache build` がキャッシュミスすること
2. `packages/design-system/` のトークンを変更して `apps/web` の build がキャッシュミスすること
3. 何も変更せずに 2 回目がキャッシュヒットすること

満たさない場合、キャッシュを無効化するか Turborepo へ切り替える。**タスクの実体が package.json scripts にある限り、切り替えは設定ファイルの差し替えだけで済む。**

## 品質ゲート

| ツール        | version / license | 採否         | 役割                                   |
| ------------- | ----------------- | ------------ | -------------------------------------- |
| react-doctor  | 0.9.12 / 独自     | 採る         | React 固有の診断                       |
| knip          | 6.32.2 / ISC      | 採る         | 未使用の export / 依存 / ファイル      |
| similarity-ts | 0.5.0 (cargo)     | 採る         | コード重複                             |
| Lefthook      | —                 | 採る         | pre-commit ゲート                      |
| mise          | —                 | **採らない** | Node の固定は `vp env`。二重管理になる |
| Bun           | —                 | **採らない** | pnpm workspace の決定と衝突する        |
| Biome         | 2.5.10            | **採らない** | Oxlint / Oxfmt と重複する              |

### react-doctor

**当初はスコアを gate にしない。** React Island が存在しないため対象コードがない。
CI には組み込み、Island が実在してから「スコアを下げる変更を止める」ゲートへ昇格させる。

| 場面                 | コマンド                                            |
| -------------------- | --------------------------------------------------- |
| 変更差分の回帰検査   | `npx react-doctor@latest --verbose --scope changed` |
| 全体の棚卸し         | `npx react-doctor@latest --verbose`                 |
| Design System の監査 | `npx react-doctor@latest design --verbose`          |

**開発時のみ `npx` で実行し、成果物の依存に入れない。** version が 1.0 未満でルールセットが安定しておらず、npm の license 欄が `SEE LICENSE IN LICENSE` で OSI 標準ライセンスでもない。

汎用ルールと Design System が衝突した場合は `react-doctor rules disable` で個別に無効化し、**理由を [context/engineering.md](engineering.md) に記録する** (無効化そのものは記録されないため)。

### similarity-ts

cargo 製の外部バイナリで `vp env` の管理外にある。**未インストールの環境では検査が「実行されなかった」のであって「通った」ではない。** CI では存在を検査し、欠けていれば警告として報告する。

## 依存規約の検査手段

[context/architecture.md](architecture.md) の依存規約 2 本を機械検査する。

| 規約                                            | 検査手段                                |
| ----------------------------------------------- | --------------------------------------- |
| ページから `astro:content` を直接 import しない | Oxlint の `no-restricted-imports`       |
| `@fukuemon/content-model` が Astro に依存しない | package の `dependencies` 宣言 + `knip` |

**カスタム oxlint プラグインを作らない。** 規約が 2 本では既存の仕組みで足りる。
層が増えて `no-restricted-imports` の列挙が読めなくなった時点で導入する。

## 採用方針

- **同梱で足りるものを別途入れない。** Vite+ が持つ Oxlint / Oxfmt / Vitest / tsgo をそのまま使う。
- **バージョン管理の入口を 1 つにする。** Node は `vp env` に集約し、mise を併用しない。
- **beta のツールを採るときは撤退経路を明記する。** Vite+ に対する Turborepo がこれに当たる。

## Scaffold Policy

- shadcn/ui は対話的コンポーネント (Command Palette / Dialog) が実在してから導入する。
  出力先は `apps/web/src/components/ui/` とし、手で作らない。
- 新しい package を作るときは `packages/config` の共有設定 (`tsconfig` / `oxlint` / `vitest`) を参照する。
  設定を package ごとに複製しない。

## 参照

- [ADR-0003](../adr/0003-monorepo-and-vite-plus.md): monorepo と Vite+ の採否
- [ADR-0007](../adr/0007-quality-gates.md): 品質ゲートの採否
- [context/architecture.md](architecture.md): 依存規約の本文
- [context/engineering.md](engineering.md): root task とゲートの実行
- [context/testing.md](testing.md): テスト方針
