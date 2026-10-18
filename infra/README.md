# infra

Cloudflare の基盤を Terraform で作り、変える手順。  
構成は [infra/DesignDoc.md](DesignDoc.md) に、管轄と apply の条件と credential の置き場は [context/operations.md](../context/operations.md) に、判断の理由は [ADR-0005](../adr/0005-workers-terraform-wrangler-boundary.md) にある。

## 前提

- Terraform 1.11 以上。
  `backend "s3"` の `use_lockfile` を使うため。
- apply 用の API token。
  権限は [context/operations.md](../context/operations.md#secrets) の token の権限の表に従う。
- R2 の S3 互換 access key。
  発行元と使う値は [context/operations.md](../context/operations.md#secrets) に従う。
  secret access key は作成直後にしか表示されない。

変数の値は各ディレクトリの `terraform.tfvars` に置く。
`.gitignore` が `*.tfvars` を無視するため commit されない。

## 初めて基盤を作る

`cloudflare_workers_custom_domain` は Worker の存在を前提とする。
**次の 1 から 3 の順を誤ると 3 が失敗する**。

### 1. state 用の R2 バケットを作る

初回に 1 回だけ、手元で実行する。
state を失ったときの戻し方は [context/operations.md](../context/operations.md#rollback) にある。

実行は repo root から root script で行う。

```sh
export CLOUDFLARE_API_TOKEN=<bootstrap 用の token>
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
事前に Worker を手で作る必要はない。

既定ブランチへ merge すれば deploy workflow が実行する。
手元から実行する場合は次のとおり。

```sh
pnpm --filter @fukuemon/web run build
pnpm --filter @fukuemon/web run deploy
```

### 3. zone を取り込み、custom domain を作る

`zone.tf` の `import` ブロックが zone を state へ取り込むので、手で `terraform import` を実行しない。
ネームサーバは既に Cloudflare を向いているため、レジストラ側の設定は要らない。
backend の値の渡し方の理由は [infra/DesignDoc.md](DesignDoc.md#state-backend) にある。

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

apply の前に、plan が出す zone の差分を [context/operations.md](../context/operations.md#deployment-conditions) の条件と照らす。

`terraform.tfvars` に書く値は次のとおり。

```hcl
account_id = "<Cloudflare の account ID>"
zone_id    = "<zone ID>"
zone_name  = "fukuemon.dev"
```

## CI から apply する

1. Actions の **Terraform Apply** を、`mode` を `plan` にして `workflow_dispatch` で起動する。
2. `infra` environment の承認を通し、plan の結果を読む。
3. 差分が [context/operations.md](../context/operations.md#deployment-conditions) の条件を満たせば、`mode` を `apply` にして起動し直し、もう一度承認を通す。
