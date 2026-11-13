---
type: context
title: コードと文書の規約
description: コンポーネントの命名、コメントに書くこと、文書と記事の書き方のうちこのリポジトリだけの規則、共有の設定とチェックの実行点、自動チェックの除外。lint で検出できる規則は書かない
status: stable
governs:
  - package.json
  - lefthook.yml
  - oxlint.config.ts
  - .oxfmtrc.jsonc
  - packages/config/
verified_commit: 63b37ad
---

# コードと文書の規約

## Naming

- コンポーネントの名前は、「何の」「動作」「UI 要素」の順で組む。
  - 例: `ContentTable`、`KindTabs`、`StepList`、`ArtBand`
- 状態を名前に入れず、props で表す。`ActiveTab` も `TabActive` も使わない。
- 識別子、型名、API 名は、原語のまま使う。
- 名前を変える変更では、ユーザーに見える文字列リテラルを変えない。観測できる契約であり、テストが固定している。文言は、文言を直す変更として分けて変える。

## Comments

情報の置き場は次のとおり分ける。  
コードから読み取れることを、コメントに書き写さない。

- コードは、どう実現しているか（How）を語る。
- テストコードは、何が成り立つべきか（What）を書く。
- コミットと pull request は、なぜその変更をしたか（Why）を書く。
- コードの中のコメントは、なぜほかの手を採らなかったか（Why not）を書く。
- 関数と型の doc コメントは、何をするものか（What）を書く。

コードの中のコメントは、Why not を主に書く。  
書かないと、あとで誰かが不用意に単純化し、不具合を入れる。  
このリポジトリで Why not を書くべき箇所の典型は次の 2 つ。

- `contentId` を Astro の `id` に載せない理由。Astro が `id` を占有し、`slug` を schema に置けない。
- 関係に `reference()` を使わない理由。collection をまたぎ、Content Model を Astro に依存させないため。

Why not のコメントには、該当する ADR へのリンクを 1 行添える。

次のものは、コメントに書かない。

- コードを言い換えただけの行
- 型を繰り返すだけの doc コメント
- 変更の経緯と issue の番号。コミットと ADR が持つ。
- spec と issue の引用。spec は issue を閉じるときに消える作業文書で、リンクが宙に浮く。

理由を残すときのリンク先は、`docs/adr/`、`context/`、feature の Design Doc に限る。

## Documents

- 文書、コミット、pull request は日本語で書く。
- 「見た目」と「スタイリング」を分けて使う。
  - どう見えるかが主題なら「見た目」、どう指定するかが主題なら「スタイリング」と書く。
- 組版の専門語（版面、罫、縦組み、縦中横）は、平易な語に言い換えずに使う。
- 比喩と省略に寄った言い回しを使わない。使わない語と言い換えは `prh.yml` に置く。

### 記事とハンズオンの本文

記事とハンズオンの本文は `apps/web/src/content/` に置く。  
コンテンツの用語と、frontmatter の項目が守る条件は [domain.md](domain.md) にある。  
1 本を足すときに触るファイルは、Markdown の 1 枚だけにする。

- 原稿の本文は、`である` 調で書く。frontmatter の `description` も同じである。
  - 箇条書きと表のセルは、体言止めか終止形で書く。
  - 手順の指示は「〜する」「〜を確認する」と書き、「〜してください」と書かない。
  - リポジトリの文書（context、PRD、Design Doc、ADR など）も、`である` 調で書く。
- サイトの UI の文言（ボタン、状態の表示、空の状態の案内）は、`ですます` 調で書く。
- 原稿の textlint の設定は `apps/web/src/content/.textlintrc.json` に置く。
  - ルートの `.textlintrc.json` に、`.mdx` を読むプラグインと、原稿だけに許す語を足している。
  - textlint は、実行したディレクトリの設定を 1 つだけ読み、ディレクトリごとに設定を重ねない。原稿には `--config` で原稿の設定を渡す。
- 記事は `articles/` に、ハンズオンは `labs/` に置く。frontmatter に種別を書かない。
- 実行パネルを置く記事とハンズオンは `.mdx` で書き、置かないものは `.md` で書く。
  - `interactive.level` が `local` のハンズオンは実行パネルを持たないので、`.md` で書く。
