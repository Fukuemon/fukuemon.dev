---
type: context
title: 基盤と運用
description: 本番だけの環境、Terraform と Wrangler の管轄、deploy と apply の条件、レスポンスヘッダ、観測点、state を失ったときの戻し方、credential の 2 系統と置き場
status: draft
governs:
  - infra/
  - apps/web/wrangler.jsonc
  - packages/ui/wrangler.jsonc
  - apps/web/public/_headers
  - apps/playground/wrangler.jsonc
  - apps/playground/public/_headers
  - apps/playground/public/_redirects
verified_commit: 01101c7
---

# 基盤と運用

基盤の構成と deploy と apply の流れは [infra/DesignDoc.md](../infra/DesignDoc.md) に、基盤を作る手順と apply の手順は [infra/README.md](../infra/README.md) にある。

## Environments

環境は本番の 1 つだけで、staging を持たない。

- Cloudflare のアカウントは 1 つ、zone は 1 つにする。
- preview deployment は Wrangler の機能として使ってよいが、Terraform の管轄に入れない。
- 環境をディレクトリで分けない（`envs/staging/` のような構成を採らない）。
  - 出典: [Cloudflare Terraform Best Practices](https://developers.cloudflare.com/terraform/advanced-topics/best-practices/)

### Terraform と Wrangler の管轄

基盤の設定は Terraform が、アプリの deploy と runtime の設定は Wrangler が管理する。  
1 つのリソースを両方から管理しない。  
ADR-0005: [Workers と Terraform と Wrangler の分担](../docs/adr/0005-workers-terraform-wrangler-boundary.md)  
管轄はこの表で決め、リソースが増減したら表を直す。

| リソース                                                    | 管轄                            | 使うか   |
| ----------------------------------------------------------- | ------------------------------- | -------- |
| Zone、DNS レコード、TLS                                     | Terraform                       | 使う     |
| Workers custom domain（`cloudflare_workers_custom_domain`） | Terraform                       | 使う     |
| Terraform の state 用の R2 バケット                         | Terraform（`infra/bootstrap/`） | 使う     |
| Worker script と静的アセット                                | Wrangler                        | 使う     |
| deployment                                                  | Wrangler                        | 使う     |
| レスポンスヘッダ（`_headers`）                              | Wrangler（配信物の一部）        | 使う     |
| runtime secret                                              | Wrangler                        | 該当なし |
| binding（D1、KV、R2）                                       | Wrangler（`wrangler.jsonc`）    | 該当なし |
| D1、KV、R2 のデータ本体                                     | Terraform                       | 該当なし |

管轄が決まらない新しいリソースは、次の順に判定する。

1. データを保持するなら、Terraform にする。消えると戻せないリソースを、deploy のたびに動く workflow から切り離す。
2. deploy のたびに変わるなら、Wrangler にする。
3. 変更が本番の可用性かドメインへの到達に影響するなら、Terraform にする。
4. どれにも当たらなければ、Terraform にする。変更の履歴とレビューを残せる。

- `cloudflare_workers_script` で静的アセットを配らない。deploy が Terraform を経由し、apply の権限が日常の CI へ降りる。
- Terraform が作ったリソースの識別子（R2 のバケット名、D1 の database id など）を Wrangler へ渡す方法は、データを保持するリソースが 2 つ目になる前にこの節に定める。

### レスポンスヘッダ

レスポンスヘッダは、Worker ごとに、配信物の `_headers` に書く。

| Worker           | ホスト名              | `_headers`                               |
| ---------------- | --------------------- | ---------------------------------------- |
| サイト           | `fukuemon.dev`        | `apps/web/public/_headers`               |
| カタログ         | `design.fukuemon.dev` | `packages/ui/.storybook/public/_headers` |
| プレイグラウンド | `play.fukuemon.dev`   | `apps/playground/public/_headers`        |

`fukuemon.dev` が返すヘッダは次のとおり。

- cross-origin isolation のヘッダは、isolation を求める実行環境を埋め込む記事の URL にだけ返す。`fukuemon.dev` の全体には返さない。
  - 全体に返すと、CORP を返さない第三者のリソースが一律にブロックされる。
  - `apps/web` のビルドが、出力の HTML から Node の実行環境を埋め込むページを集め、`COOP: same-origin` と `COEP: require-corp` の規則を、出力の `_headers` の末尾に足す。`apps/web/public/_headers` には書かない。
  - ビルドは、規則を、末尾のスラッシュがある URL と無い URL の両方に足す。
  - ADR-0031: [サブドメインに分ける規則](../docs/adr/0031-subdomains-and-workers.md#5-cross-origin-isolation)
  - ADR-0034: [cross-origin isolation のヘッダを返すパス](../docs/adr/0034-playground-origin-and-embedding.md)
- `/playground-projects/*` には、`Access-Control-Allow-Origin: https://play.fukuemon.dev` を返す。`play.fukuemon.dev` のツールのページが、プロジェクトの JSON を読むためである。
  - ADR-0049: [プロジェクトを渡す方法](../docs/adr/0049-playground-projects-from-articles.md#3-渡す方法)
- HTML に `Cache-Control` を書かない。Workers Static Assets のデフォルト値に任せる。
- `/_astro/*` には `immutable` を書く。ファイル名にハッシュが入るため。
- HSTS に `includeSubDomains` を付ける。HTTP で公開するサブドメインが要るときは外す。

`play.fukuemon.dev` が返すヘッダとリダイレクトは次のとおり。

- cross-origin isolation の 3 つのヘッダは、Node の実行環境のパス（`/node/*`）にだけ返す。
  3 つの値は、COOP が `same-origin`、COEP が `require-corp`、CORP が `cross-origin` である。
  - ほかのツールのパスに返すと、別の origin のページを iframe で埋め込むツールが動かない。
  - ADR-0034: [cross-origin isolation のヘッダを返すパス](../docs/adr/0034-playground-origin-and-embedding.md#2-プレイグラウンドでヘッダを返すパス)
- `fukuemon.dev` の本番を作り直したサイトに切り替えるまでは、すべてのパスに `X-Robots-Tag: noindex` を返す。
  - 切り替えの作業は [#91](https://github.com/Fukuemon/fukuemon.dev/issues/91) で行う。
- すべてのパスに、カタログと同じ `X-Content-Type-Options`、`Referrer-Policy`、`Strict-Transport-Security` を返す。
  - `Strict-Transport-Security` は、`play.fukuemon.dev` を直接開いた訪問者にも届くように返す。apex の `includeSubDomains` は、先に `fukuemon.dev` を開いた訪問者にしか届かない。
- すべてのパスに、`Content-Security-Policy: frame-ancestors 'self' https://fukuemon.dev` を返す。ほかのサイトが、ツールのページを iframe で埋め込めないようにするためである。
  - `fukuemon.dev` と同じ `frame-ancestors 'self'` だけにすると、記事の iframe の埋め込みが動かない。
  - 手元とプレビューの記事からは、本番の `play.fukuemon.dev` を埋め込めない。
- ツールのページは、プロジェクトの JSON を `https://fukuemon.dev/playground-projects/` から読む。手元で確認するときは、`apps/playground` のビルドの環境変数 `VITE_SITE_ORIGIN` に、手元の `apps/web` の origin を渡す。本番の deploy では渡さない。
- `/` は、`apps/playground/public/_redirects` で `https://fukuemon.dev/playground` へリダイレクトする。

## Deployment Conditions

- サイトの Worker の deploy は、運用者が deploy workflow を `workflow_dispatch` でデフォルトのブランチ（`develop`）から手で起動したときだけ行う。サイトを作り直す間は、develop への push で deploy しない。
- カタログの Worker の deploy は、develop への push で check workflow が通ったときに、deploy-catalog workflow が行う。初回の deploy と出し直しは、運用者が deploy-catalog workflow を `workflow_dispatch` で `develop` から手で起動する。
  - ADR-0021: [packages/ui に Base と Case の React のコンポーネントを置き、packages/ui の Storybook をカタログにする](../docs/adr/0021-ui-components-and-catalog.md)
- プレイグラウンドの Worker の deploy は、develop への push で check workflow が通ったときに、deploy-playground workflow が行う。
  初回の deploy と出し直しは、運用者が deploy-playground workflow を `workflow_dispatch` で `develop` から手で起動する。
  - custom domain の `play.<zone>` は、初回の deploy で Worker ができてから apply する。
- Terraform の apply は、運用者が apply workflow を `workflow_dispatch` で手で起動したときだけ行う。
  - 起動には、`infra` environment の protection rules の承認が要る。
  - 差分は 2 回の起動で確認する。`mode=plan` で起動して plan を読み、納得してから `mode=apply` で起動し直す。
  - plan と apply は 1 つの job に置き、plan file を artifact に上げない。public のリポジトリの artifact から account ID と zone ID が漏れるため。
- zone の plan に `account.id` を sensitive として扱う差分だけが出るなら、想定どおりとして apply してよい。
  - `name` や `type` のように実体が変わる差分が出たら、`zone.tf` を実際の zone の設定に合わせて直す。
- 初めて基盤を作るときは、[infra/README.md](../infra/README.md#初めて基盤を作る) の順に進める。

## Health and Monitoring

- アクセス解析が要るときは、Cloudflare Web Analytics を使う。自前のログ収集のエンドポイントを作らない。
- 正常と判断する観測点は、未定。

## Rollback

- Terraform の state を失ったときは、`terraform import` で戻す。
  - state のバケットのバージョニングは設定しない。provider の `cloudflare_r2_bucket` に versioning の引数がない。
- Worker の deploy を戻す手順と、戻せない変更の扱いは、未定。

## Secrets

credential は、deploy workflow 用と apply workflow 用の 2 系統に分ける。  
1 名の体制で意味を持つ分離は、apply を手で起動することと、通常の CI が apply 用の credential を持たないことの 2 つである。  
レビューによる職務の分離は成り立たないので、`CODEOWNERS` を置かない。

apply 用の credential は `infra` environment だけに置く。  
deploy workflow は environment を指定しないので、apply 用の credential に届かない。

| 名前                      | 置き場                          | 使う場面                                                                             |
| ------------------------- | ------------------------------- | ------------------------------------------------------------------------------------ |
| `CLOUDFLARE_API_TOKEN`    | repository secret               | deploy workflow、deploy-catalog workflow、deploy-playground workflow                 |
| `CLOUDFLARE_ACCOUNT_ID`   | repository secret               | deploy workflow、deploy-catalog workflow、deploy-playground workflow、apply workflow |
| `TF_CLOUDFLARE_API_TOKEN` | `infra` environment の secret   | apply workflow                                                                       |
| `R2_ACCESS_KEY_ID`        | `infra` environment の secret   | apply workflow の state backend                                                      |
| `R2_SECRET_ACCESS_KEY`    | `infra` environment の secret   | apply workflow の state backend                                                      |
| `R2_STATE_BUCKET`         | `infra` environment の secret   | apply workflow の state backend                                                      |
| `CLOUDFLARE_ZONE_ID`      | repository secret               | apply workflow（zone の import）                                                     |
| `ZONE_NAME`               | `infra` environment の variable | apply workflow                                                                       |

token の権限は、スコープ、権限グループ、アクセスレベルの 3 段で指定する。

| token                     | 使う場面                                                             | 権限                                                 |
| ------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`    | deploy workflow、deploy-catalog workflow、deploy-playground workflow | Account / Workers Scripts / Edit                     |
| `TF_CLOUDFLARE_API_TOKEN` | apply workflow                                                       | Account / Workers Scripts / Edit、Zone / Zone / Edit |
| bootstrap 用（手元だけ）  | `infra/bootstrap/` の apply                                          | Account / Workers R2 Storage / Edit                  |
| R2 の S3 互換キー         | state backend                                                        | Object Read & Write。state のバケットに限る          |

- apply workflow の token に R2 の権限を与えない。CI は state backend へ S3 互換キーで接続する。
- bootstrap 用の token を CI へ渡さない。
- deploy 用の token に、Zone の権限と `Account Settings / Read` は要らない。custom domain は Terraform の管轄で、deploy の 3 つの workflow は custom domain を触らない。
- DNS の権限は要らない。custom domain が作るレコード（サイトの apex、カタログの `design`、プレイグラウンドの `play`）は `Workers Scripts` の配下にある。
- `Zone / Zone / Edit` の Zone Resources は、対象の zone だけに限る。
- R2 の S3 互換キーは、R2 の画面から発行したものだけを使う。
  - ほかの画面で作った token で起きるエラーと、発行時に出る値のどれを使うかは、[infra/README.md](../infra/README.md#prerequisites) にある。
- GitHub Actions から使う token に、Client IP Address Filtering を掛けない。
  - runner の IP は多数の CIDR に散らばり、GitHub の側で変わる。
  - 手元から使う bootstrap 用の token は、固定 IP の回線なら絞ってよい。動的 IP なら掛けない。
  - Client IP Address Filtering が IPv6 を受け付けるかと、件数に上限があるかは、未確認。手元用の token を作るときに確認する。

secret を Terraform の state に載せない。

- runtime secret の値は `wrangler secret put` で入れ、日常の deploy workflow からは入れない。
- Terraform は secret の名前だけを変数として扱い、値を扱わない。
- 認証情報（R2 の access key など）は Terraform の外で発行し、GitHub Actions の secret に登録する。
- Terraform の変数 `account_id` と `zone_id` には `sensitive = true` を付ける。付けないと、public のリポジトリの Actions のログに実値が出る。

次のものは、文書とコミットに書かない。

- secret、認証情報、トークンの実値
- 個人の PC の絶対パス。`$(ghq root)` のように動的に解決する。
- Cloudflare の account ID と zone ID の実値。`vars.tf` の変数として渡す。
