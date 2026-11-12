# ADR-0032: 文書のサイトを Zensical で組み、Cloudflare Access を Terraform で掛ける

## Status

提案

## Context

設計の文書（PRD、Design Doc、ADR）を、組み立てたサイトとして読めるようにする。

- 文書のサイトは `docs.fukuemon.dev` に置き、運営者が許可した人だけに見せる。文書の原本は、公開のリポジトリにある。隠すのは、組み立てたサイトだけである。
  - ADR-0031: [サブドメインに分ける規則を決め、1 つのアプリを 1 つの Worker とホスト名に割り当てる](0031-subdomains-and-workers.md)
- 文書は `docs/` に集め、機能ごとの Design Doc を `docs/design/` からシンボリックリンクで指す。
  - ADR-0029: [リポジトリの構成を buddy に合わせ、文書を `docs/` に、E2E を `packages/e2e` に置く](0029-repository-layout-like-buddy.md)
- カタログは `design.fukuemon.dev` で誰でも開ける。文書のサイトには入れない。
  - ADR-0021: [packages/ui に Base と Case の React のコンポーネントを置き、packages/ui の Storybook をカタログにする](0021-ui-components-and-catalog.md)
- 到達に関わる設定は Terraform が、deploy は Wrangler が管理する。
  - ADR-0005: [Cloudflare Workers Static Assets を採用し、基盤を Terraform、deploy を Wrangler が管理する](0005-workers-terraform-wrangler-boundary.md)
- buddy は、Zensical（Python のツール。uv で流す）で `docs/` を組み、`apps/docs-site/` の Worker から出している。Cloudflare Access は掛けていない。
  - 出典: [buddy](https://github.com/Fukuemon/buddy)
- サイトの本体は、Starlight を採っていない。
  - ADR-0001: [Starlight を採らず、Astro 単体 + Expressive Code + Pagefind で組む](0001-starlight-as-docs-renderer.md)
- Worker は、何も書かないと、workers.dev の URL とバージョンごとの URL でも開ける。Access は `docs.fukuemon.dev` のホスト名に掛けるので、この 2 つの URL を閉じる。

## Decision

### 1. 組み方

- Zensical で `docs/` を組み、`apps/docs-site/` の Worker（`fukuemon-dev-docs`）から、静的なアセットとして出す。buddy と設定と手順を共有するためである。
- 載せる文書は、`docs/` の PRD、全体の Design Doc、ADR と、シンボリックリンクで指す機能ごとの Design Doc とデザインシステムの文書にする。`context/` は載せない。
- カタログは載せず、`design.fukuemon.dev` へのリンクを置く。
- develop への push で check が通ったときに出す。

### 2. アクセスの認証

- `docs.fukuemon.dev` に Cloudflare Access を掛ける。
- Access のアプリケーションとポリシーは、`infra/cloudflare/` の Terraform で持つ。到達に関わる設定を、ダッシュボードに残さないためである。
- 許すメールアドレスは、Terraform の変数で渡す。リポジトリと、公開の Actions のログに書かない。
- Worker の `workers_dev` と `preview_urls` を `false` にする。custom domain のほかの URL で開けないようにするためである。

## 承認の条件

次の 3 つを確認する。

- `workers_dev` と `preview_urls` を `false` にした Worker が、custom domain のほかの URL で開けないこと。
- Zero Trust の組織を作る操作を、Terraform で持てるか。持てなければ、最初の 1 回だけダッシュボードで行い、手順を `apps/docs-site/README.md` に書く。
- apply 用のトークンに足す権限の名前。

## Considered Options

| 選択肢                                                  | 強み                                                                 | 弱み                                                                                   |
| ------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **採用:** Zensical で組み、Access を Terraform で掛ける | buddy と設定、手順、スキルを共有できる。認証の設定がリポジトリに残る | Python と uv の依存が増える。apply 用のトークンに、Access の権限を足す                 |
| Astro の Starlight で組む                               | サイトと同じ Astro で、Python が要らない                             | buddy と違う仕組みを保守する。同じリポジトリに、Astro の組み方が 2 つ並ぶ              |
| Access をダッシュボードで設定する                       | トークンの権限が増えない                                             | 設定がリポジトリに残らない。ダッシュボードで手で変えた設定を残さない方針に反する       |
| 文書のサイトを作らず、GitHub の上で文書を読む           | 基盤が増えない                                                       | Mermaid の図と文書の間のリンクを、1 つのサイトとして辿れない。buddy と手順がそろわない |

## Consequences

### Positive

- 運営者が、設計の文書を、検索と目次のあるサイトで読める。
- 文書のサイトの組み方が、buddy と同じになる。

### Negative

- Python と uv が、文書のサイトを組むためだけに要る。
- Access の許すメールアドレスを変えるたびに、Terraform の apply が要る。
- 文書の原本は公開のリポジトリにあるので、Access は文書の中身を隠さない。
