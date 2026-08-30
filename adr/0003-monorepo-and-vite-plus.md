# ADR-0003: pnpm workspace の monorepo とし、Vite+ を `vp run` / `vp env` / 同梱ツールに限定して採用する

## 状態

承認

## 決定日

2026-08-26

## 背景

- 設計の中核は「Content Model と Design System が Astro から独立していること」である。
  - [ADR-0002](0002-content-model-independence.md) — Content Model を Astro 非依存に保つ決定
- 運用者は 1 名であり、レビューによる職務分離が成立しない。
  規約の遵守を人手の確認に委ねられない。
- `packages/content-model` は Astro なしで単体テストできることを要求する。
  Astro の依存が同じ解決グラフに載ると、この要求を検査できない。
- Vite+ (`vp`) は 2026-07-02 に beta。
  MIT で完全 OSS 化され、有償プラン構想は撤回済み。
  単一バイナリが Vite 8 / Vitest / Rolldown / tsdown / Oxlint / Oxfmt / Vite Task を統合し、Node.js runtime と package manager も管理する。
  公式表現は "stable, but not yet complete" で、"complex projects may still need manual follow-up" と留保がつく。
- `vp run` はタスクを 2 箇所から拾う。
  package.json scripts (既定でキャッシュしない。`--cache` で有効化) と `vite.config.ts` の `run.tasks` (既定でキャッシュし `dependsOn` を明示できる) である。
  同名タスクを両方に置くことはできない。
- Astro 7 は独自 CLI を持ち、`astro.config.ts` の内側で Vite を構成する meta-framework である。
  Astro 7 は既に内部で Vite 8 + Rolldown を使う。
- Astro 7 は Node.js 22 以上を要求する。

## 決定

### 1. Phase を問わず pnpm workspace の monorepo とする

```text
apps/web/          Astro 7
packages/config/           tsconfig / oxlint / vitest の共有設定
packages/content-model/    schema / ContentRef / 関係グラフ (Astro 非依存)
packages/design-system/    tokens.css / layout primitives / 挿絵の生成器
infra/                     Terraform。workspace package ではない
```

**package 境界を「後で切り出す」のではなく最初から物理的に分ける。**

単一 package で独立性を維持する手段は lint の import 制限だけである。
lint は違反を「動いてしまう」形で通す。
package として分ければ、境界違反は依存解決の失敗として現れ、build が止まる。

**規約を機械で強制できることが、1 名運用における保守性そのものである。** レビューによる職務分離が成立しない以上、規約は実行系が拒否する形でしか守れない。

この構成が保証するものは 2 つある。`content-model` の package.json が Astro を依存に持たないこと。`design-system` の package.json が Tailwind を依存に持たないこと。
どちらも設計不変量であり ([design/DesignDoc.md](../design/DesignDoc.md) の 4 と 5)、依存宣言を読むだけで検査できる。

`packages/` にモジュールを増やす条件は「2 つ以上の消費者が実在すること」とする。

### 2. Vite+ を採用する。ただし適用範囲を 3 つに限定する

| 領域                              | 担当                                       |
| --------------------------------- | ------------------------------------------ |
| Node.js のバージョン固定          | `vp env`                                   |
| package manager の実行            | `vp install` (pnpm を wrap)                |
| monorepo のタスク実行とキャッシュ | `vp run`                                   |
| lint / format / test / typecheck  | Oxlint / Oxfmt / Vitest / tsgo (`vp` 同梱) |
| **Astro の dev / build**          | **Astro CLI (package.json script)**        |

**`vp dev` / `vp build` で Astro を置き換えない。** Vite+ の `dev` / `build` は素の Vite アプリを対象とし、Astro を外側から駆動する経路は存在しない。
ビルド速度の改善も Vite+ 由来では発生しない。

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
  書くと `vp` 必須になる。
- `oxlint` / `oxfmt` / `vitest` / `typescript` を devDependencies にも宣言する。`vp` 同梱版だけに頼ると `vp` の無い環境で検査が動かない。

**この形により `vp` の無い環境でも `pnpm -r run build` が同じことをする。** Vite+ は「タスクの並べ方とキャッシュ」だけを担い、「何を実行するか」を握らない。

### 4. 撤退経路を確保する

`vp run --cache` が `astro build` の入力を正しく推論できるかは未確認である。
Astro の入力は `src/content/**` / `astro.config.ts` / `public/**` / 依存 package の成果物で、外から入力集合が自明でない。**キャッシュ誤ヒットは「更新したページが出ない」形で表面化し、検知が遅れる。**

実装時に次を確認する。

1. `apps/web/src/content/` のファイルを 1 つ変更して `vp run --cache build` がキャッシュミスすること
2. `packages/design-system/` のトークンを変更して `apps/web` の build がキャッシュミスすること
3. 何も変更せずに 2 回目がキャッシュヒットすること

