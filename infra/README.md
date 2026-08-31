# infra

Cloudflare の基盤リソースを Terraform で管理する。
管轄の分担とその理由は [context/infrastructure.md](../context/infrastructure.md) と [ADR-0005](../adr/0005-workers-terraform-wrangler-boundary.md) が正本である。

Worker script と静的アセットの deploy は Wrangler の管轄であり、ここには入らない。

## 構成

| ディレクトリ  | 対象                          | state の置き場           | 実行者                    |
| ------------- | ----------------------------- | ------------------------ | ------------------------- |
| `bootstrap/`  | state 用の R2 バケット        | ローカル (commit しない) | 運用者が手元で 1 回       |
| `cloudflare/` | zone と Workers custom domain | R2 (`bootstrap/` が作る) | apply workflow または手元 |

`bootstrap/` を CI から実行しない。
state をローカルに置く前提を壊す。

## 前提

- Terraform 1.11 以上。
  `backend "s3"` の `use_lockfile` を使うため。
  CI は 1.14.3 に固定する。
- apply 用の API token。
  権限は [context/infrastructure.md](../context/infrastructure.md) の「token の権限」に従う。
  `bootstrap/` は R2 の権限だけを使い、`cloudflare/` は zone と Workers Scripts の権限を使う。
- R2 の S3 互換 access key。
  `cloudflare/` の state backend が使う。
  **発行元と使う値は [context/infrastructure.md](../context/infrastructure.md) の state backend の節に従う。** 通常の API Tokens 画面で作った token では通らない。
  secret access key は作成直後にしか表示されない。

**deploy workflow の token と分ける。** 置き場と scope は [context/infrastructure.md](../context/infrastructure.md) の credential の表に従う。

変数の値は各ディレクトリの `terraform.tfvars` に置く。
`.gitignore` が `*.tfvars` を無視するため commit されない。

## 実行順序

`cloudflare_workers_custom_domain` は Worker の存在を前提とする。
**順序を誤ると 3 が失敗する。**

### 1. state 置き場を作る

初回に 1 回だけ実行する。
この段の state はローカルに残る。
失った場合は `terraform import` で回復する。

実行は repo root から root script で行う (`infra/` は workspace package ではない)。

```sh
export CLOUDFLARE_API_TOKEN=<apply 用の token>
pnpm run infra:bootstrap:init
pnpm run infra:bootstrap:apply
```

`terraform.tfvars` に書く値は次のとおり。

```hcl
account_id        = "<Cloudflare の account ID>"
state_bucket_name = "<バケット名>"
```

### 2. Worker を作る

`wrangler deploy` が Worker script と静的アセットを作る。
Pages と異なり、事前の手動作成は要らない。

既定ブランチへ merge すれば deploy workflow が実行する。
手元から実行する場合は次のとおり。

```sh
pnpm --filter @fukuemon/web run build
pnpm --filter @fukuemon/web run deploy
```

### 3. zone を import して custom domain を作る

**zone は Cloudflare Registrar がドメイン取得時に作っている。** Terraform では作らず、`zone.tf` の `import` ブロックが state へ取り込む。
手動の `terraform import` は要らない。
ネームサーバは既に Cloudflare を向いているため、レジストラ側の設定も要らない。

backend の設定は account ID を含むため commit しない。
bucket 名は `-backend-config` で、endpoint は `AWS_ENDPOINT_URL_S3` で渡す。
apply workflow も同じ形で渡す。

```sh
export CLOUDFLARE_API_TOKEN=<apply 用の token>
export AWS_ACCESS_KEY_ID=<R2 の access key id>
export AWS_SECRET_ACCESS_KEY=<R2 の secret access key>
export AWS_ENDPOINT_URL_S3=https://<Cloudflare の account ID>.r2.cloudflarestorage.com
pnpm run infra:init -backend-config="bucket=<1 で作ったバケット名>"
pnpm run infra:plan
pnpm run infra:apply
```

zone ID は Cloudflare の Overview 画面の右側にある。
`terraform.tfvars` と、CI 用の repository secret `CLOUDFLARE_ZONE_ID` の両方に要る。

**plan が出す zone の差分を確かめてから apply する。** `account.id` を sensitive として扱う差分だけなら想定どおりであり、Cloudflare 側の設定は変わらない。
`name` や `type` のように実体が変わる差分が出た場合は、実際の zone 設定に合わせて `zone.tf` を直す。
`cloudflare_zone` には `prevent_destroy` を付けてあるため、destroy しようとすると apply が止まる。

`terraform.tfvars` に書く値は次のとおり。

```hcl
account_id = "<Cloudflare の account ID>"
zone_id    = "<zone ID>"
zone_name  = "fukuemon.dev"
```

CI から実行する場合は Actions の **Terraform Apply** を `workflow_dispatch` で起動する。

`mode` を `plan` にすると plan で止まり、`apply` にすると同じ job の中で apply まで進む。
どちらの起動でも `infra` environment の承認を 1 回通す。

**差分を見てから適用するときは、`mode=plan` で 1 回起動して結果を読み、納得してから `mode=apply` で起動し直す。** plan file を job をまたいで渡さないのは、public repository の artifact から account ID と zone ID が漏れるためである。

## 現状

**3 つとも実行済みである。** 2026-08-31 に bootstrap を手元で apply し、Worker を deploy し、apply workflow から zone の import と custom domain の作成を行った。
`https://fukuemon.dev` が Worker `fukuemon-dev` を配信している。

残る未確認事項は [context/infrastructure.md](../context/infrastructure.md) の「未確認事項」に置く。
