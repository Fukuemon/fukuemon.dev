# ADR-0007: 品質チェックに react-doctor / knip / similarity-ts を採り、mise / Bun / Biome を採らない

## Status

承認

## Context

運用者は 1 名で、レビューによる職務分離が成立しない。  
**規約は自動でチェックできる形にする必要がある。**

imaimai-front-templete が、Cloudflare Workers 上の TypeScript 構成で品質チェックを一式そろえている。  
oxlint / oxfmt / Lefthook / knip / similarity-ts / mise / react-doctor を持ち、層構造をカスタム oxlint プラグインで強制する仕組みも持つ。  
出典: [imaimai17468/imaimai-front-templete](https://github.com/imaimai17468/imaimai-front-templete)

- 本 repo には既に `lefthook.yml` がある。
- Vite+ が Oxlint / Oxfmt / Vitest / tsgo と Node.js runtime を同梱する。
  - ADR-0003: [pnpm workspace の monorepo とし、Vite+ を `vp run` / `vp env` / 同梱ツールに限定して採用する](0003-monorepo-and-vite-plus.md)
- **本サイトで React を使う範囲は小さい。** 静的 HTML で表現できるものに React を使わない方針であり、当初は Island がゼロになる見込みである。
- Design System は「カードを使わない」「罫線と余白で階層を作る」「見出しをほとんど大きくしない」といった、汎用 UI ルールと衝突しうる規則を持つ。

候補のバージョンとライセンスを調べた。

- react-doctor 0.9.12。npm の license 欄は `SEE LICENSE IN LICENSE`。
- knip 6.32.2。ライセンスは ISC。
- similarity-ts 0.5.0。cargo で配られる。
- Biome 2.5.10。ライセンスは MIT OR Apache-2.0。

## Decision

次のツールを採る。

| ツール            | 役割                                                                       |
| ----------------- | -------------------------------------------------------------------------- |
| **react-doctor**  | React 固有の診断 (correctness / performance / a11y / 設計)。0–100 のスコア |
| **knip**          | 未使用の export / 依存 / ファイルの検出                                    |
| **similarity-ts** | コード重複の検出                                                           |
| Oxlint + Oxfmt    | 既定の lint / format (Vite+ 同梱)                                          |
| Lefthook          | pre-commit のチェック                                                      |

出典: [React Doctor](https://www.react.doctor/)

次のツールと方式は採らない。

| ツール                    | 理由                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| **mise**                  | Node の固定は `vp env` が担う。バージョン定義が 2 箇所になる                              |
| **Bun**                   | pnpm workspace を基盤とする決定 (ADR-0003) と衝突する                                     |
| **Biome**                 | Oxlint / Oxfmt と役割が重複する                                                           |
| **`.claude/rules/` 方式** | 本 repo の AI 設定は sdd-template からの symlink 配布であり、消費 repo では commit しない |

ADR-0011: [ツールのバージョンを mise で固定する](0011-pin-tool-versions-with-mise.md) が、mise を採らないとしたこの判断を置き換えた。

### react-doctor はスコアを gate にせずに始める

**当初はスコアを gate にしない。** Island が存在しないため対象コードがない。  
CI には組み込むが、**Island が実在してから「スコアを下げる変更を止める」チェックへ昇格させる。**

**汎用ルールと Design System の衝突が予想される。**  
衝突したルールは `react-doctor rules disable` で個別に無効化する。  
**無効化の理由は [context/conventions.md](../context/conventions.md#check-exclusions) に記録する。**  
無効化そのものは記録されないためである。

**開発時のみ `npx` で実行し、成果物の依存に入れない。** バージョンが 0.9.x で 1.0 未満であり、ルールセットが安定していない。  
npm の license 欄が `SEE LICENSE IN LICENSE` で、OSI 標準ライセンスでもない。

### 依存方向の強制にカスタムプラグインを作らない

imaimai-front-templete は層構造をカスタム oxlint プラグインで強制する。  
本プロジェクトが強制する規約は次の 2 本だけ。

1. `apps/web/src/pages/**` と `apps/web/src/components/**` から `astro:content` を直接 import しない → Oxlint の `no-restricted-imports`
2. `@fukuemon/content-model` は `astro` / `astro:content` に依存しない → package の `dependencies` 宣言 + knip

ADR-0002: [関係を `contentId` の辺として持ち、Content Model を Astro 非依存に保つ](0002-content-model-independence.md)

**2 本では既存の仕組みで足りる。** 層が増えて `no-restricted-imports` の列挙が読めなくなった時点でカスタムプラグインを導入する。

### similarity-ts が無い環境を「通った」と扱わない

similarity-ts は cargo 製の外部バイナリで、`vp env` の管理外にある。  
**未インストールの環境では、チェックは「通った」のではなく「実行されなかった」。**  
CI では存在を確かめ、欠けていれば警告として報告する。

## Considered Options

| 選択肢                                                                                                        | 強み                                                                                                                                                                       | 弱み                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **採用:** Oxlint + Oxfmt に react-doctor / knip / similarity-ts を足し、Lefthook の pre-commit でチェックする | 未使用の export / 依存、React 固有の誤り、コード重複を検出できる。react-doctor は oxlint / eslint-plugin-react-hooks / typescript を内包し、`npx` 実行のため差し替えが容易 | react-doctor は 1.0 未満でルールセットが不安定。similarity-ts が `vp env` の外にある                                                                         |
| Oxlint / Oxfmt だけで済ませる                                                                                 | ツールが最も少ない。Vite+ 同梱で追加インストールがゼロ。バージョンは Vite+ が管理し、同梱版に追従する                                                                      | 未使用の export / 依存が monorepo で溜まる。package を 5 つ以上持つ構成では knip の価値が大きい。React 固有の誤りは汎用 lint では拾えない                    |
| Biome に集約する                                                                                              | formatter と linter が 1 つに揃い、設定が単純になる                                                                                                                        | Vite+ が Oxlint / Oxfmt を同梱するため役割が重複する。同梱ツールを使わずに別のものを入れる理由がない                                                         |
| react-doctor をスコア gate として最初から強制する                                                             | 規約の自動強制という方針に最も忠実                                                                                                                                         | 対象コードが存在しない段階では常に満点になり、gate が機能しない。Island が入った時点で大量の指摘が出て、そこで緩めることになる。段階的に上げるほうが機能する |
| mise で Node と cargo バイナリを一括管理する                                                                  | similarity-ts を含めてバージョンを 1 箇所で固定できる。similarity-ts が `vp env` の外にある問題が消える                                                                    | Node のバージョン定義が `vp env` と 2 箇所になる。**この二重管理を避けることを優先する。** similarity-ts の未インストールは CI の存在の確認で検出する        |

## Consequences

### Positive

- 依存規約 2 本が既存ツールだけで機械でチェックできる。
  - カスタムプラグインの保守が不要になる。
- monorepo で未使用の export / 依存が溜まらない。
- Node のバージョン定義が `vp env` の 1 箇所に収まる。

### Negative

- react-doctor が 1.0 未満のため、アップグレードで指摘内容が変わりうる。
  - `npx ...@latest` で実行するので、その変動を受ける。
- Design System と汎用ルールの衝突を都度判断し、無効化の理由を記録する運用が要る。
- similarity-ts が `vp env` の外にあり、環境差でチェックが抜けうる。