満たさない場合、キャッシュを無効化するか Turborepo へ切り替える。
Turborepo は `outputs` / `inputs` を明示宣言する方式のため入力推論の不確かさを持たない。**タスクの実体が package.json scripts にある限り、切り替えは設定ファイルの差し替えだけで済む。**

## 代替案

### 1. 単一 package で始め、必要になってから workspace 化する

#### Pros

- 初期構成が最も単純になる。`pnpm-workspace.yaml` も package.json の分割も要らない。

#### Cons

- Content Model と Design System の独立を lint でしか守れない。
  違反が「動いてしまう」形で混入する。
- `content-model` を Astro なしで単体テストできることを検査できない。
  同一 package では Astro の依存が常に解決可能なため、非依存を主張しても確かめる手段がない。
- 後から workspace 化するとき、`apps/web` へツリー全体を移す作業が発生する。

**この代替案は成立しないわけではない。** 消費者が 1 つしかない現状では、単一 package でも動くものは作れる。
採らない理由は動作ではなく、規約を機械で強制できるかどうかにある。

### 2. Turborepo を採用する

#### Pros

- `outputs` / `inputs` の明示宣言によりキャッシュの入力が自明になる。
  Astro の build でも誤ヒットの不確かさがない。
- 実績が長い。

#### Cons

- Node.js runtime と package manager の管理、lint / format / test の同梱が得られず、別途ツールを入れることになる。
- Vite+ を入れた場合と役割が重複する。

**撤退経路として残す。** 上記「4. 撤退経路」の条件を満たさなければ Turborepo へ切り替える。

### 3. Vite+ を採用しない (pnpm scripts のみ)

#### Pros

- beta のツールに依存しない。

#### Cons

- Node.js の固定に mise 等を別途入れることになる。
- タスクのキャッシュが得られない。

### 4. mise で Node を固定する

#### Pros

- 実績があり、cargo 製バイナリ (`similarity-ts`) も管理できる。

#### Cons

- `vp env` と役割が重複し、Node のバージョン定義が 2 箇所になる。
  二重管理を避けるため採らない。

### 5. Bun を package manager にする

#### Pros

- インストールとスクリプト実行が速い。

#### Cons

- pnpm workspace を土台とする決定と衝突する。
  Vite+ は lockfile から package manager を検出して wrap するため、pnpm のまま Vite+ の利得を受け取れる。

## 外部依存の健全性

| 項目                                                | 採用候補 (Vite+)                                                                    | 代替案 (Turborepo)          |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------- |
| 最終公開日                                          | beta 2026-07-02                                                                     | 2.9.x が kufu-apps で稼働中 |
| 対象バージョンへの対応 (peer dependency / 動作要件) | Vite 8 / Vitest / Oxlint を同梱。package manager は pnpm / npm / Yarn / Bun を wrap | Node.js のみ                |
| 後継・代替の有無                                    | 代替は Turborepo / Nx / pnpm scripts                                                | 代替は Vite+ / Nx           |

**"stable, but not yet complete" という公式の留保がある。** 撤退経路 (上記 4) を確保した上で採用する。

## 影響

### 良い影響

- 依存規約 2 本のうち「`content-model` を Astro 非依存に保つ」が package の依存宣言で強制される。
- Node.js のバージョン固定、lint、format、test、タスクキャッシュが 1 つの入口に揃う。
- `design-system` が Tailwind を依存に持たないことを、package.json の 1 行で検査できる。

### 悪い影響 / トレードオフ

- package.json が 5 つ以上になる。
  初期の構築手数が増える。
- beta のツールを toolchain の中心に置く。
  撤退経路で緩和するが、`vp` の破壊的変更に追従する手間は残る。
- `similarity-ts` は cargo 製で `vp env` の管理外にある。
  未インストール環境では検査が「実行されなかった」のであって「通った」ではない。

### 影響範囲

- 対象モジュール / package: repo 全体

## 実装・運用への反映

- spec 更新要否: 要 (monorepo の骨格構築と `vp run --cache` の検証 3 項目を Phase 1 の spec に含める)
- context / AI 向け設定更新要否: 要。
  [context/toolchain.md](../context/toolchain.md) に適用範囲、[context/engineering.md](../context/engineering.md) に root task を記載する

## 関連ドキュメント / チケット

- [context/toolchain.md](../context/toolchain.md): ツール構成の正本
- [context/architecture.md](../context/architecture.md): package 境界と依存規約
- [ADR-0002](0002-content-model-independence.md): package 分割が支える独立性
- [ADR-0007](0007-quality-gates.md): 品質ゲートのツール選定
- [Announcing Vite+ Beta](https://voidzero.dev/posts/announcing-vite-plus-beta)
- [Vite+ `vp run`](https://viteplus.dev/guide/run)
