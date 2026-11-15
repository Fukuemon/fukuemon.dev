# ADR-0032: ドキュメントサイトを Zensical でビルドし、custom domain だけで配信する

## Status

承認

## Context

設計の文書（PRD、Design Doc、ADR）を、ビルドしたサイトとして読めるようにする。

- ドキュメントサイトは `docs.fukuemon.dev` に置き、誰でも開ける。
  - ADR-0031: [サブドメインに分ける規則を決め、1 つのアプリを 1 つの Worker とホスト名に割り当てる](0031-subdomains-and-workers.md)
- 文書の原本は、公開のリポジトリにある。サイトに載る文書は、どれもリポジトリで誰でも読める。
- 文書は `docs/` に集め、機能ごとの Design Doc を `docs/design/` からシンボリックリンクで指す。
  - ADR-0029: [リポジトリの構成を buddy に合わせ、文書を `docs/` に、E2E を `packages/e2e` に置く](0029-repository-layout-like-buddy.md)
- カタログは `design.fukuemon.dev` で誰でも開ける。ドキュメントサイトには入れない。
  - ADR-0021: [packages/ui に Base と Case の React のコンポーネントを置き、packages/ui の Storybook をカタログにする](0021-ui-components-and-catalog.md)
- 到達に関わる設定は Terraform が、deploy は Wrangler が管理する。管轄を判断できないリソースは、本番の可用性かドメインへの到達に影響するなら Terraform にする。
  - ADR-0005: [Cloudflare Workers Static Assets を採用し、基盤を Terraform、deploy を Wrangler が管理する](0005-workers-terraform-wrangler-boundary.md)
- buddy は、Zensical で `docs/` をビルドし、`apps/docs-site/` の Worker から配信している。
  - 出典: [buddy](https://github.com/Fukuemon/buddy)
- Zensical は Python のツールで、uv で実行する。
- サイトの本体は、Starlight を採っていない。
  - ADR-0001: [Starlight を採らず、Astro 単体 + Expressive Code で組む](0001-starlight-as-docs-renderer.md)
- Worker は、`workers_dev` と `preview_urls` を指定しないと、workers.dev の URL とバージョンごとの URL でも開ける。

## Decision

### 1. ビルドの方法

- Zensical で `docs/` をビルドし、`apps/docs-site/` の Worker（`fukuemon-dev-docs`）から、静的なアセットとして配信する。buddy と設定と手順を共有するためである。
- 含める文書は、`docs/` の PRD、全体の Design Doc、ADR と、シンボリックリンクで指す機能ごとの Design Doc とデザインシステムの文書にする。`context/` は含めない。
- カタログは含めず、`design.fukuemon.dev` へのリンクを置く。
- develop への push で check が通ったときにデプロイする。

### 2. custom domain だけで配信する

- `docs.<zone>` の custom domain（`cloudflare_workers_custom_domain.docs`）は、Terraform で持つ。ホスト名の作成は、ほかのサブドメインと同じ管轄にそろえる。
- Worker の `workers_dev` と `preview_urls` を `false` にする。
  - 公開先を custom domain だけにするためである。カタログとプレイグラウンドの Worker と同じ設定にする。

## 承認の条件

ドキュメントサイトを公開するときに、`workers_dev` と `preview_urls` を `false` にした Worker が、custom domain 以外の URL で開けないことを確認する。

## Considered Options

ビルドの方法の選択肢は次のとおり。

| 選択肢                                              | 強み                                     | 弱み                                                                                   |
| --------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------- |
| **採用:** Zensical でビルドする                     | buddy と設定、手順、スキルを共有できる   | Python と uv の依存が増える                                                            |
| Astro の Starlight でビルドする                     | サイトと同じ Astro で、Python が要らない | buddy と違う仕組みを保守する。同じリポジトリに、Astro のビルドの方法が 2 つ並ぶ        |
| ドキュメントサイトを作らず、GitHub の上で文書を読む | 基盤が増えない                           | Mermaid の図と文書の間のリンクを、1 つのサイトとして辿れない。buddy と手順がそろわない |

## Consequences

### Positive

- 運営者が、設計の文書を、検索と目次のあるサイトで読める。
- ドキュメントサイトのビルドの方法が、buddy と同じになる。

### Negative

- Python と uv が、ドキュメントサイトをビルドするためだけに要る。
