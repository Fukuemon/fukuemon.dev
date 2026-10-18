---
type: context
title: コードベースの構造
description: package とディレクトリの境界、依存規約 1〜5 と island の規約、状態の置き場、新しいコードと package の置き場、URL の規約。コードから読み取れる構造は書かない
status: stable
governs:
  - pnpm-workspace.yaml
  - apps/web/src/
  - packages/
  - .oxlintrc.json
verified_commit: c02cc95
---

# コードベースの構造

全体の構成とモジュールの責務は [design/DesignDoc.md](../design/DesignDoc.md#components) にある。

## Module Boundaries

package の責務は次のとおり。

- `@fukuemon/config` は、tsconfig の共有の設定を持つ。oxlint の設定はルートが、vitest の設定は各 package が持つ。
- `@fukuemon/content-model` は、Content Model の zod の schema、`ContentRef` と手順の型、関係グラフの構築と検証、本文の目次の組み立てを持つ。
- `@fukuemon/design-system` は、Design Tokens（Tailwind CSS の `@theme static`）、版面のユーティリティ、挿絵、コードの配色、配色のコントラストのチェックを持つ。
- `apps/web` は、Astro のアプリで、全画面を描画する。
- `infra/` は、Terraform のコードを持つ。どこからも import されないので、`packages/` に入れず、workspace の package にもしない。

記事とハンズオンは 1 つの app に置き、Portfolio を別の app に切り出さない。  
切り出すのは、次のどちらかが起きたときである。

- 別のドメインで公開する必要が生じた。
- Portfolio と Content の deploy の頻度が分かれ、互いに待たされるようになった。

`apps/web/src/` のディレクトリは、共有の度合いで分けず、そのディレクトリが答える問いで分ける。

- `pages/` は、この URL が何かに答える。画面が増えたら 1 ファイル増える。
- `layouts/` は、このページの外枠が何かに答える。セクションが増えたときだけ増える。
- `features/` は、このセクションが何をする所かに答える。セクションが増えたときだけ増える。
- `components/` は、セクションをまたぐ素のコンポーネントが何かに答える。ほとんど増えない。
- `data/` は、書いている人の情報がどこにあるかに答える。増えない。
- `lib/` は、このデータがどこから来るかに答える。ほとんど増えない。
- `styles/` は、サイト全体に掛かるスタイリングが何かに答える。

`features/` の中も、同じ軸で分ける。

- `lab/` は、ハンズオンと playground の実行まわりを持つ。
- `listing/` は、一覧の行、表、タブ、関連を持つ。
- `doc/` は、本文のサイドバーの目次とほかの記事を持つ。
- `about/` は、トップの表紙を持つ。
- `search/` は、本文の検索を持つ。

`features/lab/` は、さらに次の 6 つの問いで分ける。

- `runtime/` は、どこで動くかに答える。
- `editor/` は、どう書くかに答える。
- `panel/` は、どう実行するかに答える。
- `catalog/` は、いま何が入っているかに答える。
- `steps/` は、どこまで進んだかに答える。
- `local/` は、手元でどう組むかに答える。

layout は、記事とハンズオンで分ける。  
サイドバーの中身（目次か手順か）と、本文の出し方（通しか 1 画面 1 手順か）が違うためである。  
版面は共通の class `.g-doc` で、サイドバーは共通のコンポーネント `components/Side.astro` で揃える。

次の変更は、それぞれの場所の中で閉じるように保つ。

- 本文の描画レイヤを差し替えるときは、`layouts/` の `ArticleLayout.astro` と `LabLayout.astro` を直す。
- データソースを Markdown から別のものへ移すときは、`content.config.ts` の loader を直す。
- Astro のメジャーバージョンを上げるときは、`lib/content/` のアダプタを直す。

## Dependency Rules

依存規約は 5 つある。  
規約 1 と規約 2 は、描画レイヤの差し替えとデータソースの移行を成り立たせる。  
規約 3 から規約 5 は、規約 1 と規約 2 を保つための境界である。  
ADR-0002: [Content Model の Astro からの独立](../adr/0002-content-model-independence.md)

各規約の内容とチェックの手段は次のとおり。  
Oxlint のチェックは、ルートの `.oxlintrc.json` の `no-restricted-imports` に置く。  
entry を足すときの注意は [conventions.md](conventions.md#shared-configuration) にある。

- 規約 1: `apps/web/src/` の `pages/`、`features/`、`components/`、`layouts/` は、`astro:content` を直接 import しない。
  - コンテンツは、`apps/web/src/lib/content/index.ts` が export する関数を通して参照する。
  - チェックは Oxlint が行う。
- 規約 2: `@fukuemon/content-model` は Astro に依存しない。
  - `astro` と `astro:content` を、`dependencies` にも `devDependencies` にも入れない。
  - `astro:content` から取得したエントリは引数で受け取る。
  - チェックは、package の依存の宣言と knip が行う。
- 規約 3: island は Astro を import しない。
  - island は、`apps/web/src/{features,components}/**/*.{tsx,jsx,vue}` を指す。
  - `astro`、`astro:content`、`.astro` のファイルのどれも参照しない。必要な値は props で受ける。
  - チェックは Oxlint が行う。拡張子で対象を指定し、`astro:content` を `paths` で、`*.astro` を `patterns` で禁じる。
- 規約 4: `packages/` は `apps/` を参照しない。
  - チェックは Oxlint が行う。
- 規約 5: 層をまたぐ参照は 1 方向にする。
  - `pages/` は、`layouts/`、`features/`、`components/`、`lib/` を参照してよい。
  - `layouts/` は、`features/`、`components/`、`lib/` を参照してよい。
  - `features/` は、`components/`、`lib/`、同じ feature の中を参照してよい。
  - `components/` は、`lib/` を参照してよい。
  - `lib/` は、`packages/` だけを参照してよい。
  - チェックは Oxlint が行う。`lib/` から `pages/` と `layouts/` への参照と、feature どうしの参照は、Oxlint が止めない。

規約 5 を守るため、次のように書く。

- `lib/` が `features/` のものを使うときは、引数で受け取る。
  - 例: 実行パネルの登録表 `features/lab/runners.ts` を、`remark-lab` へ引数で渡している。
  - パスを文字列で持つと、ディレクトリを動かしたときに typecheck も lint も追従しない。
- feature どうしは直接参照しない。2 つ以上の feature が使うコンポーネントは `components/` へ移す。

package が依存してよい先は次のとおり。

- `@fukuemon/config` は、どこにも依存しない。
- `@fukuemon/content-model` は、`zod` だけに依存する。
- `@fukuemon/design-system` は、どこにも依存しない。
- `apps/web` は、`@fukuemon/content-model` と `@fukuemon/design-system` に依存する。
  - tsconfig は、`@fukuemon/config` ではなく `astro/tsconfigs/strict` を `extends` する。
- `infra/` は、どこにも依存しない。

island の framework は 1 つに絞る。  
hydrate するページはその framework のランタイムを配るので、React と Vue を同じページに混ぜると両方を配ることになる。

Expressive Code が挿す CSS は、このリポジトリのビルドを通らない。  
Expressive Code と共有できるのは、素の CSS のカスタムプロパティだけである。  
Expressive Code の規則は cascade layer に属さないので、上書きする規則は layer の外に置く。

## State Ownership

- 実行時のサーバーの処理を持たず、すべてをビルド時に解決する。
  - Worker はハンドラを持たず、静的アセットの配信だけを行う。
  - ADR-0005: [Workers と Terraform と Wrangler の分担](../adr/0005-workers-terraform-wrangler-boundary.md)
- サーバー側の永続的な状態を持たない。読者の identity を前提にする機能を作らない。
  - ADR-0008: [読者の identity を持たない](../adr/0008-no-reader-identity.md)
- クライアント側の状態は `localStorage` に置き、ハンズオンの進捗とサイドバーの開閉だけを持つ。
  - 進捗のキーは `lab:<contentId>` にし、値に完了した手順の index の一覧と最後に開いた手順を持つ。
  - サイドバーの開閉のキーは、`components/Side.astro` の props の `id` から `side:<id>` にする。
- 訪問済みの表示は、CSS の `:visited` に任せる。
- 一覧の種別の切り替えは URL（ページ）で、分類の絞り込みは URL パラメータで表す。
  - 設計不変量 8: [design/DesignDoc.md](../design/DesignDoc.md#設計不変量)

## Placement Rules

### apps/web

- island は、静的な HTML で表現できないものにだけ使う。island を足すときは、静的では実現できないことを根拠にする。
- island のデータの取得は、`pages/` か `layouts/` が行う。island は素の props だけを受ける。
- island のテストは、island の隣に置く。
- `.astro` と `.tsx` は、技術で分けずに同じディレクトリに置く。
  - どちらが JavaScript を配るかは、拡張子と `client:*` で分かる。
- `components/` には、セクションをまたぐ素のコンポーネントだけを置く。
  - 1 つの feature でしか使わなくなったコンポーネントは、その feature へ移す。
- `components/` は、最初から分類しない。フラットに並べて目で追えなくなったら分ける。
- 1 つの feature の中で複数の島がまたぐモジュールは、その feature の直下に置く。
  - 例: `features/lab/bus.ts`

### packages

package を切り出すのは、次のどちらかが成り立つときである。

- 2 つ以上の消費者が実在する。
- 消費する側と別の理由で変わる。

消費者が 1 つでも、自分のバージョン、自分のテスト、自分の理由で変わるものは package にする。  
消費者が 1 つで、変わる理由も消費する側と同じなら、切り出さない。  
`ContentTable`、`KindTabs`、ハンズオンの `StepList` がこれに当たる。

`tokens.css` と `code-theme.ts` は、Expressive Code の `styleOverrides` からも参照するので、`packages/design-system` に置く。

### infra

- `.tf` のファイル名は、`provider.tf`、`<対象>.tf`、`vars.tf` の 3 種に揃える。
  - 出典: [Cloudflare Terraform Best Practices](https://developers.cloudflare.com/terraform/advanced-topics/best-practices/)
- DNS レコードの `.tf` を置かない。
  - `cloudflare_workers_custom_domain` が apex のレコードを管理するので、手書きのレコードと衝突する。
  - custom domain が管理しないレコード（MX、TXT など）が要るまで、`dns.tf` を作らない。
- `modules/` は、同じ形が 2 箇所以上に実在するまで作らない。
- 環境をディレクトリで分けない。環境の方針は [operations.md](operations.md#environments) にある。
- `infra/` の Terraform は、ルートの script（`pnpm infra:plan` など）から実行する。

### URL

サイトのセクションは about、blog、playground の 3 つである。  
ADR-0009: [サイトのセクションと playground](../adr/0009-site-sections-and-playground-collection.md)  
URL の一覧は [design/DesignDoc.md](../design/DesignDoc.md#url-の構成) にある。

- `/docs/` の配下に入れない。描画の実装の詳細を URL に出さない。
- `src/content/` の配置と URL を一致させない。ルーティングは `pages/` の動的なルートが担う。
- 一覧の名前（`/blog`）と本文の置き場（`/articles` と `/labs`）を揃えない。
  - 揃えると、`/blog/articles` が一覧と本文の両方を指す。
- コンテンツの `path` に `api` と `playground` を使わない。
- `/api/*` は予約し、[PRD の Lower-Priority Goals](../PRD.md#lower-priority-goals) の条件が成り立つまで使わない。
- `/playground/<id>` は、cross-origin isolation を掛ける URL として予約する。
  - ADR-0006: [手を動かす場所の 4 分類](../adr/0006-interactive-content-levels.md)
