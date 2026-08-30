# infra

Cloudflare の基盤リソースを Terraform で管理する。
管轄の分担とその理由は [context/infrastructure.md](../context/infrastructure.md) と [ADR-0005](../adr/0005-workers-terraform-wrangler-boundary.md) が正本である。

Worker script と静的アセットの deploy は Wrangler の管轄であり、ここには入らない。

## 構成

| ディレクトリ  | 対象                          | state の置き場           | 実行者                     |
| ------------- | ----------------------------- | ------------------------ | -------------------------- |
| `bootstrap/`  | state 用の R2 バケット        | ローカル (commit しない) | 運用者が手元で 1 回        |
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
  R2 の画面の Account Details から API Tokens → Manage で発行する。
  権限は上と同じ表に従い、state バケットに限定する。
  secret access key は作成直後にしか表示されない。

**deploy workflow の token と分ける。** 置き場と scope は [context/infrastructure.md](../context/infrastructure.md) の credential の表に従う。

最小権限が確かめられていない点は、同じファイルの「未確認事項」の 3 から 5 に置く。

変数の値は各ディレクトリの `terraform.tfvars` に置く。
`.gitignore` が `*.tfvars` を無視するため commit されない。

## 実行順序

`cloudflare_workers_custom_domain` は Worker の存在を前提とする。
**順序を誤ると 3 が失敗する。**

### 1. state 置き場を作る

初回に 1 回だけ実行する。
この段の state はローカルに残る。
失った場合は `terraform import` で回復する。

```sh
export CLOUDFLARE_API_TOKEN=<apply 用の token>
cd infra/bootstrap
terraform init
terraform apply
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

**zone は Cloudflare Registrar がドメイン取得時に作っている。** Terraform では作らず、既存の zone を state へ取り込む。
ネームサーバは既に Cloudflare を向いているため、レジストラ側の設定は要らない。

backend の設定は account ID を含むため commit しない。
bucket 名は `-backend-config` で、endpoint は `AWS_ENDPOINT_URL_S3` で渡す。
apply workflow も同じ形で渡す。

```sh
export CLOUDFLARE_API_TOKEN=<apply 用の token>
export AWS_ACCESS_KEY_ID=<R2 の access key id>
export AWS_SECRET_ACCESS_KEY=<R2 の secret access key>
export AWS_ENDPOINT_URL_S3=https://<Cloudflare の account ID>.r2.cloudflarestorage.com
cd infra/cloudflare
terraform init -backend-config="bucket=<1 で作ったバケット名>"
terraform import cloudflare_zone.site <zone ID>
terraform plan
terraform apply
```

zone ID は Cloudflare の Overview 画面の右側にある。

**`terraform plan` が zone に差分を出さないことを確かめてから apply する。** 差分が出る場合は、実際の zone 設定に合わせて `zone.tf` を直す。
`cloudflare_zone` には `prevent_destroy` を付けてあるため、destroy しようとすると apply が止まる。

`terraform.tfvars` に書く値は次のとおり。

```hcl
account_id = "<Cloudflare の account ID>"
zone_name  = "fukuemon.dev"
```

import は手元で 1 回だけ行う。
以後 CI から実行する場合は Actions の **Terraform Apply** を `workflow_dispatch` で起動する。
`mode` を `plan` にすると plan で止まり、`apply` にすると apply まで進む。
`infra` environment の protection rules を通る。

## 現状

**まだ 1 度も apply していない。** ドメインは Cloudflare Registrar で取得済みであり、zone は既に存在する。

未確認事項は [context/infrastructure.md](../context/infrastructure.md) の「未確認事項」に置く。
