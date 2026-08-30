---
type: context
title: Engineering Conventions
description: 共有設定の境界、root task の構成、repository 全体の品質ゲートと除外方針、コメントの書き分け。
keywords:
  [
    shared config,
    root task,
    quality gate,
    Lefthook,
    knip,
    react-doctor,
    コメント,
    Why not,
  ]
governs:
  - package.json
  - lefthook.yml
  - packages/config/
verified_commit: unverified
---

# Engineering Conventions

shared config / root task / repository quality gate の境界規約。
toolchain 一覧は [toolchain.md](toolchain.md)、プロジェクト固有コマンドは [context/project.yml](project.yml)。

## Code Comment Boundary

### 何をどこに書くか

情報の置き場を次のとおり分ける。**コードから読み取れることをコメントに書き写さない。**

| 置き場           | 書くこと                                       |
| ---------------- | ---------------------------------------------- |
| コード           | **How** — どう実現しているか。コード自身が語る |
| テストコード     | **What** — 何が成り立つべきか                  |
| commit / PR      | **Why** — なぜこの変更をしたか                 |
| コード内コメント | **Why not** — なぜ他の手を採らなかったか       |
| 関数・型の doc   | **What** — 何をするものか                      |

コード内コメントの主役は **Why not**。
「どう動くか」はコードを読めば分かるが、「なぜ素直な方法を採らなかったか」は読んでも分からない。
書かないと後から不用意に「単純化」されて壊れる。

本 repo で Why not を書くべき典型は次である。

- `contentId` を Astro の `id` に載せない理由 (Astro が占有し、`slug` は schema に置けない)
- 関係に `reference()` を使わない理由 (collection をまたぐため / Astro 非依存を保つため)
- `tokens.css` に Tailwind の構文を書かない理由 (Expressive Code が挿す CSS が Tailwind を通らないため)

いずれも該当 ADR へのリンクを 1 行添える。

書かないもの: コードを言い換えただけの行、型を繰り返すだけの doc、変更の経緯や issue 番号 (commit と ADR が持つ)。

### 言語

- コード内コメント / ドキュメント / commit / PR は日本語で書く。
- **ユーザーに見える文字列リテラルは変えない。** 観測可能な契約であり、テストが固定している。
- 識別子・型名・API 名は原語のまま使う。

### 参照の張り方

- **コメントから spec / issue を引用しない。** spec は issue close 時に削除される作業文書であり、コードから参照すると宙に浮いたリンクが残る。
- 理由を残すときのリンク先は `adr/*.md` / `context/*.md` / feature doc に限る。

## Shared Config Boundary

`@fukuemon/config` が tsconfig / oxlint / vitest の設定を export する。**設定を package ごとに複製しない。**

```jsonc
// packages/config/package.json の exports
{
  "./tsconfig/base": "./tsconfig/base.json",
  "./tsconfig/astro": "./tsconfig/astro.json",
  "./oxlint/base": "./oxlint/base.json",
  "./vitest/base": "./vitest/base.ts",
}
```

各 package は `extends` / `import` で参照し、差分だけを自身の設定に書く。

**`no-restricted-imports` の依存規約は `oxlint/base.json` に置く。** package ごとに書くと片方だけ更新される。

## Root Task Boundary

root から束ねるタスクと、直実行するタスクを分ける。

| タスク                                  | 実行                               | 束ねる理由                       |
| --------------------------------------- | ---------------------------------- | -------------------------------- |
| `build` / `typecheck` / `test` / `lint` | `vp run -r <task>`                 | package 間に依存順序がある       |
| `format`                                | `vp fmt`                           | repo 全体に一括で掛ける          |
| `knip`                                  | root で 1 回                       | workspace 横断で未使用を判定する |
| `similarity`                            | root で 1 回                       | 重複は package をまたぐ          |
| `e2e`                                   | root の `e2e/` を直実行            | 単一 package に属さない          |
| `infra:plan` / `infra:apply`            | root script から `infra/` を直実行 | workspace package ではない       |

**実際のコマンドは各 package の `package.json` scripts に置く。** root の `vite.config.ts` には `dependsOn` だけを宣言する ([context/toolchain.md](toolchain.md))。

### commit 前に通す検査

Lefthook の pre-commit で次を実行する。

1. `vp fmt --check`
2. `vp run -r lint`
3. `vp run -r typecheck`
4. `npx react-doctor@latest --scope changed` (React 変更がある場合)

**test は pre-commit で回さない。** 時間がかかり、commit の粒度を粗くする方向に働く。
CI で回す。

## Repository Quality Gate

| 検査                   | 正本 config                                                   | 実行点          |
| ---------------------- | ------------------------------------------------------------- | --------------- |
| 依存境界 (規約 1)      | `packages/config/oxlint/base.json` の `no-restricted-imports` | pre-commit / CI |
| 依存境界 (規約 2)      | 各 package の `dependencies` 宣言                             | `knip` (CI)     |
| dead code / 未使用依存 | `knip.json`                                                   | CI              |
| コード重複             | `similarity-ts` の既定                                        | CI              |
| 型                     | `astro check` + tsgo                                          | pre-commit / CI |
| React 診断             | `doctor.config.*`                                             | CI              |

### 除外方針

**除外を足すときは理由をこのファイルに記録する。** 設定ファイル側のコメントだけに残さない。
設定は書き換えられても記録は残るようにするためである。

現時点で予定している除外は次の 2 種である。

| 対象                                              | 理由                                             |
| ------------------------------------------------- | ------------------------------------------------ |
| Astro が生成する型定義 (`.astro/`)                | 生成物。`knip` の未使用判定と型検査の対象外      |
| shadcn CLI の出力 (`apps/web/src/components/ui/`) | 手で作らない。重複検出と一部の lint 規則の対象外 |

### react-doctor の無効化ルール

Design System は「カードを使わない」「罫線と余白で階層を作る」「見出しをほとんど大きくしない」といった、汎用 UI ルールと衝突しうる規則を持つ ([ADR-0004](../adr/0004-typography-static-weights.md) / design-system の feature doc)。

**衝突して無効化したルールは、次の表に追記する。** `react-doctor rules disable` は設定ファイルを書き換えるが、無効化の理由は記録しないためである。

| ルール     | 無効化した日 | 理由 |
| ---------- | ------------ | ---- |
| (まだ無し) |              |      |

### 検査が「実行されなかった」ことを「通った」と扱わない

`similarity-ts` は cargo 製の外部バイナリで、環境によっては存在しない。**CI では存在を検査し、欠けていれば警告として報告する。** スキップされた検査を成功として集計しない。

## 参照

- [toolchain.md](toolchain.md): ツール選定と Vite+ の適用範囲
- [architecture.md](architecture.md): 依存規約の本文
- [testing.md](testing.md): テストの責務分担とカバレッジ要求
- [project.yml](project.yml): commands / quality gate の固有値
- [ADR-0007](../adr/0007-quality-gates.md): 品質ゲートの採否
- [ADR-0003](../adr/0003-monorepo-and-vite-plus.md): root task と Vite+ の関係
