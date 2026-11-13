---
type: context
title: コードベースの構造
description: package とディレクトリの境界、依存規約 1〜5 と island の規約、状態の置き場、新しいコードと package の置き場、URL の規約。コードから読み取れる構造は書かない
status: stable
governs:
  - pnpm-workspace.yaml
  - apps/web/src/
  - apps/playground/src/
  - packages/
  - oxlint.config.ts
verified_commit: ab2da87
---

# コードベースの構造

全体の構成とモジュールの責務は [docs/design/DesignDoc.md](../docs/design/DesignDoc.md#components) にある。

## Module Boundaries

- 共有の設定は、tsconfig を `@fukuemon/config` に、Oxlint の設定をルートの `oxlint.config.ts` に、vitest の設定を各 package に置く。
- `infra/` は、どこからも import されないので、`packages/` に入れず、workspace の package にもしない。
- `apps/` には、1 つの Worker に deploy するアプリを 1 つずつ置く。
  サイトは `apps/web`、プレイグラウンドは `apps/playground` である。
- サイトのほかのアプリを、`apps/web` に置くか、別の app と Worker にするかは、ADR-0031 の規則で決める。
  - ADR-0031: [サブドメインに分ける規則](../docs/adr/0031-subdomains-and-workers.md)

`apps/web/src/` のディレクトリは、共有の度合いで分けず、そのディレクトリが答える問いで分ける。

- `pages/` は、この URL が何かに答える。画面が増えたら 1 ファイル増える。
- `layouts/` は、このページの外枠が何かに答える。セクションが増えたときだけ増える。
- `features/` は、このセクションが何をする所かに答える。セクションが増えたときだけ増える。
- `components/` は、セクションをまたぐ素のコンポーネントが何かに答える。ほとんど増えない。
- `data/` は、書いている人の情報がどこにあるかに答える。増えない。
- `lib/` は、このデータがどこから来るかに答える。ほとんど増えない。
- `styles/` は、サイト全体に掛かるスタイリングが何かに答える。

`features/` の中も、同じ軸で分ける。

- feature の中は、関心ごとのディレクトリで分ける。
- 実装の種類のディレクトリ（`components/`、`hooks/`、`utils/`、`types/`、`constants/`）を作らない。
  - 種類で分けると、1 つの関心ごとを直すときに、複数のディレクトリを行き来することになる。
- hook は、使うコンポーネントの隣か、同じ関心ごとのモジュールの隣に置く。
- feature の中のディレクトリに、ほかの feature と同じ名前を付けない。Oxlint は、`../<ほかの feature の名前>/` の形の import を、feature の間の参照として止める。
- feature とディレクトリごとの re-export のファイル（`index.ts`）を作らず、ファイルを直接 import する。
  - package のエントリーポイント（`packages/*/src/index.ts`）は残す。

## Dependency Rules

依存規約は 5 つある。  
規約 1 と規約 2 は、描画レイヤの差し替えとデータソースの移行を成り立たせる。  
規約 3 から規約 5 は、規約 1 と規約 2 を保つための境界である。  
ADR-0002: [Content Model の Astro からの独立](../docs/adr/0002-content-model-independence.md)

各規約の内容とチェックの手段は次のとおり。  
Oxlint のチェックは、ルートの `oxlint.config.ts` の `no-restricted-imports` に置く。  
entry を足すときの注意は [conventions.md](conventions.md#shared-configuration) にある。

- 規約 1: `apps/web/src/` の `pages/`、`features/`、`components/`、`layouts/` は、`astro:content` を直接 import しない。
  - コンテンツは、`apps/web/src/lib/content/` が export する関数を通して参照する。
  - チェックは Oxlint が行う。
- 規約 2: `@fukuemon/content-model` は Astro に依存しない。
  - `astro` と `astro:content` を、`dependencies` にも `devDependencies` にも入れない。
  - `astro:content` から取得したエントリは引数で受け取る。
  - チェックは、package の依存の宣言と knip が行う。
- 規約 3: island は Astro を import しない。
  - island は、`apps/web/src/{features,components}/**/*.{tsx,jsx}` を指す。
  - `astro`、`astro:content`、`.astro` のファイルのどれも参照しない。必要な値は props で受ける。
  - チェックは Oxlint が行う。拡張子で対象を指定し、`astro` と `astro:content` を `paths` で、`*.astro`、`astro:*`、`astro/**` を `patterns` で禁じる。
- 規約 4: `packages/` は `apps/` を参照しない。
  - チェックは Oxlint が行う。
- 規約 5: 層をまたぐ参照は 1 方向にする。
  - `pages/` は、`layouts/`、`features/`、`components/`、`lib/` を参照してよい。
  - `layouts/` は、`features/`、`components/`、`lib/` を参照してよい。
  - `features/` は、`components/`、`lib/`、同じ feature の中を参照してよい。
  - `components/` は、`lib/` を参照してよい。
  - `lib/` は、`packages/` だけを参照してよい。
  - チェックは Oxlint が行う。
  - feature どうしの参照は、エイリアス（`~/features/`）と相対のパスの両方を止める。
  - `lib/` から `pages/` と `layouts/` への参照は、Oxlint が止めない。
  - `oxlint.config.ts` は、`apps/web/src/features/` の下のディレクトリを読み、feature ごとの override を作る。feature を足したときに、設定を直さなくてよい。
  - `features/` が無い間は feature ごとの override を作らず、`apps/web/src/` が無いときは設定の読み込みを失敗させる。

規約 5 を守るため、次のように書く。

- `lib/` が `features/` のものを使うときは、引数で受け取る。
  - パスを文字列で持つと、ディレクトリを動かしたときに typecheck も lint も追従しない。
- feature どうしは直接参照しない。2 つ以上の feature が使うコンポーネントは `components/` へ移す。

package が依存してよい先は次のとおり。

- `@fukuemon/config` は、どこにも依存しない。
- `@fukuemon/content-model` は、`zod` だけに依存する。
- `@fukuemon/ui` は、workspace のどの package にも依存しない。
- `@fukuemon/playground-project` は、workspace のどの package にも依存しない。
- `apps/web` は、`@fukuemon/ui`、`@fukuemon/content-model`、`@fukuemon/playground-project` に依存してよい。
  - tsconfig は、`@fukuemon/config` ではなく `astro/tsconfigs/strict` を `extends` する。
- `@fukuemon/sql-runtime` と `@fukuemon/go-runtime` は、workspace のどの package にも依存しない。
- `@fukuemon/node-runtime` は、workspace の package では、`@fukuemon/sql-runtime` だけに依存する。`@webcontainer/api` に依存するのは、この package だけである。
- `@fukuemon/sql-runtime`、`@fukuemon/node-runtime`、`@fukuemon/go-runtime` は、React に依存しない。
- `apps/playground` は、`@fukuemon/ui`、`@fukuemon/playground-project` と、実行環境の 3 つの package に依存する。`apps/web` と、`@fukuemon/content-model` には依存しない。`@webcontainer/api` には、直接は依存しない。
  - `apps/playground/src/` のディレクトリと、その間の import の向きは、[プレイグラウンドの Design Doc](../apps/playground/DesignDoc.md#ディレクトリ) にある。
- `infra/` は、どこにも依存しない。

island の framework は React の 1 つに絞る。  
hydrate するページはその framework のランタイムを配るので、2 つの framework を同じページに混ぜると両方を配ることになる。

## State Ownership

- 実行時のサーバーの処理を持たず、すべてをビルド時に解決する。
  - Worker はハンドラを持たず、静的アセットの配信だけを行う。
  - ADR-0005: [Workers と Terraform と Wrangler の分担](../docs/adr/0005-workers-terraform-wrangler-boundary.md)
- サーバー側の永続的な状態を持たない。読者の identity を前提にする機能を作らない。
  - ADR-0008: [読者の identity を持たない](../docs/adr/0008-no-reader-identity.md)
- クライアント側の状態は、訪問者のブラウザにだけ置く。
- プレイグラウンド（`play.fukuemon.dev`）は、訪問者のファイルを IndexedDB に置く。キーと値の形は、[プレイグラウンドの Design Doc](../apps/playground/DesignDoc.md#保存) にある。
- トップ（`/`）は、端末でトップを開いたことを、`localStorage` の `fd-top-seen` に記録する。
  - `fd-top-seen` を読み書きするのは、`head` の inline script だけにする。立体の庭の場面のコードは、`html` の class `intro` を読む。
  - `fd-top-seen` の意味と、`head` の inline script が `html` に書く属性と class は、[トップの水墨の門と立体の庭の Design Doc](../docs/design/features/top-garden/DesignDoc.md#ページが持つ状態) にある。
- 訪問済みの表示は、CSS の `:visited` に任せる。
- 一覧の分類の絞り込みは URL パラメータで表す。
  - 設計不変量 8: [docs/design/DesignDoc.md](../docs/design/DesignDoc.md#設計不変量)

## Placement Rules

### apps/web

- island は、静的な HTML で表現できないものにだけ使う。island を足すときは、静的では実現できないことを根拠にする。
- island のデータの取得は、`pages/` か `layouts/` が行う。island は素の props だけを受ける。
- `.astro` から island に渡す props は、文字列、数値、配列、素のオブジェクトにする。
  - 関数と React の要素を渡さない。Astro は、関数と React の要素を island へ渡すときに直列化できない。
  - 静的な中身は `children` で渡す。
- island のテストは、island の隣に置く。
- `.astro` と `.tsx` は、技術で分けずに同じディレクトリに置く。
  - どちらが JavaScript を配るかは、拡張子と `client:*` で分かる。
- `components/` には、セクションをまたぐ素のコンポーネントだけを置く。
  - 1 つの feature でしか使わなくなったコンポーネントは、その feature へ移す。
- `components/` は、最初から分類しない。フラットに並べて目で追えなくなったら分ける。
- 1 つの feature の中で複数の島がまたぐモジュールは、その feature の直下に置く。

### packages

package を切り出すのは、次のどちらかが成り立つときである。

- 2 つ以上の消費者が実在する。
- 消費する側と別の理由で変わる。

消費者が 1 つでも、自分のバージョン、自分のテスト、自分の理由で変わるものは package にする。  
消費者が 1 つで、変わる理由も消費する側と同じなら、切り出さない。

### packages/ui

`packages/ui` は、サイトの画面が使うデザインシステムである。

- デザインシステムの文書は、`packages/ui/DESIGN.md` と、`packages/ui/design/` の `tokens.md`、`components.md`、`catalog.md` の 4 つに置く。
- トークンの 3 つの層は、`packages/ui/src/tokens/` の `primitive.css`、`semantic.css` と `semantic-dark.css`、`theme.css` に置く。
- 使う側の Tailwind CSS に、コンポーネントのクラスを走査させる `@source` は、`packages/ui/src/sources.css` に置く。
- コンポーネントは、Base を `packages/ui/src/base/<名前>/` に、Case を `packages/ui/src/case/<名前>/` に、パターンを `packages/ui/src/patterns/` に置く。
  - story とテストは、コンポーネントと同じディレクトリに置く。
  - Domain のコンポーネントは `packages/ui` に置かず、`apps/web/src/features/<機能>/` の関心ごとのディレクトリに置く。
  - `apps/playground` の Domain のコンポーネントは、`apps/playground/src/` の、関心ごとのディレクトリに置く。
- カタログの Worker の設定は `packages/ui/wrangler.jsonc` に、カタログが返すレスポンスヘッダは `packages/ui/.storybook/public/_headers` に置く。

### apps/playground

- ツールのページ（`apps/playground/src/` の `node/`、`sql/`、`go/`）どうしは import しない。
  2 つ以上のツールが使うものは、関心ごとのディレクトリに置く。
  - チェックは Oxlint が行う。
    `oxlint.config.ts` と `apps/playground/vite.config.ts` は、`apps/playground/` の下の `index.html` を持つディレクトリを、ツールとして読む。
  - ツールのページの中のディレクトリに、ほかのツールと同じ名前を付けない。
    Oxlint は、`../<ほかのツールの名前>/` の形の import を、ツールの間の参照として止める。
- `@webcontainer/api` の import は、`packages/node-runtime/src/webcontainer/` の外では Oxlint が止める。

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

URL の一覧は [docs/design/DesignDoc.md](../docs/design/DesignDoc.md#url-の構成) にある。  
ADR-0030: [種別、形式、シリーズ](../docs/adr/0030-articles-format-and-series.md)

- `/docs/` の配下に入れない。描画の実装の詳細を URL に出さない。
- 古いサイトの URL（`/blog`、`/labs/<path>` など）は転送しない。`apps/web/public/_redirects` を置かない。
  - `play.fukuemon.dev` の `/` のリダイレクトは、[operations.md](operations.md#レスポンスヘッダ) にある。
- `/playground` は、プレイグラウンドの一覧に使う。ツールは `fukuemon.dev` に置かず、`play.fukuemon.dev` に置く。cross-origin isolation のヘッダは、Node の実行環境のパスと、それを埋め込む記事の URL にだけ返す。
  - ADR-0031: [サブドメインに分ける規則](../docs/adr/0031-subdomains-and-workers.md)
  - ADR-0034: [プレイグラウンドのサブドメインと、ヘッダを返すパス](../docs/adr/0034-playground-origin-and-embedding.md)
- `/playground-projects/*` は、記事に埋め込む実行環境のプロジェクトの JSON に使う。
