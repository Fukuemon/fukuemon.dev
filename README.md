# fukuemon.dev

技術記事とハンズオンを 1 つのサイトで公開する個人サイト。
ハンズオンは手順に区切られ、進捗が残り、ブラウザの中で実際にコードが動く。

https://fukuemon.dev

**読んで分かった気になる段階と、動かして分かる段階のあいだを埋めることを狙う。** 読者アカウントを持たず、サーバー側の永続状態も持たない。
誰のどの課題を解くか（Why / What）は [PRD.md](PRD.md) に、どう作るか（How）は [design/DesignDoc.md](design/DesignDoc.md) にある。

## 構成

pnpm workspace の monorepo。

| ディレクトリ             | 中身                                                                      |
| ------------------------ | ------------------------------------------------------------------------- |
| `apps/web`               | Astro のサイト本体。記事とハンズオンの描画                                |
| `apps/web/src/content`   | 記事 (`articles`)、ハンズオン (`labs`)、playground (`playgrounds`) の原稿 |
| `packages/content-model` | 記事とハンズオンの schema、関係グラフ、目次                               |
| `packages/design-system` | Design Tokens、版面、配色のコントラストのチェック                         |
| `packages/config`        | 共有 tsconfig                                                             |
| `infra/`                 | Cloudflare の基盤定義 (Terraform)                                         |
| `e2e/`                   | 見た目の回帰のチェック                                                    |

## 技術スタック

| 用途      | 採用                                     |
| --------- | ---------------------------------------- |
| framework | Astro                                    |
| CSS       | Tailwind CSS                             |
| island    | React (実行パネルとサイドバーだけに使う) |
| 実行環境  | PGlite (ブラウザ内の Postgres)           |
| 全文検索  | Pagefind (ビルド時に索引を作る)          |
| 配信      | Cloudflare Workers Static Assets         |
| 基盤      | Terraform + `cloudflare/cloudflare`      |

JavaScript 側のバージョンは各 `package.json` が持つ。  
Terraform 本体のバージョンは `.github/workflows/` が、provider のバージョンは `infra/*/.terraform.lock.hcl` が固定する。
ツールの役割は [context/tech-stack.md](context/tech-stack.md) に、採否の理由は [adr/](adr/) にある。

## 開発

mise と pnpm が要る。
Node.js は、`mise install` が `mise.toml` に書いたバージョンで入れる。
pnpm のバージョンは `package.json` の `packageManager` にある。
準備の手順の全体は [CONTRIBUTING.md](CONTRIBUTING.md) にある。

```sh
mise install
pnpm install
pnpm run dev
```

| コマンド               | 用途                                  |
| ---------------------- | ------------------------------------- |
| `pnpm run dev`         | 開発サーバー                          |
| `pnpm run build`       | ビルド (Astro + Pagefind の索引)      |
| `pnpm run check`       | 品質のチェック一式                    |
| `pnpm run infra:check` | Terraform の書式と構文 (要 Terraform) |

`check` が通すチェックと順序は、ルートの `package.json` の `check` にある。
`infra:check` は Terraform を必要とするため `pnpm run check` には含めない。
CI の Check workflow では別の step として先に回す。

図をビルド時に SVG へ変換するので、`build` には Playwright の Chromium が要る。

```sh
pnpm --filter @fukuemon/web exec playwright install chromium
```

## 配信

既定ブランチへ merge すると Check workflow が回り、**成功したときだけ** Deploy workflow が `wrangler deploy` を実行する。
push を直接の契機にすると、チェックの結果を待たずに配信されてしまうためである。

基盤リソースは Terraform の管轄である。
zone と custom domain は `workflow_dispatch` の手動起動と environment の承認を通す。
**state 用の R2 バケットだけは運用者が手元で 1 回だけ apply する。** state をローカルに置く前提を CI から壊さないためである。

**1 つのリソースを Terraform と Wrangler の両方から管理しない。**

- 管轄の分担と credential の置き場: [context/operations.md](context/operations.md)
- 基盤の構成と state backend: [infra/DesignDoc.md](infra/DesignDoc.md)
- apply の手順と実行順序: [infra/README.md](infra/README.md)
- 判断の理由: [ADR-0005](adr/0005-workers-terraform-wrangler-boundary.md)

## 文書

| 知りたいこと        | 読む場所                                                                       |
| ------------------- | ------------------------------------------------------------------------------ |
| Why / What          | [PRD.md](PRD.md)                                                               |
| 全体像              | [design/DesignDoc.md](design/DesignDoc.md)                                     |
| 機能ごとの設計      | 対象のコードの隣の `DesignDoc.md`。一覧は [context/index.md](context/index.md) |
| 技術規約 / 運用契約 | [context/](context/)                                                           |
| 判断とその代替案    | [adr/](adr/)                                                                   |

迷ったら Design Doc から読む。
内容が衝突したときは Design Doc を正とする。
