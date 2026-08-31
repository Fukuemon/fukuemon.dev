# fukuemon.dev

技術記事とハンズオンを 1 つのサイトで公開する個人サイト。
ハンズオンは手順に区切られ、進捗が残り、ブラウザの中で実際にコードが動く。

https://fukuemon.dev

## 何を解くか

**読んで分かった気になる段階と、動かして分かる段階のあいだを、同じサイトの中で埋める。** 記事とハンズオンは相互に参照し、片方から他方へ渡れる。

読者アカウントを持たず、サーバー側の永続状態も持たない。
判断の全体像は [design/DesignDoc.md](design/DesignDoc.md) が正本である。

## 構成

pnpm workspace の monorepo。

| ディレクトリ               | 中身                                             |
| -------------------------- | ------------------------------------------------ |
| `apps/web`                 | Astro のサイト本体。記事とハンズオンの描画       |
| `apps/web/src/content`     | 記事 (`articles`)、ハンズオン (`labs`)、playground の原稿 |
| `packages/content-model`   | 記事とハンズオンの schema、関係グラフ、目次      |
| `packages/design-system`   | Design Tokens、版面、配色のコントラスト検査      |
| `packages/config`          | 共有 tsconfig                                    |
| `infra/`                   | Cloudflare の基盤定義 (Terraform)                |
| `e2e/`                     | 見た目の回帰検査                                 |

## 技術スタック

| 用途          | 採用                                     |
| ------------- | ---------------------------------------- |
| framework     | Astro                                    |
| CSS           | Tailwind CSS                             |
| island        | React (実行パネルとサイドバーだけに使う) |
| 実行環境      | PGlite (ブラウザ内の Postgres)           |
| 全文検索      | Pagefind (ビルド時に索引を作る)          |
| 配信          | Cloudflare Workers Static Assets         |
| 基盤          | Terraform + `cloudflare/cloudflare`      |

**版の正本は各 `package.json` である。** 採否の理由と一覧は [context/toolchain.md](context/toolchain.md) にある。

## 開発

Node.js 22.12 以上と pnpm 10 が要る。

```sh
pnpm install
pnpm run dev
```

| コマンド                | 用途                                 |
| ----------------------- | ------------------------------------ |
| `pnpm run dev`          | 開発サーバー                         |
| `pnpm run build`        | ビルド (Astro + Pagefind の索引)     |
| `pnpm run check`        | 品質ゲート一式                       |
| `pnpm run infra:check`  | Terraform の書式と構文 (要 Terraform) |

`check` は lint → typecheck → knip → 配色 → Worker 名 → test → build → deploy の dry-run をこの順に通す。
`infra:check` は Terraform を必要とするため `check` に含めない。

図をビルド時に SVG へ変換するので、`build` には Playwright の Chromium が要る。

```sh
pnpm --filter @fukuemon/web exec playwright install chromium
```

## 配信

既定ブランチへ merge すると Check workflow が回り、**成功したときだけ** Deploy workflow が `wrangler deploy` を実行する。
push を直接の契機にすると、検査の結果を待たずに配信されてしまうためである。

基盤リソース (zone / custom domain / state 用の R2 バケット) は Terraform の管轄で、`workflow_dispatch` の手動起動と environment の承認を通す。
**1 つのリソースを Terraform と Wrangler の両方から管理しない。**

- 管轄の分担と credential の置き場: [context/infrastructure.md](context/infrastructure.md)
- apply の手順と実行順序: [infra/README.md](infra/README.md)
- 判断の理由: [ADR-0005](adr/0005-workers-terraform-wrangler-boundary.md)

## 文書

| 知りたいこと          | 読む場所                                  |
| --------------------- | ----------------------------------------- |
| 全体像、Why / What    | [design/DesignDoc.md](design/DesignDoc.md) |
| feature 単位の設計    | [design/features/](design/features/)      |
| 技術規約 / 運用契約   | [context/](context/)                      |
| 判断とその代替案      | [adr/](adr/)                              |

迷ったら Design Doc から読む。
内容が衝突したときは Design Doc を正とする。
