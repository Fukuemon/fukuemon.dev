---
type: context
title: Engineering Conventions
description: 共有設定の境界、root task の構成、repository 全体の品質ゲートと除外方針、コメントの書き分け。
keywords: [shared config, root task, quality gate, Lefthook, knip, react-doctor, コメント, Why not]
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
- `tokens.css` を素の CSS で書く理由 (Expressive Code が挿す CSS はこちらのビルドを通らないため)

いずれも該当 ADR へのリンクを 1 行添える。

書かないもの: コードを言い換えただけの行、型を繰り返すだけの doc、変更の経緯や issue 番号 (commit と ADR が持つ)。

### 言語と語彙

- ドキュメント / commit / PR は日本語で書く。
- **ユーザーに見える文字列リテラルは変えない。** 観測可能な契約であり、テストが固定している。
- 識別子・型名・API 名は原語のまま使う。

**比喩や省略に寄った言い回しを使わない。**
短い比喩は書き手には密度が高く見えるが、読み手には辞書が要る。
初見で意味を推測できない語は、圧縮ではなく欠落になる。

| 使わない | 使う                                |
| -------- | ----------------------------------- |
| 畳む     | まとめる / 折りたたむ               |
| 落とす   | 削除する / 隠す / 変換する          |
| 潰す     | 上書きする / 読めなくなる           |
| 引く     | 参照する / 探す                     |
| 走らせる | 実行する                            |
| 寄せる   | 集約する                            |
| 面       | セクション / ページ / 画面 / 背景   |
| 意匠     | 見た目 (結果) / スタイリング (手段) |
| 土台     | 基盤 / 仕組み                       |

「見た目」と「スタイリング」は分けて使う。
**どう見えるかが主題なら「見た目」、どう指定するかが主題なら「スタイリング」である。**

**組版の専門語は残す。** 版面・罫・縦組み・縦中横は、
design system の文脈では平易な言い換えより正確である。
`.rulesync/` の contract が定義して使っている語 (正本・phase gate など) も、
定義が共有されているので残す。

### PR 本文

見出しは `workflow-git` skill の `assets/pr-body-template.md` をそのまま使う。
必須は `概要` / `変更内容` / `検証` で、訳し替えも言い換えもしない。
UI やデザインに触れる PR では `Design Guard` を付け、
**満たしていない項目はチェックせず、満たしていない理由を書く。**

### 参照の張り方

- **コメントから spec / issue を引用しない。** spec は issue close 時に削除される作業文書であり、コードから参照すると宙に浮いたリンクが残る。
- 理由を残すときのリンク先は `adr/*.md` / `context/*.md` / feature doc に限る。

## Shared Config Boundary

**設定を package ごとに複製しない。** 置き場は次のとおり。

| 設定            | 正本                                         | 参照のしかた                                 |
| --------------- | -------------------------------------------- | -------------------------------------------- |
| tsconfig        | `@fukuemon/config` の `./tsconfig/base.json` | 各 package が `extends` する                 |
| lint / 依存境界 | ルートの `.oxlintrc.json` 1 枚               | root から repo 全体へ 1 回掛ける             |
| dead code       | `package.json` の `knip` フィールド          | 同上                                         |
| format          | `oxfmt` の既定                               | 設定ファイルを持たない                       |
| vitest          | 各 package の `vitest.config.ts`             | 共有しない (対象の列挙が package ごとに違う) |

`@fukuemon/config` が export するのは tsconfig だけである。
Astro 向けの tsconfig は `apps/web/tsconfig.json` が `astro/tsconfigs/strict` を直接 `extends` する。

**`no-restricted-imports` の依存規約はルートの `.oxlintrc.json` に置く。**
package ごとに書くと片方だけ更新される。

## Root Task Boundary

root から束ねるタスクと、直実行するタスクを分ける。

| タスク                         | root の script                        | そうする理由                      |
| ------------------------------ | ------------------------------------- | --------------------------------- |
| `build` / `typecheck` / `test` | `pnpm -r --sequential run <task>`     | package 間に依存順序がある        |
| `lint`                         | `oxlint --type-aware` を root で 1 回 | 依存境界の検査が package をまたぐ |
| `format`                       | `oxfmt .` を root で 1 回             | repo 全体に一括で掛ける           |
| `knip`                         | root で 1 回                          | workspace 横断で未使用を判定する  |
| `check:contrast`               | `packages/design-system` を直実行     | 配色の正本がそこにある            |
| `shot` / `shot:diff`           | root の `e2e/` を直実行               | 単一 package に属さない           |
| `infra:*`                      | root script から `infra/` を直実行    | workspace package ではない        |

