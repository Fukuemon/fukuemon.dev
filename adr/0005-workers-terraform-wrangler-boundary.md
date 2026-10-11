# ADR-0005: Cloudflare Workers Static Assets を採用し、基盤を Terraform、deploy を Wrangler が管理する

## Status

承認

## Context

- このサイトは完全に静的で、実行時のサーバーコンポーネントを持たない。
  Worker はハンドラを持たず、静的アセットだけを配信する。
- Cloudflare は、Pages から Workers Static Assets への移行を推奨の方法にしている。
  `wrangler pages deploy` の失敗メッセージも "Workers are the recommended way to deploy all new projects" と Workers を勧める。
  - 出典: [Cloudflare: Migrate from Pages to Workers](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/)
- 別のプロジェクトでは、稼働中の Pages を続け、Workers への移行を後に回した。
  **このプロジェクトは新規なので、その分岐を経ずに始められる。**
- 同じプロジェクトでは、infra code を別のリポジトリへ置くと決めた。
  3 か月の間 `.tf` が 1 つも書かれず、後の判断で monorepo へ集め直した。
  **分離は、そこへ変更を書き込む頻度と担当があって初めて機能する。**
- 運用者は 1 名なので、レビューによる職務の分離が成り立たない。
- Terraform の provider `cloudflare/cloudflare` の latest は 5.24.0 で、認証は `CLOUDFLARE_API_TOKEN` を使う。
- provider 5.11.0 以降は、`cloudflare_workers_script` の `assets = { directory = ... }` で静的アセットを Terraform から配れる。

## Decision

### 1. Cloudflare Workers Static Assets を採用する

Pages を採らない。  
**Workers を選ぶと、Pages にある次の 2 つの問題が最初からなくなる。**

| Pages の問題                                                                                                                                                    | Workers での状況                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `wrangler pages deploy` は project を自動では作らず、非対話では `UserError` で失敗する。初回に運用者が `wrangler pages project create` を手で実行する必要がある | `wrangler deploy` が Worker を作るので、手で事前に作る手順が要らない |
| `cloudflare_pages_project` の `deployment_configs` が secret と binding を内包し、Terraform の管理と Wrangler による secret の投入が衝突する                    | Worker script を Terraform で管理しないので、衝突しない              |

将来 `/api/*` にハンドラを足すときは、**同じ Worker にハンドラを足すだけで済む。**  
Pages では、Pages Functions という別の仕組みを経由する。

### 2. infra code をこのリポジトリに置く

`infra/` をリポジトリのルートの直下に置き、`packages/` に入れない。  
`packages/` は app から import される場所で、infra はどこからも import されないため。

