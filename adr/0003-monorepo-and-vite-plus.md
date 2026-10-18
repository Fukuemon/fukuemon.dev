# ADR-0003: pnpm workspace の monorepo とし、Vite+ を `vp run` / `vp env` / 同梱ツールに限定して採用する

## Status

承認（Decision 2 のうち Node.js のバージョンの固定を ADR-0011 に置換）

## Context

- 設計の中核は「Content Model と Design System が Astro から独立していること」にある。
  - ADR-0002: [関係を `contentId` の辺として持ち、Content Model を Astro 非依存に保つ](0002-content-model-independence.md)
- 運用者は 1 名で、レビューによる職務分離が成立しない。
  - 規約の遵守を人手の確認に委ねられない。
- `packages/content-model` は、Astro なしで単体テストできることを要求する。
  - Astro の依存が同じ解決グラフに載ると、この要求を確かめられない。
- Vite+ (`vp`) は 2026-07-02 に beta になった。
  - MIT で完全 OSS 化され、有償プラン構想は撤回済み。
  - 単一バイナリが Vite 8 / Vitest / Rolldown / tsdown / Oxlint / Oxfmt / Vite Task を統合し、Node.js runtime と package manager も管理する。
  - 公式の表現は "stable, but not yet complete" で、"complex projects may still need manual follow-up" と留保がつく。
  - 出典: [Announcing Vite+ Beta](https://voidzero.dev/posts/announcing-vite-plus-beta)
- `vp run` はタスクを 2 箇所から拾い、同名タスクを両方に置くことはできない。
  - package.json scripts は、指定しなければキャッシュしない。`--cache` で有効にする。
  - `vite.config.ts` の `run.tasks` は、指定しなくてもキャッシュし、`dependsOn` を明示できる。
  - 出典: [Vite+ `vp run`](https://viteplus.dev/guide/run)
- Astro 7 は独自 CLI を持ち、`astro.config.ts` の内側で Vite を構成する meta-framework として動く。
  - Astro 7 は既に内部で Vite 8 + Rolldown を使う。
- Astro 7 は Node.js 22 以上を要求する。

## Decision

### 1. Phase を問わず pnpm workspace の monorepo とする

```text
apps/web/          Astro 7
packages/config/           tsconfig / oxlint / vitest の共有設定
packages/content-model/    schema / ContentRef / 関係グラフ (Astro 非依存)
packages/design-system/    tokens.css / layout primitives / 挿絵の生成器
infra/                     Terraform。workspace package ではない
```

**package 境界は、後で切り出さず、最初から物理的に分ける。**

単一 package で独立性を維持する手段は、lint の import 制限しかない。  
lint は、違反を「動いてしまう」形で通す。  
package として分ければ、境界違反は依存解決の失敗として現れ、build が止まる。

1 名運用では、規約を機械で強制できることが保守性を決める。  
レビューによる職務分離が成立しない以上、規約は実行系が拒否する形でしか守れない。

この構成は次の 2 つを保証する。

- `content-model` の package.json が Astro を依存に持たない。
- `design-system` の package.json が Tailwind を依存に持たない。

どちらも設計不変量で、依存宣言を読むだけで確かめられる。  
設計不変量は [design/DesignDoc.md](../design/DesignDoc.md) の 4 と 5 にある。

`packages/` にモジュールを増やす条件は「2 つ以上の消費者が実在すること」とする。

### 2. Vite+ を採用し、適用範囲を 3 つに限定する

| 領域                              | 担当                                       |
| --------------------------------- | ------------------------------------------ |
| Node.js のバージョン固定          | `vp env`                                   |
| package manager の実行            | `vp install` (pnpm を wrap)                |
| monorepo のタスク実行とキャッシュ | `vp run`                                   |
| lint / format / test / typecheck  | Oxlint / Oxfmt / Vitest / tsgo (`vp` 同梱) |
| **Astro の dev / build**          | **Astro CLI (package.json script)**        |

**`vp dev` / `vp build` で Astro を置き換えない。**  
Vite+ の `dev` / `build` は素の Vite アプリを対象とし、Astro を外側から駆動する方法は存在しない。  
ビルド速度の改善も、Vite+ からは得られない。

### 3. タスクの実体を package.json scripts に置く

root の `vite.config.ts` には依存関係だけを宣言する。

```ts
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

- 成果物を生むコマンドを `run.tasks` に書かない。
  - 書くと `vp` 必須になる。
- `oxlint` / `oxfmt` / `vitest` / `typescript` を devDependencies にも宣言する。
  - `vp` 同梱版だけに頼ると、`vp` の無い環境でチェックが動かない。

**この形にすると、`vp` の無い環境でも `pnpm -r run build` が同じことをする。**  
Vite+ はタスクの並べ方とキャッシュだけを担い、何を実行するかを握らない。

### 4. 撤退の手段を確保する

`vp run --cache` が `astro build` の入力を正しく推論できるかは未確認である。  
Astro の入力は `src/content/**` / `astro.config.ts` / `public/**` / 依存 package の成果物で、外から入力集合が自明でない。  
**キャッシュの誤ヒットは「更新したページが出ない」形で表面化し、検知が遅れる。**

実装時に次を確かめる。

1. `apps/web/src/content/` のファイルを 1 つ変更して `vp run --cache build` がキャッシュミスすること
2. `packages/design-system/` のトークンを変更して `apps/web` の build がキャッシュミスすること
3. 何も変更せずに 2 回目がキャッシュヒットすること

満たさない場合、キャッシュを無効化するか Turborepo へ切り替える。  
Turborepo は `outputs` / `inputs` を明示宣言する方式のため、入力推論の不確かさを持たない。  
**タスクの実体が package.json scripts にある限り、切り替えは設定ファイルの差し替えだけで済む。**

## Considered Options

| 選択肢                                                                                                 | 強み                                                                                                                                                                                                           | 弱み                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **採用:** pnpm workspace の monorepo とし、Vite+ を `vp run` / `vp env` / 同梱ツールに限定して採用する | package の依存宣言で境界を強制できる。Vite+ は Vite 8 / Vitest / Oxlint を同梱し、package manager は pnpm / npm / Yarn / Bun を wrap する。代替は Turborepo / Nx / pnpm scripts                                | Vite+ は 2026-07-02 に出た beta で、"stable, but not yet complete" という公式の留保がある。撤退の手段 (Decision の 4) を確保した上で採用する                                                                                                                                                         |
| 単一 package で始め、必要になってから workspace 化する                                                 | 初期構成が最も単純になる。`pnpm-workspace.yaml` も package.json の分割も要らない                                                                                                                               | Content Model と Design System の独立を lint でしか守れず、違反が「動いてしまう」形で混入する。同一 package では Astro の依存が常に解決可能なため、`content-model` を Astro なしで単体テストできることを確かめる手段がない。後から workspace 化するとき、`apps/web` へツリー全体を移す作業が発生する |
| Turborepo を採用する                                                                                   | `outputs` / `inputs` の明示宣言によりキャッシュの入力が自明になり、Astro の build でも誤ヒットの不確かさがない。実績が長い。2.9.x を別のプロジェクトで運用している。動作要件は Node.js のみ。代替は Vite+ / Nx | Node.js runtime と package manager の管理、lint / format / test の同梱が得られず、別途ツールを入れることになる。Vite+ を入れた場合と役割が重複する                                                                                                                                                   |
| Vite+ を採用しない (pnpm scripts のみ)                                                                 | beta のツールに依存しない                                                                                                                                                                                      | Node.js の固定に mise 等を別途入れることになる。タスクのキャッシュが得られない                                                                                                                                                                                                                       |
| mise で Node を固定する                                                                                | 実績があり、cargo 製バイナリ (`similarity-ts`) も管理できる                                                                                                                                                    | `vp env` と役割が重複し、Node のバージョン定義が 2 箇所になる。二重管理を避けるため採らない                                                                                                                                                                                                          |
| Bun を package manager にする                                                                          | インストールとスクリプト実行が速い                                                                                                                                                                             | pnpm workspace を基盤とする決定と衝突する。Vite+ は lockfile から package manager を検出して wrap するため、pnpm のまま Vite+ の利得を受け取れる                                                                                                                                                     |

単一 package の案は成立しないわけではない。  
消費者が 1 つしかない現状では、単一 package でも動くものは作れる。  
採らない理由は動作ではなく、規約を機械で強制できるかどうかにある。

Turborepo は撤退の手段として残す。  
Decision の 4 の条件を満たさなければ、Turborepo へ切り替える。

## Consequences

### Positive

- 依存規約 2 本のうち「`content-model` を Astro 非依存に保つ」が、package の依存宣言で強制される。
- Node.js のバージョン固定、lint、format、test、タスクキャッシュが 1 つのツールに揃う。
- `design-system` が Tailwind を依存に持たないことを、package.json の 1 行で確かめられる。

### Negative

- package.json が 5 つ以上になり、初期の構築手数が増える。
- beta のツールを toolchain の中心に置く。
  - 撤退の手段で緩和するが、`vp` の破壊的変更に追従する手間は残る。
- `similarity-ts` は cargo 製で、`vp env` の管理外にある。
  - 未インストール環境では、チェックは「通った」のではなく「実行されなかった」ことになる。
  - ADR-0007: [品質のチェックの採否](0007-quality-gates.md)
