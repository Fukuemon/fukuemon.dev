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

### 記事の本文

記事の本文は `apps/web/src/content/articles/` に置く。  
コンテンツの用語と、frontmatter の項目が守る条件は [domain.md](domain.md) と [domain/content.md](domain/content.md) にある。  
1 本を足すときに触るファイルは、Markdown の 1 枚だけにする。新しいシリーズを作るときだけ、`index.md` を足す。実行環境を埋め込むときだけ、プロジェクトのディレクトリを足す。

- 原稿の本文は、`である` 調で書く。frontmatter の `description` も同じである。
  - 箇条書きと表のセルは、体言止めか終止形で書く。
  - 手順の指示は「〜する」「〜を確認する」と書き、「〜してください」と書かない。
  - リポジトリの文書（context、PRD、Design Doc、ADR など）も、`である` 調で書く。
- サイトの UI の文言（ボタン、状態の表示、空の状態の案内）は、`ですます` 調で書く。
- シリーズに入れる記事は `articles/<series>/` に置き、シリーズに入れない記事は `articles/` の直下に置く。ディレクトリは 1 階層までにする。
- シリーズの中の記事は frontmatter の `order` を書き、シリーズに入れない記事は `order` を書かない。
- frontmatter に `format` を書くときは、`page` だけを書く。
- 実行環境は、言語を `playground` にしたコードフェンスに、埋め込みの名前を 1 行で書いて埋め込む。

  ````md
  ```playground
  node-server
  ```
  ````

  - プロジェクトは、記事の Markdown があるディレクトリの `playground/<埋め込みの名前>/` に置く。`playground.json` と初期ファイルを置く。形は、[プレイグラウンドの Design Doc](../apps/playground/DesignDoc.md#プロジェクト) にある。
  - 埋め込みの名前は、英小文字、数字、ハイフンで書き、1 本の記事の中で重ねない。
  - Node の実行環境を埋め込む記事には、別の origin の画像と埋め込み（`img`、`iframe`、`video` など）と、SQL と Go のツールを置かない。置くと、ビルドが失敗する。記事に返す `COEP: require-corp` が、それらを止めるためである。
  - ADR-0034: [記事への埋め込み](../docs/adr/0034-playground-origin-and-embedding.md#3-記事への埋め込み)

- 図は `mermaid` のコードフェンスで書き、色を指定しない。
  - `style` や `classDef` で色を書くと、暗い地で読めなくなる。
  - 図は、ビルドのときに Pele で SVG になる。Pele が対応しない記法を書くと、ビルドが失敗する。
  - 図の中の画像（`img`）は描かない。外部の画像を描くと、読者のブラウザが第三者のホストへ取りに行くためである。図の中のリンク（`click`）は描く。
  - ADR-0016: [mermaid を Pele で描く](../docs/adr/0016-render-mermaid-with-pele.md)
- コードは、言語の名前を付けたコードフェンスで書く。ファイルの名前を出すときは、フェンスに `title="<ファイルの名前>"` を書く。
- 段落は、1 文を 1 行に書く。
  - 行の終わりが和文の約物（`。` や `、` など）のときと、改行の前後がどちらも和文の字のときは、ビルドのときに `apps/web/src/lib/rehype-ja-linebreak.ts` が改行を消す。
  - 約物で終わらない行の、和文と欧文の間の改行は、空白として残る。

書いた記事は、`pnpm --filter @fukuemon/web dev` で確認する。

## Styling

`packages/ui` のコンポーネントと、`packages/ui` で組む画面は、[packages/ui/DESIGN.md](../packages/ui/DESIGN.md) と、そこから指す 3 つの文書の規則に従う。  
このセクションには、`apps/web` のスタイリングの規則のうち、`packages/ui` の文書に無いものを書く。

トークンの層は [デザインシステム（packages/ui）の Design Doc の「トークンの層」](../packages/ui/DesignDoc.md#トークンの層) に、層の順は [ADR-0055](../docs/adr/0055-tailwind-preflight-and-theme-from-ui.md#1-preflight-を読む) にある。

### サイトの共通の CSS

- サイトの共通の CSS は `apps/web/src/styles/site.css` に置き、`layouts/SiteLayout.astro` が読み込む。
- `site.css` は、`@import "tailwindcss"` で preflight を読み、`@fukuemon/ui` の `fonts.css`、`theme.css`、`sources.css` を読む。読み込みの並びは、`sources.css` のほかは、カタログの `preview.css` と同じ形にする。
  - ADR-0055: [サイトの共通の CSS で Tailwind CSS の preflight を読み、トークンを packages/ui のテーマ変数から使う](../docs/adr/0055-tailwind-preflight-and-theme-from-ui.md)
- 記事の本文の要素のスタイリングは、`site.css` の `.prose` に置く。Markdown から出る要素には class が付かないので、要素のセレクタで指定する。
- 本文の表と図は、`apps/web/src/lib/rehype-scroll-box.ts` が、横に送れるフォーカスできる枠で包む。縮めて本文の幅に収めると、表の列が潰れ、図の文字が 14px より小さくなるためである。
  - Markdown の表には `caption` を書けないので、記事の表は、`packages/ui` の `Table` と違い、題を持たない。
  - 枠には、右に続きがある間だけ右端を背景の色で薄くする、`packages/ui` のユーティリティ `scroll-fade-end` を付ける。動きは `site.css` に書かず、`packages/ui` の `theme.css` に置く（`MOTION-TOKEN`）。
- `site.css` は、Pele の CSS 変数（`--pele-fg` など）にトークンを割り当てて、Pele が描いた図の色を決める。
  - ADR-0016: [mermaid を Pele で描く](../docs/adr/0016-render-mermaid-with-pele.md)
- `@theme static` を書かない。トークンの値は、`packages/ui` の `primitive.css` と `semantic.css` が、`:root` のカスタムプロパティとして出力する。
- `packages/ui` のコンポーネントのクラスは、`@fukuemon/ui/sources.css` の `@source` が、Tailwind CSS の走査の対象に足す。Tailwind CSS は `node_modules` の下を走査しないためである。story、文書、テストは対象から外す。
- 本文へのスキップリンクは、`SiteLayout.astro` の `<body>` の最初に置き、`<main id="main">` を指す。
  - フォーカスしたときだけ左上に出し、重なる面（`bg-surface-raised` と `border-border-field`）、`text-label`、`focus-visible:focus-ring` で描く。押せる範囲は 44×44 CSS px 以上にする。
- 検索エンジンに載せないページ（404 など）は、`SiteLayout.astro` に `noindex` を渡す。canonical を出さず、`<meta name="robots" content="noindex">` を出す。
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
このセクションには、lint で止まらない書き方を書く。

- props が変わったときに state を初期の値に戻すのは、`key` で行う。Effect の中で `setState` を呼んで戻さない。
- 利用者の操作で起きる処理は、イベントハンドラに書く。Effect に書かない。
- 外部の store を購読するときは、`useSyncExternalStore` で書く。
- Effect の中で、最新の props を読むだけの処理は、`useEffectEvent` に分ける。依存の配列に入れると Effect が再実行されるので、入れない。
- 端末の値（`localStorage`、端末の日付、画面の幅）で描く island は、次のどちらかで書く。
  - `useSyncExternalStore` の 3 つ目の引数に、サーバーで描くときの値を渡す。
  - `client:only` で置き、サーバーで描かない。
- マウントの後に Effect で `setState` を呼んで描き直す形を使わない。1 度目の描画の後に端末の値で描き直すので、画面がちらつく。

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

- knip は、`terraform`、`similarity-ts`、`go` を未知のコマンドとして扱わない（`ignoreBinaries`）。pnpm の依存ではなく、pnpm の外で入れるコマンドであるため。
- knip は、ルートの `playwright` を未使用の依存として扱わない（`ignoreDependencies`）。トップの試作の録画のスクリプトが使い、試作は knip の対象の外にあるため。
- Oxfmt は、apm が配置するファイル（`.agents/`、`.claude/`、`.codex/`、`apm.lock.yaml`）を整形しない（`ignorePatterns`）。整形すると、次の `apm install` で差分が出るため。
- knip は、textlint の規則のパッケージを未使用の依存として扱わない（`ignoreDependencies`）。`.textlintrc.json` が規則の名前で読み込み、import されないため。
- `packages/e2e` の tsconfig は、`noUncheckedIndexedAccess` を外す。スキルの写しの `caption.ts` が、添字で読んだ値をそのまま使うため。
- knip は、記事に埋め込む実行環境の初期ファイル（`apps/web/src/content/articles/**/playground/**`）を見ない（`ignore`）。訪問者の実行環境で動くファイルで、サイトのコードから import されないため。
- 文書の textlint は、ai-words-ja の `門` を指摘しない（`allows`）。
  - トップの庭へ入るところに建つ建物（腕木門）を指す語で、比喩ではない。
  - 承認した ADR-0026 の題と、PRD の性能の要求の行にあり、言い換えると承認した文が変わる。
  - 比喩として使う `門` も通るので、レビューで見る。
- `docs/design/prototypes/` の試作は、knip（`ignore`）と Oxfmt（`ignorePatterns`）の対象から外す。
  - 試作は、設計の判断の基準として写したまま残すソースで、サイトのコードから import されない。
  - 試作のビルドのスクリプトは、CSS を文字列の位置で切る。整形すると、エラーを出さずに違う HTML を書く。
- oxlint は、`docs/design/prototypes/` の下の `vendor/` を見ない（`ignorePatterns`）。試作の README の手順で作る three のバンドルで、Git で追跡しないため。
- react-doctor は、`check` で基点のブランチとの差分だけを見る（`--scope changed`）。既存の指摘は残っているので、新しく増えた指摘だけを止める。
- Oxlint は、`packages/ui/.storybook/` の `react/rules-of-hooks` と `react/exhaustive-deps` を見ない。
  - decorator の中の `useEffect` は、`storybook/preview-api` の hook で、React の hook ではない。
  - decorator の名前は小文字で始まるので、`rules-of-hooks` は、コンポーネントの外で hook を呼んだと見なす。
- Oxlint の `react/no-array-index-key` を、次の 3 か所だけで、行ごとのコメントで抑制する。
  - `packages/ui/src/case/HttpExchangeDetail/HttpExchangeDetail.tsx` のヘッダの行。同じ名前のヘッダが並ぶことがあり、名前だけでは key が重なる。
  - `packages/ui/src/case/ToolPane/fixtures.tsx` のコードの行。同じ中身の行が並ぶことがあり、中身だけでは key が重なる。
  - `packages/ui/src/case/ConsoleEntryList/ConsoleEntryList.tsx` の 1 行の値の並び。`console.*` に同じ値の引数を渡すことがあり、値だけでは key が重なる。
  - どの一覧も、描いた後に並びが変わらない。
- Oxlint の `jsx-a11y` の規則の警告は、`packages/ui` に残っている。警告では `pnpm run lint` は失敗しない。
- 色の値のチェック（`check:raw-values`）は、`apps/web/src/features/top-garden/scene/scene-colors.ts` とそのテストを対象から外す（`EXCLUDES`）。
  - トップの庭の場面の色は、トークンの対象の外である（`packages/ui/DesignDoc.md` の Scope）。
  - テストは、色を混ぜる式を、色の値で確認する。
- 色の値のチェックは、トップの庭の場面のコードの、three の `new Color(` の 3 行を対象から外す（行ごとの `design-system-allow`）。
  - 色の関数 `color(` と同じ形に見えるが、three のクラスのコンストラクタで、色の値を書いていない。
- Oxlint の `import/default` は、`?worker&url` の import の 1 行だけで抑制する。
  - 対象は `apps/web/src/features/top-garden/stage/TopStageScript.astro` である。
  - Vite がビルドのときに URL の文字列を default で返すが、Oxlint はこの接尾辞を解決できない。

チェックが実行されなかったことを、通ったとして扱わない。

- 入れていないチェックも、この節から消さず、入れていないと書いて残す。
- 外部のバイナリに頼るチェックを足すときは、バイナリがないことを失敗として扱う。

react-doctor の規則を Design System と衝突して無効にしたら、次の表に足す。  
`react-doctor rules disable` は設定ファイルを書き換えるが、理由を残さないためである。

| 規則         | 理由 |
| ------------ | ---- |
| （まだない） |      |
