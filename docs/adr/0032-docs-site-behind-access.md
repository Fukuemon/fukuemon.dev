# ADR-0032: ドキュメントサイトを Zensical でビルドし、Cloudflare Access を運営者がダッシュボードで設定する

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
- 到達に関わる設定は Terraform が、deploy は Wrangler が管理する。管轄を判断できないリソースは、本番の可用性かドメインへの到達に影響するなら Terraform にする。
  - ADR-0005: [Cloudflare Workers Static Assets を採用し、基盤を Terraform、deploy を Wrangler が管理する](0005-workers-terraform-wrangler-boundary.md)
- buddy は、Zensical（Python のツール。uv で実行する）で `docs/` をビルドし、`apps/docs-site/` の Worker から配信している。
  - 出典: [buddy](https://github.com/Fukuemon/buddy)
- サイトの本体は、Starlight を採っていない。
  - ADR-0001: [Starlight を採らず、Astro 単体 + Expressive Code で組む](0001-starlight-as-docs-renderer.md)
- Worker は、何も書かないと、workers.dev の URL とバージョンごとの URL でも開ける。Access は `docs.fukuemon.dev` のホスト名に設定するので、この 2 つの URL を閉じる。
- 運営者は、Access のオンとオフを頻繁に切り替える。運営者の言葉は次のとおり。
  - 「accessのonoffを切り替えることがよくある。buddyとかもいまはoffだけどonにもするし。こういう切り替えが多い」
- Access を Terraform で持つと、切り替えのたびに、コードの変更、pull request、apply の workflow の起動と `infra` environment の承認が要る。
  許可するメールアドレスを secret から変数で渡し、ログでマスクする仕組みも要る。
- Access のアプリケーションが無いホスト名は、インターネット上の誰でも開ける。
  - 出典: [Publish a self-hosted application to the Internet](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-public-app/)

## Decision

### 1. ビルドの方法

- Zensical で `docs/` をビルドし、`apps/docs-site/` の Worker（`fukuemon-dev-docs`）から、静的なアセットとして配信する。buddy と設定と手順を共有するためである。
- 含める文書は、`docs/` の PRD、全体の Design Doc、ADR と、シンボリックリンクで指す機能ごとの Design Doc とデザインシステムの文書にする。`context/` は含めない。
- カタログは含めず、`design.fukuemon.dev` へのリンクを置く。
- develop への push で check が通ったときにデプロイする。

### 2. ほかの URL を閉じる

- Worker の `workers_dev` と `preview_urls` を `false` にする。Access は `docs.<zone>` のホスト名にだけ掛かるので、custom domain のほかの URL で開けないようにするためである。

### 3. アクセスの認証

`docs.fukuemon.dev` に Cloudflare Access を設定する。  
Access は、組み立てたサイトを開発者向けにし、訪問者や検索に見せないためのものである。  
文書の中身の秘密を守るものではない。

- Access のアプリケーションとポリシーは、Terraform で持たず、運営者が Cloudflare のダッシュボードで設定する。切り替えの多い設定を、apply を通さずに変えられるようにするためである。
  - この決定は、ADR-0005 の管轄の判定の例外にする。
  - 例外は、ドキュメントサイトの Access のアプリケーションとポリシーに限る。
- `docs.<zone>` の custom domain（`cloudflare_workers_custom_domain.docs`）は、Terraform で持つ。ホスト名の作成は、ほかのサブドメインと同じ管轄にそろえる。
- Terraform では、Access と custom domain を作る順序を制御しない。初めて公開するときは、ダッシュボードで Access のアプリケーションとポリシーを作った後に、Terraform で custom domain を作る。手順は `apps/docs-site/README.md` にある。
- Access をオフにしている間は、ドキュメントサイトを誰でも開ける。文書の原本は公開のリポジトリにあるので、Access をオフにしても、新しく公開される内容は無い。
- 許可するメールアドレスは、ダッシュボードのポリシーにだけ書く。リポジトリ、Terraform の state、GitHub の secret に置かない。
- apply 用と deploy 用の token に Access の権限を与えない。

## 承認の条件

次の 3 つは、運営者がダッシュボードで Access を作り、ドキュメントサイトを公開するときに確認する。

- custom domain の無いホスト名（`docs.fukuemon.dev`）で、Access のアプリケーションを作れること。作れなければ、初めて公開するときの順を決め直す。
- Access をオフにする操作が、アプリケーションの削除か、消さずに無効にする設定か。
- `workers_dev` と `preview_urls` を `false` にした Worker が、custom domain のほかの URL で開けないこと。

## Considered Options

ビルドの方法の選択肢は次のとおり。

| 選択肢                                              | 強み                                     | 弱み                                                                                   |
| --------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------- |
| **採用:** Zensical でビルドする                     | buddy と設定、手順、スキルを共有できる   | Python と uv の依存が増える                                                            |
| Astro の Starlight でビルドする                     | サイトと同じ Astro で、Python が要らない | buddy と違う仕組みを保守する。同じリポジトリに、Astro のビルドの方法が 2 つ並ぶ        |
| ドキュメントサイトを作らず、GitHub の上で文書を読む | 基盤が増えない                           | Mermaid の図と文書の間のリンクを、1 つのサイトとして辿れない。buddy と手順がそろわない |

Access の管理の選択肢は次のとおり。

| 選択肢                                                   | 強み                                                                                                           | 弱み                                                                                                      |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **採用:** Access をダッシュボードで設定する              | オンとオフを、apply を通さずにすぐ切り替えられる。メールアドレスを secret とログのマスクで扱う仕組みが要らない | 設定がリポジトリに残らない。custom domain を Access より先に作らない順を、手順でしか守れない              |
| Access を Terraform で持つ                               | 設定がリポジトリに残る。custom domain を Access の後に作る順を `depends_on` で守れる                           | 切り替えのたびに、コードの変更、pull request、apply の承認が要る。apply 用の token に Access の権限が要る |
| Terraform で持ち、オンとオフを変数で切り替える           | 設定がリポジトリに残る。切り替えはコードを変えずに済む                                                         | 切り替えのたびに apply の workflow の起動と承認が要る。変数の値を GitHub の variable に置く仕組みが増える |
| custom domain もダッシュボードで作り、Terraform から外す | Access と custom domain を作る順を、同じ画面で守れる                                                           | ほかのサブドメインと、custom domain の管轄が分かれる                                                      |

## Consequences

### Positive

- 運営者が、設計の文書を、検索と目次のあるサイトで読める。
- ドキュメントサイトのビルドの方法が、buddy と同じになる。
- 運営者が、apply を通さずに、ダッシュボードで Access のオンとオフを切り替えられる。
- apply の workflow と token が、メールアドレスと Access の権限を持たない。

### Negative

- Python と uv が、ドキュメントサイトをビルドするためだけに要る。
- Access の設定がリポジトリに残らない。今の設定は、ダッシュボードでしか確認できない。
- custom domain を作る apply を Access の前に実行すると、ドキュメントサイトを誰でも開ける。`cloudflare_workers_custom_domain.docs` が state に無い間は、別の目的で実行した apply も、`docs` の custom domain を作る。
- Access をオフにしている間は、ドキュメントサイトを誰でも開ける。noindex は返すが、検索の結果に載らないことは保証しない。
  - noindex を返す理由: [context/operations.md](../../context/operations.md#レスポンスヘッダ)
- 文書の原本は公開のリポジトリにあるので、Access は文書の中身を隠さない。