**package ごとに変わるコマンドは、その package の `package.json` scripts に置く。**
root は `pnpm -r` で束ねるだけにする。

`check` が上を 1 本につないでいる。CI もこれを実行する。

```
lint → typecheck → knip → check:contrast → check:worker-name → test → build → check:deploy
```

`shot` / `shot:diff` は `check` に入れない。理由は [testing.md](testing.md) を読む。

### commit 前に通す検査

Lefthook の pre-commit は 2 つだけを実行する。

1. 保護ブランチの検査 (`hooks/protected-branch/`)
2. 整形 (`hooks/format/run_prettier.sh`)

**lint / typecheck / test を pre-commit で回さない。** 時間がかかり、commit の粒度を粗くする方向に働く。
これらは `pnpm run check` と CI が担う。

hook は sdd-template が配る初期値である ([README.md](../README.md))。
足すときは消費 repo 側ではなくテンプレ側を直す。

## Repository Quality Gate

| 検査                    | 正本 config                                                                     | 実行点                |
| ----------------------- | ------------------------------------------------------------------------------- | --------------------- |
| 依存境界 (規約 1・3〜5) | ルートの `.oxlintrc.json` の `no-restricted-imports` (`overrides` で方向を固定) | `check` / CI          |
| 依存境界 (規約 2)       | 各 package の `dependencies` 宣言                                               | `knip` (`check` / CI) |
| dead code / 未使用依存  | `package.json` の `knip` フィールド                                             | `check` / CI          |
| 型                      | `astro check` + tsgo                                                            | `check` / CI          |
| 配色                    | `packages/design-system/check-contrast.ts`                                      | `check` / CI          |
| 見た目の回帰            | `e2e/shoot.ts` + `e2e/diff.ts`                                                  | 手で回す              |

**コード重複 (`similarity-ts`) と React 診断 (`react-doctor`) は入れていない。**
`similarity-ts` は cargo 製の外部バイナリで、環境によっては存在しない。
`doctor` は root script にあるが `check` からは呼んでいない (`npx` で毎回取りに行くため)。
どちらも「入れていない」であって「通っている」ではない。

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

### 検査の道具がこちらの書き方に依存する箇所

**`.astro` の `<script>` は 1 ファイルに 1 つだけにする。**
knip は最初の `<script>` しか読まない。
2 つ目に置いた import は追跡されず、そこからしか呼ばれないモジュールが「未使用」と報告される。
`type="application/json"` のようなデータ置き場を足すときは、
module の `<script>` より **後ろ** に書く。

**oxlint の `overrides` は、同じ規則名を後勝ちで上書きする。** 前の entry とは合流しない。
`features/**` の entry を足したとき、`**/*.tsx` の entry が持っていた
`astro:content` と island の禁止が、`features/` 配下の `.tsx` で静かに消えた。
**各 entry は、そのファイル群に必要な禁止を全て自分で持つ。**
足したら `.oxlintrc.json` の各方向について、違反するファイルを 1 つ置いて `pnpm run lint` が落ちることを確かめる。

**配色の検査は、対象が見つからないことを失敗として扱う。**
`packages/design-system/check-contrast.ts` はトークン名で `Map` を引く。
名前が変わったときに 1 件も検査せず通過しないよう、
存在しないトークンをそれ自体で `errors` に積む。

### 検査が「実行されなかった」ことを「通った」と扱わない

**入れていない検査を、表から黙って消さない。** 上の表に「入れていない」と書くところまでを含めて記録する。
外部バイナリに依存する検査を後から足すときは、**存在しない場合を失敗として扱う。**
存在検査なしに実行すると、環境に無いというだけで成功として集計される。

## 参照

- [toolchain.md](toolchain.md): ツール選定と Vite+ の適用範囲
- [architecture.md](architecture.md): 依存規約の本文
- [testing.md](testing.md): テストの責務分担とカバレッジ要求
- [project.yml](project.yml): commands / quality gate の固有値
- [ADR-0007](../adr/0007-quality-gates.md): 品質ゲートの採否
- [ADR-0003](../adr/0003-monorepo-and-vite-plus.md): root task と Vite+ の関係
