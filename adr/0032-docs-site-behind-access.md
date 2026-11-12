# ADR-0032: ドキュメントサイトを Zensical でビルドし、Cloudflare Access を Terraform で設定する

## Status

承認

## Context

設計の文書（PRD、Design Doc、ADR）を、ビルドしたサイトとして読めるようにする。

- ドキュメントサイトは `docs.fukuemon.dev` に置き、運営者が許可した人だけに見せる。文書の原本は、公開のリポジトリにある。隠すのは、ビルドしたサイトだけである。
  - ADR-0031: [サブドメインに分ける規則を決め、1 つのアプリを 1 つの Worker とホスト名に割り当てる](0031-subdomains-and-workers.md)
- 文書は `docs/` に集め、機能ごとの Design Doc を `docs/design/` からシンボリックリンクで指す。
  - ADR-0029: [リポジトリの構成を buddy に合わせ、文書を `docs/` に、E2E を `packages/e2e` に置く](0029-repository-layout-like-buddy.md)
- カタログは `design.fukuemon.dev` で誰でも開ける。ドキュメントサイトには入れない。
  - ADR-0021: [packages/ui に Base と Case の React のコンポーネントを置き、packages/ui の Storybook をカタログにする](0021-ui-components-and-catalog.md)
- 到達に関わる設定は Terraform が、deploy は Wrangler が管理する。
  - ADR-0005: [Cloudflare Workers Static Assets を採用し、基盤を Terraform、deploy を Wrangler が管理する](0005-workers-terraform-wrangler-boundary.md)
- buddy は、Zensical（Python のツール。uv で実行する）で `docs/` をビルドし、`apps/docs-site/` の Worker から配信している。Cloudflare Access は設定していない。
  - 出典: [buddy](https://github.com/Fukuemon/buddy)
- サイトの本体は、Starlight を採っていない。
  - ADR-0001: [Starlight を採らず、Astro 単体 + Expressive Code + Pagefind で組む](0001-starlight-as-docs-renderer.md)
- Worker は、何も書かないと、workers.dev の URL とバージョンごとの URL でも開ける。Access は `docs.fukuemon.dev` のホスト名に設定するので、この 2 つの URL を閉じる。

## Decision

### 1. ビルドの方法

- Zensical で `docs/` をビルドし、`apps/docs-site/` の Worker（`fukuemon-dev-docs`）から、静的なアセットとして配信する。buddy と設定と手順を共有するためである。
- 含める文書は、`docs/` の PRD、全体の Design Doc、ADR と、シンボリックリンクで指す機能ごとの Design Doc とデザインシステムの文書にする。`context/` は含めない。
- カタログは含めず、`design.fukuemon.dev` へのリンクを置く。
- develop への push で check が通ったときにデプロイする。

### 2. アクセスの認証

- `docs.fukuemon.dev` に Cloudflare Access を設定する。
- Access のアプリケーションとポリシーは、`infra/cloudflare/` の Terraform で管理する。到達に関わる設定を、ダッシュボードに残さないためである。
- 許可するメールアドレスは、Terraform の変数で渡す。リポジトリと、公開の Actions のログに書かない。
- Worker の `workers_dev` と `preview_urls` を `false` にする。custom domain のほかの URL で開けないようにするためである。

## 承認の条件

ドキュメントサイトを作るタスクの中で、次の 3 つを確認する。

- `workers_dev` と `preview_urls` を `false` にした Worker が、custom domain のほかの URL で開けないこと。
- Zero Trust の組織を作る操作を、Terraform で管理できるか。管理できなければ、最初の 1 回だけダッシュボードで行い、手順を `apps/docs-site/README.md` に書く。
- apply 用のトークンに追加する権限の名前。

## Considered Options

| 選択肢                                                        | 強み                                                                 | 弱み                                                                                   |
| ------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **採用:** Zensical でビルドし、Access を Terraform で設定する | buddy と設定、手順、スキルを共有できる。認証の設定がリポジトリに残る | Python と uv の依存が増える。apply 用のトークンに、Access の権限を追加する             |
| Astro の Starlight でビルドする                               | サイトと同じ Astro で、Python が要らない                             | buddy と違う仕組みを保守する。同じリポジトリに、Astro のビルドの方法が 2 つ並ぶ        |
| Access をダッシュボードで設定する                             | トークンの権限が増えない                                             | 設定がリポジトリに残らない。ダッシュボードで手動で変えた設定を残さない方針に反する     |
| ドキュメントサイトを作らず、GitHub の上で文書を読む           | 基盤が増えない                                                       | Mermaid の図と文書の間のリンクを、1 つのサイトとして辿れない。buddy と手順がそろわない |

## Consequences

### Positive

- 運営者が、設計の文書を、検索と目次のあるサイトで読める。
- ドキュメントサイトのビルドの方法が、buddy と同じになる。

### Negative

- Python と uv が、ドキュメントサイトをビルドするためだけに要る。
- Access の許可するメールアドレスを変えるたびに、Terraform の apply が要る。
- 文書の原本は公開のリポジトリにあるので、Access は文書の中身を隠さない。