- 実行パネルは、コードフェンスの言語の後に `run` を付けて置く。著者は JSX を書かない。
  - 記事は `setup` を持てないので、フェンスの中で必要なものを作りきる。
- `run` のフェンスに書く `VACUUM` は、1 文だけで書く。`CREATE DATABASE` と `CREATE INDEX CONCURRENTLY` も同じ。
  - 複数の文は暗黙のトランザクションに包まれ、`VACUUM cannot run inside a transaction block` で失敗する。
- ハンズオンの手順の所要時間は、手順の見出しの直後に `Duration: MM:SS` の行で書く。
- 図は `mermaid` のコードフェンスで書き、色を指定しない。
  - `style` や `classDef` で色を書くと、暗い地で読めなくなる。

書いた記事とハンズオンは、`pnpm --filter @fukuemon/web dev` で確認する。

## Styling

`packages/ui` のコンポーネントと、`packages/ui` で組む画面は、[packages/ui/DESIGN.md](../packages/ui/DESIGN.md) と、そこから指す 3 つの文書の規則に従う。  
この節には、`apps/web` のスタイリングの規則のうち、`packages/ui` の文書に無いものを書く。

層の順とトークンの層は [デザインシステム（packages/ui）の Design Doc の「トークンの層」](../packages/ui/DesignDoc.md#トークンの層) にある。

### サイトの共通の CSS

- サイトの共通の CSS は `apps/web/src/styles/site.css` に置き、`layouts/SiteLayout.astro` が読み込む。
- `site.css` は、`@import "tailwindcss"` で preflight を読み、`@fukuemon/ui` の `fonts.css` と `theme.css` を読む。カタログの `preview.css` と同じ形にする。
  - ADR-0050: [サイトの共通の CSS で Tailwind CSS の preflight を読み、トークンを packages/ui のテーマ変数から使う](../docs/adr/0050-tailwind-preflight-and-theme-from-ui.md)
- `@theme static` を書かない。トークンの値は、`packages/ui` の `:root` の素のカスタムプロパティとして出る。
- 本文へのスキップリンクは、`SiteLayout.astro` の `<body>` の最初に置き、`<main id="main">` を指す。
- `scroll-padding-block-start` は、画面の上に固定のヘッダを置くときに、ヘッダの高さに合わせて決める。

### 状態の書き方

**基準値と状態の上書きは同じ層に置く**。  
基準値だけを markup へ移すと、utility が層の上で状態の規則に勝つ。

状態は、markup では次のバリアントで書く。

| 状態の出どころ                        | CSS の選択子の例                          | markup                                     |
| ------------------------------------- | ----------------------------------------- | ------------------------------------------ |
| 要素自身の `data-*` 属性              | `.steps__mark[data-state="done"]`         | `data-[state=done]:...`                    |
| 要素自身の `aria-current`             | `.steps__link[aria-current]`              | `aria-[current]:...`                       |
| 親の状態                              | `.steps__link[aria-current] .steps__text` | 親に `group`、子に `group-aria-[current]:` |
| 離れた祖先の `data-*` 属性            | `[data-open="false"]` の子孫              | `[[data-open=false]_&]:...`                |
| `<dialog>` と `<details>` の `[open]` | `.sheet[open]`                            | `open:...`                                 |
| ページの中のほかの要素の有無          | `body:has([data-side]) .foot`             | `[body:has([data-side])_&]:...`            |

- `aria-current` の有無で当てるときは、`aria-[current]:` を使う。
  - 組み込みの `aria-current:` は `[aria-current="true"]` に当たり、手順の現在地の `aria-current="step"` には当たらない。
- `<dialog>` に `display` を当てるときは、`[open]` に限定する。
  - UA のデフォルトの `dialog:not([open]) { display: none }` に勝ち、閉じている窓が画面に出る。

### 当たり判定

規則は [packages/ui の DESIGN.md の「アクセシビリティ」](../packages/ui/DESIGN.md#アクセシビリティ) にある。

- 触る端末だけで寸法を変えるときは、`pointer-coarse:` を使う。
- 押せる範囲を疑似要素で広げるユーティリティを、サイトの CSS に持たない。押せる範囲は `packages/ui` のコンポーネントが持つ。

## React

React の誤りのうち、lint で止まるものは Oxlint の規則に任せる。  
有効にしている規則は `oxlint.config.ts` にある。  
この節には、lint で止まらない書き方を書く。

- props が変わったときに state を初期の値に戻すのは、`key` で行う。Effect の中で `setState` を呼んで戻さない。
- 利用者の操作で起きる処理は、イベントハンドラに書く。Effect に書かない。
- 外部の store を購読するときは、`useSyncExternalStore` で書く。
- Effect の中で、最新の props を読むだけの処理は、`useEffectEvent` に分ける。依存の配列に入れて、Effect を張り直させない。
- 端末の値（`localStorage`、端末の日付、画面の幅）で描く island は、次のどちらかで書く。
  - `useSyncExternalStore` の 3 つ目の引数に、サーバーで描くときの値を渡す。
  - `client:only` で置き、サーバーで描かない。
- マウントの後に Effect で `setState` を呼んで描き直す形を使わない。サーバーで描いた HTML と 1 度目の描画が食い違い、画面がちらつく。

## Shared Configuration

設定を package ごとに複製しない。  
設定の置き場と参照の仕方は次のとおり。

| 設定              | 置き場                                       | 参照の仕方                                     |
| ----------------- | -------------------------------------------- | ---------------------------------------------- |
| tsconfig          | `@fukuemon/config` の `./tsconfig/base.json` | 各 package が `extends` する                   |
| Astro の tsconfig | `apps/web/tsconfig.json`                     | `astro/tsconfigs/strict` を直接 `extends` する |
| lint と依存規約   | ルートの `oxlint.config.ts`                  | ルートからリポジトリ全体に 1 回掛ける          |
| 未使用の検出      | ルートの `package.json` の `knip`            | ルートから 1 回掛ける                          |
| format            | ルートの `.oxfmtrc.jsonc`                    | ルートからリポジトリ全体に 1 回掛ける          |
| vitest            | 各 package の `vitest.config.ts`             | 対象の列挙が package ごとに違うので共有しない  |

- `no-restricted-imports` の依存規約は、ルートの `oxlint.config.ts` だけに置く。package ごとに書くと、片方だけが更新される。
- 依存規約をチェックするために、独自の oxlint プラグインを作らない。
  - 層が増えて `no-restricted-imports` の列挙が読めなくなったら作る。
- package ごとに変わるコマンドは、その package の `package.json` の scripts に置く。ルートは `pnpm -r` で束ねるだけにする。
  - `apps/web` の build のコマンドは例外で、`vp run` でキャッシュするため `apps/web/vite.config.ts` に置く。取り決めは [tech-stack.md](tech-stack.md#vite-の取り決め) にある。
- ルートの script へ引数を渡すときに、`--` を挟まない。
  - pnpm は `--` を取り除かずにコマンドへ渡す。`pnpm run infra:init -- -input=false` は `Too many command line arguments` で失敗する。

### チェックの実行点

- `pnpm run check` が、品質のチェックをつなぐ。CI も `check` を実行する。
  - つなぐチェックと順序は、ルートの `package.json` の `check` にある。
  - `check` のうち `vp run` のキャッシュを使うのは build だけで、ほかのチェックは毎回実行する。
- lint、typecheck、test を pre-commit で実行しない。`pnpm run check` と CI が担う。
- pre-commit は、ステージしたファイルに Oxfmt を掛ける。
  - Oxfmt は `.astro` を扱わないので、`.astro` は整形されない。

### チェックのツールに合わせる書き方

- `.astro` の `<script>` は、1 ファイルに 1 つだけにする。
  - knip は最初の `<script>` しか読まず、2 つ目の import を追跡しない。
  - `type="application/json"` のようなデータの置き場を足すときは、module の `<script>` より後ろに書く。
- `oxlint.config.ts` の `overrides` の各 entry は、そのファイル群に要る禁止をすべて自分で持つ。
  - `overrides` は同じ規則名を後勝ちで上書きし、前の entry と合流しない。
  - entry を足したら、各方向について違反するファイルを 1 つ置き、`pnpm run lint` が失敗することを確認する。
- 配色のチェックは、対象のトークンが見つからないことを失敗として扱う。
  - `scripts/check-contrast.mjs` は、色に解決できないトークンと、CSS にない `--root` のブロックを失敗にする。

## Check Exclusions

除外を足すときは、理由をこの節に書く。  
設定ファイルのコメントだけに残さない。

- knip は、`terraform` と `similarity-ts` を未知のコマンドとして扱わない（`ignoreBinaries`）。pnpm の依存ではなく、pnpm の外で入れるコマンドであるため。
- knip は、ルートの `playwright` を未使用の依存として扱わない（`ignoreDependencies`）。トップの試作の録画のスクリプトが使い、試作は knip の対象の外にあるため。
- Oxfmt は、apm が配置するファイル（`.agents/`、`.claude/`、`.codex/`、`apm.lock.yaml`）を整形しない（`ignorePatterns`）。整形すると、次の `apm install` で差分が出るため。
- knip は、textlint の規則とプラグインのパッケージを未使用の依存として扱わない（`ignoreDependencies`）。`.textlintrc.json` が規則とプラグインの名前で読み込み、import されないため。
- 原稿の textlint は、ai-words-ja の `実測` と `走ら` を指摘しない（`allows`）。
  - どちらも、ハンズオンの手順の見出し（`見積もりと実測を並べる`、`VACUUM を走らせる`）にあり、手順の見出しは書き換えないと決めている。
  - `実測` は、`EXPLAIN ANALYZE` が返す実際の値を指す語として定着している。
  - `allows` は検出した語だけと照らし、前後の文脈で絞れないため、語の形で除外する。
- 文書の textlint は、ai-words-ja の `門` を指摘しない（`allows`）。
  - トップの庭へ入るところに建つ建物（腕木門）を指す語で、比喩ではない。
  - 承認した ADR-0026 の題と、PRD の性能の要求の行にあり、言い換えると承認した文が変わる。
  - 比喩として使う `門` も通るので、レビューで見る。
- `docs/design/prototypes/` の試作は、knip（`ignore`）と Oxfmt（`ignorePatterns`）の対象から外す。
  - 試作は、設計の判断の基準として写したまま残すソースで、サイトのコードから import されない。
  - 試作のビルドのスクリプトは、CSS を文字列の位置で切る。整形すると、エラーを出さずに違う HTML を書く。
- oxlint は、`docs/design/prototypes/` の下の `vendor/` を見ない（`ignorePatterns`）。試作の README の手順で作る three の束で、Git で追跡しないため。
- react-doctor は、`check` で基点のブランチとの差分だけを見る（`--scope changed`）。既存の指摘は残っているので、新しく増えた指摘だけを止める。
- Oxlint は、`packages/ui/.storybook/` の `react/rules-of-hooks` と `react/exhaustive-deps` を見ない。
  - decorator の中の `useEffect` は、`storybook/preview-api` の hook で、React の hook ではない。
  - decorator の名前は小文字で始まるので、`rules-of-hooks` は、コンポーネントの外で hook を呼んだと見なす。
- Oxlint の `react/no-array-index-key` を、次の 2 か所だけで、行ごとのコメントで抑制する。
  - `packages/ui/src/case/HttpExchangeDetail/HttpExchangeDetail.tsx` のヘッダの行。同じ名前のヘッダが並ぶことがあり、名前だけでは key が重なる。
  - `packages/ui/src/case/ToolPane/fixtures.tsx` のコードの行。同じ中身の行が並ぶことがあり、中身だけでは key が重なる。
  - どちらの一覧も、描いた後に並びが変わらない。
- Oxlint の `jsx-a11y` の規則の警告は、`packages/ui` に残っている。警告では `pnpm run lint` は失敗しない。

チェックが実行されなかったことを、通ったとして扱わない。

- 入れていないチェックも、この節から消さず、入れていないと書いて残す。
- 外部のバイナリに頼るチェックを足すときは、バイナリがないことを失敗として扱う。

react-doctor の規則を Design System と衝突して無効にしたら、次の表に足す。  
`react-doctor rules disable` は設定ファイルを書き換えるが、理由を残さないためである。

| 規則         | 理由 |
| ------------ | ---- |
| （まだない） |      |
