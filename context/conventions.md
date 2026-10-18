---
type: context
title: コードと文書の規約
description: コンポーネントの命名、コメントに書くこと、文書と記事の書き方のうちこのリポジトリだけの規則、共有の設定とチェックの実行点、自動チェックの除外。lint で検出できる規則は書かない
status: stable
governs:
  - package.json
  - lefthook.yml
  - .oxlintrc.json
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
このリポジトリで Why not を書くべき箇所の典型は次の 3 つ。

- `contentId` を Astro の `id` に載せない理由。Astro が `id` を占有し、`slug` を schema に置けない。
- 関係に `reference()` を使わない理由。collection をまたぎ、Content Model を Astro に依存させないため。
- `tokens.css` のトークンを `@theme static` に置き、素のカスタムプロパティとして出力する理由。Expressive Code が挿す CSS はこのリポジトリのビルドを通らないため。

Why not のコメントには、該当する ADR へのリンクを 1 行添える。

次のものは、コメントに書かない。

- コードを言い換えただけの行
- 型を繰り返すだけの doc コメント
- 変更の経緯と issue の番号。コミットと ADR が持つ。
- spec と issue の引用。spec は issue を閉じるときに消える作業文書で、リンクが宙に浮く。

理由を残すときのリンク先は、`adr/`、`context/`、feature の Design Doc に限る。

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

- 原稿の本文と、サイトの UI の文言は、`ですます` 調で書く。
  - 箇条書きと表のセルは、体言止めか終止形で書く。
  - リポジトリの文書（context、PRD、Design Doc、ADR など）は、`である` 調で書く。
- 原稿の textlint の設定は `apps/web/src/content/.textlintrc.json` に置く。
  - ルートの `.textlintrc.json` から、本文の文体を `ですます` 調に変え、`.mdx` を読むプラグインを足している。
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

書いた記事とハンズオンは、`pnpm --filter @fukuemon/web dev` で確かめる。

## Styling

層の順とトークンの層は [Design System の Design Doc](../packages/design-system/DesignDoc.md#配布と層) にある。

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

- `aria-current` の有無で当てるときは、`aria-[current]:` を使う。
  - 組み込みの `aria-current:` は `[aria-current="true"]` に当たり、手順の現在地の `aria-current="step"` には当たらない。
- `<dialog>` に `display` を当てるときは、`[open]` に限定する。
  - UA 既定の `dialog:not([open]) { display: none }` に勝ち、閉じている窓が画面に出る。

### 配色の切り替え

- 色は `light-dark(明, 暗)` で 1 度だけ書く。
- 選択子を明暗で分けて、同じ色の値を 2 度書かない。
  - システム設定用と明示指定用に同じ値を並べると、片方だけを直した誤りに、実行時まで気づけない。
  - `check-contrast.ts` は、`tokens.css` の `@theme static` の 1 箇所だけを読む。
- 色でないもの（`mix-blend-mode` など）を明暗で分けるときだけ、選択子を 2 本並べる。
  - `[data-theme="dark"]` と、`prefers-color-scheme: dark` の中の `:root:not([data-theme="light"])` の 2 本である。

## Shared Configuration

設定を package ごとに複製しない。  
設定の置き場と参照の仕方は次のとおり。

| 設定              | 置き場                                       | 参照の仕方                                     |
| ----------------- | -------------------------------------------- | ---------------------------------------------- |
| tsconfig          | `@fukuemon/config` の `./tsconfig/base.json` | 各 package が `extends` する                   |
| Astro の tsconfig | `apps/web/tsconfig.json`                     | `astro/tsconfigs/strict` を直接 `extends` する |
| lint と依存規約   | ルートの `.oxlintrc.json`                    | ルートからリポジトリ全体に 1 回掛ける          |
| 未使用の検出      | ルートの `package.json` の `knip`            | ルートから 1 回掛ける                          |
| format            | ルートの `.oxfmtrc.jsonc`                    | ルートからリポジトリ全体に 1 回掛ける          |
| vitest            | 各 package の `vitest.config.ts`             | 対象の列挙が package ごとに違うので共有しない  |

- `no-restricted-imports` の依存規約は、ルートの `.oxlintrc.json` だけに置く。package ごとに書くと、片方だけが更新される。
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
- 見た目の回帰のチェック（`shot` と `shot:diff`）は `check` に入れない。理由は [testing.md](testing.md#test-types-and-guarantees) にある。

### チェックのツールに合わせる書き方

- `.astro` の `<script>` は、1 ファイルに 1 つだけにする。
  - knip は最初の `<script>` しか読まず、2 つ目の import を追跡しない。
  - `type="application/json"` のようなデータの置き場を足すときは、module の `<script>` より後ろに書く。
- `.oxlintrc.json` の `overrides` の各 entry は、そのファイル群に要る禁止をすべて自分で持つ。
  - `overrides` は同じ規則名を後勝ちで上書きし、前の entry と合流しない。
  - entry を足したら、各方向について違反するファイルを 1 つ置き、`pnpm run lint` が失敗することを確かめる。
- 配色のチェックは、対象のトークンが見つからないことを失敗として扱う。
  - `packages/design-system/check-contrast.ts` は、存在しないトークンを `errors` に積む。

## Check Exclusions

除外を足すときは、理由をこの節に書く。  
設定ファイルのコメントだけに残さない。

- knip は、`/pagefind/pagefind.js` を解決できない import として扱わない（`ignoreUnresolved`）。Pagefind が `astro build` の後に `dist/` へ作るファイルで、ソースの時点では存在しないため。
- knip は、`terraform` と `similarity-ts` を未知のコマンドとして扱わない（`ignoreBinaries`）。pnpm の依存ではなく、pnpm の外で入れるコマンドであるため。
- knip は、`apps/web` の `pagefind` を未使用の依存として扱わない（`ignoreDependencies`）。knip は `vite.config.ts` の `run.tasks` のコマンドから knip が知るコマンドだけを読み、`pagefind` を読まないため。
- Oxfmt は、apm が配置するファイル（`.agents/`、`.claude/`、`.codex/`、`apm.lock.yaml`）を整形しない（`ignorePatterns`）。整形すると、次の `apm install` で差分が出るため。
- knip は、textlint の規則とプラグインのパッケージを未使用の依存として扱わない（`ignoreDependencies`）。`.textlintrc.json` が規則とプラグインの名前で読み込み、import されないため。
- 原稿の textlint は、ai-words-ja の `実測` と `走ら` を指摘しない（`allows`）。
  - どちらも、ハンズオンの手順の見出し（`見積もりと実測を並べる`、`VACUUM を走らせる`）にあり、手順の見出しは書き換えないと決めている。
  - `実測` は、`EXPLAIN ANALYZE` が返す実際の値を指す語として定着している。
  - `allows` は検出した語だけと照らし、前後の文脈で絞れないため、語の形で除外する。
- react-doctor は、`check` で基点のブランチとの差分だけを見る（`--scope changed`）。既存の指摘は残っているので、新しく増えた指摘だけを止める。

チェックが実行されなかったことを、通ったとして扱わない。

- 入れていないチェックも、この節から消さず、入れていないと書いて残す。
- 外部のバイナリに頼るチェックを足すときは、バイナリがないことを失敗として扱う。

react-doctor の規則を Design System と衝突して無効にしたら、次の表に足す。  
`react-doctor rules disable` は設定ファイルを書き換えるが、理由を残さないためである。

| 規則         | 理由 |
| ------------ | ---- |
| （まだない） |      |