- **`modules/` を作らない。**
  - Cloudflare Terraform Best Practices は、モジュールを避け、使うとしても控えめにすると定める。
    - 出典: [Cloudflare Terraform Best Practices](https://developers.cloudflare.com/terraform/advanced-topics/best-practices/)
  - 対象は 1 アカウント、1 zone、1 サイトで、括り出す重複がない。
  - 同じ形が 2 箇所以上に実在するまで作らない。
- **環境をディレクトリで分けない。** staging を持たない。

### 3. Terraform と Wrangler で管轄を分ける

**基盤の設定は Terraform が、アプリの deploy と runtime の設定は Wrangler が管理する。1 つのリソースを両方から管理しない。**

管轄を判断できない新しいリソースは、次の順に判定する。

1. **データを保持するなら、Terraform にする。** 消えると戻せないリソースを、deploy のたびに動く workflow から切り離す。
2. deploy のたびに変わるなら、Wrangler にする。
3. 変わらない場合、その変更が本番の可用性かドメインへの到達に影響するなら、Terraform にする。
4. どれにも当たらなければ、Terraform を既定にする。

| リソース                                                    | 管轄                                        |
| ----------------------------------------------------------- | ------------------------------------------- |
| Zone、DNS レコード、TLS                                     | Terraform                                   |
| Workers custom domain（`cloudflare_workers_custom_domain`） | Terraform                                   |
| Terraform の state 用の R2 バケット                         | Terraform（`infra/bootstrap/`）             |
| Worker script と静的アセット                                | Wrangler                                    |
| deployment                                                  | Wrangler                                    |
| runtime secret                                              | Wrangler                                    |
| レスポンスヘッダ（`_headers`）                              | Wrangler（配信物の一部）                    |
| binding とデータ本体（D1、KV、R2）                          | binding は Wrangler、データ本体は Terraform |

**`cloudflare_workers_script` を使わない。**
使うと deploy が Terraform を経由し、apply の権限が日常の CI へ降りる。

### 4. runtime secret を Terraform の state に載せない

値は `wrangler secret put` で投入し、手で起動する特権の workflow か、運用者の手元での実行に限る。  
Terraform は secret の**名前**だけを扱う。

### 5. credential を 2 系統に分ける

- 通常の deploy workflow は、push を起点に自動で動き、deploy の範囲に絞った token だけを持つ。
- apply workflow は、手で起動し（`workflow_dispatch`）、GitHub environment の protection rules を通し、apply 用の token を持つ。

**1 名の体制でも意味を持つ分離は 2 つある。**  
apply が自動では動かず、手で起動するという明示的な行為を伴うこと。  
通常の CI が apply 用の credential を持たないこと。  
レビューによる職務の分離は成り立たないので、`CODEOWNERS` を設定しない。

## Verification

- `cloudflare_workers_custom_domain` の必須の項目は、`account_id`、`hostname`、`service` の 3 つだった。
  - `environment` は Optional で、Deprecated になっていた。
  - provider 5.4.0 で報告された、Wrangler で assets 付きの Worker を deploy すると `environment` の不一致で 404 になる問題は、この schema の変更で前提がなくなった。
    - 出典: [cloudflare/terraform-provider-cloudflare#5618](https://github.com/cloudflare/terraform-provider-cloudflare/issues/5618)
- `service` は Worker の名前を文字列で参照する。
  - Pages の `cloudflare_pages_domain.project_name` と同じ構造なので、script を Terraform で管理せずに custom domain だけを管理できる。
- 初回の apply で、`cloudflare_workers_custom_domain` が Wrangler で deploy した Worker に紐付いた。
  - apply の後、`https://fukuemon.dev` が Worker `fukuemon-dev` を配信した。
- R2 backend は、`skip_s3_checksum` を含む設定で state を読み書きでき、`use_lockfile` のロックも取れた。
  - S3 互換のキーは、R2 の画面で発行したものに限る。通常の API Tokens の画面で発行した token では、署名が一致しない。

## Considered Options

| 選択肢                                                                                                                                    | 強み                                                                                                                                       | 弱み                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **採用:** Workers Static Assets を使い、基盤を Terraform、deploy と runtime の設定を Wrangler が管理し、infra code をこのリポジトリに置く | Cloudflare の推奨の方法。Astro は Workers 上で GA で、`wrangler.jsonc` を使う。state に機密が入らない。日常の CI が apply の権限を持たない | 管理ツールが 2 つになる。初回に Wrangler の deploy から Terraform の apply への順序の制約がある                                                                                                                                                                                                                                           |
| すべてを Terraform で管理する（`cloudflare_workers_script` を使う）                                                                       | 管理ツールが 1 つに揃う。すべての変更が `terraform plan` の差分に出る                                                                      | deploy のたびに Terraform を動かすことになり、apply の権限が日常の CI に降り、credential を分ける目的を損なう。Worker の binding と secret を Terraform が持ち、state が機密になる。provider 5.11.0 の assets への対応には、既知の不具合の報告がある                                                                                      |
| すべてを Wrangler と Dashboard で管理する                                                                                                 | 初期のセットアップが最も速い。Terraform の学習と state の運用が要らない                                                                    | DNS と custom domain がコードで管理されず、変更の履歴、レビュー、再現性を失う。成功条件「公開に関わる Cloudflare 設定が Dashboard 上の属人設定として残らない」を満たさない                                                                                                                                                                |
| Cloudflare Pages を使う                                                                                                                   | 静的サイトの標準的な選択肢で、情報が多い。廃止の告知はない                                                                                 | Decision の「1. Cloudflare Workers Static Assets を採用する」の表にある 2 つの問題を最初から抱える。将来 `/api/*` を足すとき Pages Functions という別の仕組みが要る。Pages Functions は Secrets Store に対応しない。Cloudflare 自身が新規には Workers を勧める                                                                            |
| infra code を別のリポジトリへ分ける                                                                                                       | app の開発の導線から、apply の権限と credential を物理的に遠ざけられる。UI の変更と infra の変更のレビューの観点を分けられる               | 別のプロジェクトで同じ判断をした結果、3 か月の間 `.tf` が 1 つも書かれず、分離のコストだけを払って利益を受け取らない状態が続いた。運用者が 1 名で書き込む頻度が低いこのプロジェクトでも、同じ結末になる可能性が高い。分離で守ろうとした、apply の権限を日常の CI から遠ざけることは、credential の 2 系統でリポジトリを分けずに達成できる |

## Consequences

### Positive

- 初回の構築で手で行う手順が、Pages より 1 つ少ない。
- `/api/*` を足すときは、同じ Worker にハンドラを足すだけで済む。
- Terraform の state に機密が入らないので、state backend を守る要件が下がる。
- 日常の deploy が Terraform を経由しないので、UI の変更の PR に infra の差分が入らない。

### Negative

- 管理ツールが 2 つになり、どちらの管轄かを都度判断する必要がある。
  - 判定の手順と管轄の表を保つ運用のコストがかかる。
- Worker の設定（compatibility date、binding）が Terraform の差分に出ない。
  - Worker の設定を持つのは実質的に `wrangler.jsonc` だけになるので、レビューの対象として扱う必要がある。
- `cloudflare_workers_custom_domain` は Worker の存在を前提にするので、初回は Wrangler の deploy を Terraform の apply より先に行う必要がある。
- secret の投入は自動化されず、更新のときに手で操作する必要がある。
- **将来 `/api/*` にハンドラを足すと、その変更は通常の PR に含まれ、merge で自動的に deploy される。**
  - apply workflow のような明示的な行為を挟まない。
  - Worker のコードは app の側にあるので、リポジトリをどう分けても解けない。
  - 緩和は、通常の PR のレビューと自動テストに頼る。
