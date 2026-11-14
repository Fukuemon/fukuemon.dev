# ADR-0081: ドキュメントサイトの Cloudflare Access を、Terraform で持たず、運営者がダッシュボードで設定する

## Status

提案

## Context

ドキュメントサイト（`docs.fukuemon.dev`）の Access のアプリケーションとポリシーを、どこで管理するかを決め直す。

- ADR-0032 は、Access のアプリケーションとポリシーを `infra/cloudflare/` の Terraform で管理すると決めた。到達に関わる設定を、ダッシュボードに残さないためである。
  - ADR-0032: [ドキュメントサイトを Zensical でビルドし、Cloudflare Access を Terraform で設定する](0032-docs-site-behind-access.md)
- ADR-0005 は、管轄を判断できないリソースを、本番の可用性かドメインへの到達に影響するなら Terraform にすると決めている。Access はドメインへの到達に影響するので、この判定では Terraform になる。
  - ADR-0005: [Cloudflare Workers Static Assets を採用し、基盤を Terraform、deploy を Wrangler が管理する](0005-workers-terraform-wrangler-boundary.md)
- 運営者は、Access のオンとオフを頻繁に切り替える。運営者の言葉は次のとおり。
  - 「accessのonoffを切り替えることがよくある。buddyとかもいまはoffだけどonにもするし。こういう切り替えが多い」
- Terraform で持つと、切り替えのたびに、コードの変更、pull request、apply の workflow の起動と `infra` environment の承認が要る。
- Terraform で持つと、許可するメールアドレスを secret から変数で渡し、ログでマスクする仕組みが要る。メールアドレスを変えるたびにも apply が要る。
- Access のアプリケーションが無いホスト名は、インターネットの誰でも開ける。
  - 出典: [Publish a self-hosted application to the Internet](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-public-app/)

## Decision

ドキュメントサイトの Access のアプリケーションとポリシーは、Terraform で持たず、運営者が Cloudflare のダッシュボードで設定する。  
切り替えの多い設定を、apply を通さずに変えられるようにするためである。  
ADR-0005 の管轄の判定の例外にする。

- `docs.<zone>` の custom domain（`cloudflare_workers_custom_domain.docs`）は、Terraform に残す。ホスト名の作成は、ほかのサブドメインと同じ管轄にそろえる。
- custom domain は、Access の後に作るという順を、Terraform では持たない。`depends_on` を外す。順は、`apps/docs-site/README.md` の手順で守る。
- 初めて公開するときは、ダッシュボードで Access のアプリケーションとポリシーを作った後に、Terraform で custom domain を作る。
- Access をオフにしている間は、ドキュメントサイトを誰でも開ける。文書の原本は公開のリポジトリにあるので、オフにして漏れる中身は無い。
- 許可するメールアドレスは、ダッシュボードのポリシーにだけ書く。リポジトリ、Terraform の state、GitHub の secret に置かない。
- apply 用の token に Access の権限を足さない。
- Worker の `workers_dev` と `preview_urls` を `false` にし、`check:closed-urls` で確認することは、ADR-0032 のまま変えない。Access は `docs.<zone>` のホスト名にだけ掛かるためである。

## Considered Options

| 選択肢                                                   | 強み                                                                                                           | 弱み                                                                                                      |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **採用:** Access をダッシュボードで設定する              | オンとオフを、apply を通さずにすぐ切り替えられる。メールアドレスを secret とログのマスクで扱う仕組みが要らない | 設定がリポジトリに残らない。custom domain を Access より先に作らない順を、手順でしか守れない              |
| Access を Terraform で持つ（ADR-0032 のまま）            | 設定がリポジトリに残る。custom domain を Access の後に作る順を `depends_on` で守れる                           | 切り替えのたびに、コードの変更、pull request、apply の承認が要る                                          |
| Terraform で持ち、オンとオフを変数で切り替える           | 設定がリポジトリに残る。切り替えはコードを変えずに済む                                                         | 切り替えのたびに apply の workflow の起動と承認が要る。変数の値を GitHub の variable に置く仕組みが増える |
| custom domain もダッシュボードで作り、Terraform から外す | Access と custom domain を作る順を、同じ画面で守れる                                                           | ほかのサブドメインと、custom domain の管轄が分かれる                                                      |

## Consequences

### Positive

- 運営者が、ダッシュボードで Access をすぐにオンとオフにできる。
- apply の workflow から、メールアドレスの secret とマスクの step がなくなる。
- apply 用の token の権限が増えない。

### Negative

- Access の設定がリポジトリに残らない。今の設定は、ダッシュボードでしか確認できない。
- custom domain を作る apply を、Access の前に流すと、ドキュメントサイトが誰でも開ける状態になる。マージの後の最初の apply は、別の目的で流しても、`docs` の custom domain を作る。
- Access をオフにしている間は、ドキュメントサイトを誰でも開ける。noindex は返すが、検索の結果に載らないことは保証しない。
