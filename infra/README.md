# infra

Cloudflare の基盤リソースを Terraform で管理する。
管轄の分担とその理由は [context/infrastructure.md](../context/infrastructure.md) と [ADR-0005](../adr/0005-workers-terraform-wrangler-boundary.md) が正本である。

Worker script と静的アセットの deploy は Wrangler の管轄であり、ここには入らない。

## 構成

| ディレクトリ  | 対象                          | state の置き場           |
| ------------- | ----------------------------- | ------------------------ |
| `bootstrap/`  | state 用の R2 バケット        | ローカル (commit しない) |
| `cloudflare/` | zone と Workers custom domain | R2 (`bootstrap/` が作る) |

## 前提

- Terraform 1.11 以上。
  `backend "s3"` の `use_lockfile` を使うため。
- apply 用の API token。
  次の権限を持たせる。
  - Account / Workers R2 Storage / Edit (`bootstrap/`)
  - Account / Workers Scripts / Edit (custom domain)
  - Zone / Zone / Edit と Zone / DNS / Edit (zone)
- R2 の S3 互換 access key。
  `cloudflare/` の state backend が使う。
  Cloudflare の R2 画面で発行し、`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` として渡す。

**deploy workflow の token と分ける。** deploy 用の token に apply 権限を持たせない。
1 名体制で実際に効く分離は、apply が手動起動であることと、日常の CI が apply 用 credential を持たないことの 2 つである (ADR-0005)。

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

### 3. zone と custom domain を作る

backend の設定は account ID を含むため commit しない。
`infra/cloudflare/backend.tfvars` に置いて `-backend-config` で渡す。

```hcl
bucket = "<1 で作ったバケット名>"
endpoints = {
  s3 = "https://<Cloudflare の account ID>.r2.cloudflarestorage.com"
}
```

```sh
export CLOUDFLARE_API_TOKEN=<apply 用の token>
export AWS_ACCESS_KEY_ID=<R2 の access key id>
export AWS_SECRET_ACCESS_KEY=<R2 の secret access key>
cd infra/cloudflare
terraform init -backend-config=backend.tfvars
terraform apply
```

`terraform.tfvars` に書く値は次のとおり。

```hcl
account_id = "<Cloudflare の account ID>"
zone_name  = "<ドメイン名>"
```

### 4. ネームサーバを向ける

```sh
terraform output name_servers
```

出力された 2 つのネームサーバをレジストラへ設定する。
**zone が active になるまで custom domain は名前解決しない。**

## 現状

**まだ 1 度も apply していない。** ドメインが未取得であり、Cloudflare アカウントも未作成である。

未確認事項は [context/infrastructure.md](../context/infrastructure.md) の「未確認事項」に置く。
