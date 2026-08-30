# ADR-0007: 品質ゲートに react-doctor / knip / similarity-ts を採り、mise / Bun / Biome を採らない

## 状態

承認

## 決定日

2026-08-26

## 背景

- 運用者は 1 名で、レビューによる職務分離が成立しない。**規約は自動検査可能な形にする必要がある。**
- imaimai-front-templete が、Cloudflare Workers 上の TypeScript 構成で品質ゲートを一式そろえている。
  oxlint / oxfmt / Lefthook / knip / similarity-ts / mise / react-doctor、および層構造をカスタム oxlint プラグインで強制する仕組みを持つ。
  - [imaimai17468/imaimai-front-templete](https://github.com/imaimai17468/imaimai-front-templete)
- 本 repo には既に `lefthook.yml` がある。
- Vite+ が Oxlint / Oxfmt / Vitest / tsgo と Node.js runtime を同梱する (ADR-0003)。
- **本サイトで React を使う範囲は小さい。** 静的 HTML で表現できるものに React を使わない方針であり、当初は Island がゼロになる見込みである。
- Design System は「カードを使わない」「罫線と余白で階層を作る」「見出しをほとんど大きくしない」といった、汎用 UI ルールと衝突しうる規則を持つ。
- 2026-08-25 時点の版を実測した。
  react-doctor 0.9.12 (npm の license 欄は `SEE LICENSE IN LICENSE`)、knip 6.32.2 (ISC)、similarity-ts 0.5.0 (cargo)、Biome 2.5.10 (MIT OR Apache-2.0)。

## 決定

### 採るもの

| ツール            | 役割                                                                       |
| ----------------- | -------------------------------------------------------------------------- |
| **react-doctor**  | React 固有の診断 (correctness / performance / a11y / 設計)。0–100 のスコア |
| **knip**          | 未使用の export / 依存 / ファイルの検出                                    |
| **similarity-ts** | コード重複の検出                                                           |
| Oxlint + Oxfmt    | 既定の lint / format (Vite+ 同梱)                                          |
| Lefthook          | pre-commit ゲート                                                          |

### 採らないもの

| ツール                    | 理由                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| **mise**                  | Node の固定は `vp env` が担う。バージョン定義が 2 箇所になる                              |
| **Bun**                   | pnpm workspace を土台とする決定 (ADR-0003) と衝突する                                     |
| **Biome**                 | Oxlint / Oxfmt と役割が重複する                                                           |
| **`.claude/rules/` 方式** | 本 repo の AI 設定は sdd-template からの symlink 配布であり、消費 repo では commit しない |

### react-doctor の適用範囲

**当初はスコアを gate にしない。** Island が存在しないため対象コードがない。
CI には組み込むが、**Island が実在してから「スコアを下げる変更を止める」ゲートへ昇格させる。**

| 場面                 | コマンド                                            |
| -------------------- | --------------------------------------------------- |
| 変更差分の回帰検査   | `npx react-doctor@latest --verbose --scope changed` |
| 全体の棚卸し         | `npx react-doctor@latest --verbose`                 |
| Design System の監査 | `npx react-doctor@latest design --verbose`          |

**汎用ルールと Design System の衝突が予想される。** 衝突したルールは `react-doctor rules disable` で個別に無効化し、**無効化の理由を [context/engineering.md](../context/engineering.md) に記録する。** 無効化そのものは記録されないためである。

**開発時のみ `npx` で実行し、成果物の依存に入れない。** version が 0.9.x で 1.0 未満でありルールセットが安定していない。
npm の license 欄が `SEE LICENSE IN LICENSE` で OSI 標準ライセンスでもない。

### 依存方向の強制はカスタムプラグインを作らない

imaimai-front-templete は層構造をカスタム oxlint プラグインで強制する。
本プロジェクトが強制する規約は 2 本だけである (ADR-0002)。

1. `apps/web/src/pages/**` と `apps/web/src/components/**` から `astro:content` を直接 import しない → Oxlint の `no-restricted-imports`
2. `@fukuemon/content-model` は `astro` / `astro:content` に依存しない → package の `dependencies` 宣言 + knip

**2 本では既存の仕組みで足りる。** 層が増えて `no-restricted-imports` の列挙が読めなくなった時点でカスタムプラグインを導入する。

### `similarity-ts` の扱い

cargo 製の外部バイナリで `vp env` の管理外にある。**未インストールの環境では検査が「実行されなかった」のであって「通った」ではない。** CI では存在を検査し、欠けていれば警告として報告する。

## 代替案

### 1. Oxlint / Oxfmt だけで済ませる

#### Pros

- ツールが最も少ない。
  Vite+ 同梱で追加インストールがゼロ。

#### Cons

- 未使用の export / 依存が monorepo で溜まる。
  package を 5 つ以上持つ構成では knip の価値が大きい。
- React 固有の誤りは汎用 lint では拾えない。

### 2. Biome に集約する

#### Pros

- formatter と linter が 1 つに揃い、設定が単純になる。

#### Cons

- Vite+ が Oxlint / Oxfmt を同梱するため役割が重複する。
  同梱ツールを使わずに別のものを入れる理由がない。

### 3. react-doctor をスコア gate として最初から強制する

#### Pros

- 規約の自動強制という方針に最も忠実。

#### Cons

- 対象コードが存在しない段階では常に満点になり、gate が機能しない。
  しかも Island が入った瞬間に大量の指摘が出て、その時点で緩めることになる。
  段階的に上げるほうが機能する。

### 4. mise で Node と cargo バイナリを一括管理する

#### Pros

- `similarity-ts` を含めてバージョンを 1 箇所で固定できる。
  上記「`similarity-ts` の扱い」の問題が消える。

#### Cons

- Node のバージョン定義が `vp env` と 2 箇所になる。**この二重管理を避けることを優先する。** `similarity-ts` の未インストールは CI の存在検査で検出する。

## 外部依存の健全性

| 項目                                                | 採用候補 (react-doctor)                                            | 代替案 (Oxlint 単体) |
| --------------------------------------------------- | ------------------------------------------------------------------ | -------------------- |
| 最終公開日                                          | 0.9.12 (2026-08-25 時点)                                           | Vite+ 同梱版に追従   |
| 対象バージョンへの対応 (peer dependency / 動作要件) | oxlint / eslint-plugin-react-hooks / typescript を内包。`npx` 実行 | Vite+ が管理         |
| 後継・代替の有無                                    | 1.0 未満でルールセットが不安定。`npx` 実行のため差し替えは容易     | —                    |

## 影響

### 良い影響

- 依存規約 2 本が既存ツールだけで機械検査できる。
  カスタムプラグインの保守が不要になる。
- monorepo で未使用の export / 依存が溜まらない。
- Node のバージョン定義が `vp env` の 1 箇所に収まる。

### 悪い影響 / トレードオフ

- react-doctor が 1.0 未満のため、アップグレードで指摘内容が変わりうる。`npx ...@latest` で実行するので変動を受ける。
- Design System と汎用ルールの衝突を都度判断し、無効化の理由を記録する運用が要る。
- `similarity-ts` が `vp env` の外にあり、環境差で検査が抜けうる。

### 影響範囲

- 対象モジュール / package: repo 全体

## 実装・運用への反映

- spec 更新要否: 要 (CI と Lefthook のゲート構成)
- context / AI 向け設定更新要否: 要。
  [context/toolchain.md](../context/toolchain.md) に採否、[context/engineering.md](../context/engineering.md) にゲートの実行と無効化ルールの記録先を記載する

## 関連ドキュメント / チケット

- [context/toolchain.md](../context/toolchain.md): ツール構成の正本
- [context/engineering.md](../context/engineering.md): Repository Quality Gate
- [ADR-0002](0002-content-model-independence.md): 機械検査する依存規約 2 本
- [ADR-0003](0003-monorepo-and-vite-plus.md): Vite+ 同梱ツールとの関係
- [imaimai17468/imaimai-front-templete](https://github.com/imaimai17468/imaimai-front-templete)
- [React Doctor](https://www.react.doctor/)
