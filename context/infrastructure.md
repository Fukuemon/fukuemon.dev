---
type: context
title: Infrastructure & Operations
description: Cloudflare リソースの Terraform / Wrangler 管轄表、bootstrap 順序、credential 分離、レスポンスヘッダ、バックエンドを足す条件。
keywords:
  [
    Cloudflare Workers,
    Static Assets,
    Terraform,
    Wrangler,
    R2 backend,
    _headers,
    cross-origin isolation,
    secret,
  ]
governs:
  - infra/
  - apps/web/wrangler.jsonc
  - apps/web/public/_headers
verified_commit: unverified
---

# Infrastructure & Operations

Cloudflare リソースの管轄と運用手順。
判断の理由は [ADR-0005](../adr/0005-workers-terraform-wrangler-boundary.md)。

## Infrastructure / Deployment

**Cloudflare Workers Static Assets で配信する。** Worker はハンドラを持たず、静的アセットの配信のみを行う。

```mermaid
flowchart LR
    push["git push"] --> ci["deploy workflow (自動)"]
    ci -->|"deploy scope の token"| wd["wrangler deploy"]
    wd --> worker["Worker script + assets"]
    manual["運用者が手動起動"] --> env["environment protection rules"]
    env -->|"apply 用 token"| tf["terraform apply"]
    tf --> base["Zone / DNS / custom domain / R2"]
    ci -. "到達しない" .-x base
```

設定ファイルは **`wrangler.jsonc`** を使う。
Cloudflare は新規プロジェクトへ JSONC を推奨しており、一部の新機能は JSON 形式でのみ使える。

## Infrastructure Contract (Terraform / Wrangler 管轄表)

> **基盤設定を Terraform、アプリの deploy と runtime 設定を Wrangler が管理する。1 つのリソースを両方から管理しない。**

**このファイルが管轄の運用上の正本である。** リソースが増減したらこの表を更新する。

| リソース                                                   | 管轄                           | 状態     |
| ---------------------------------------------------------- | ------------------------------ | -------- |
| Zone / DNS record / TLS                                    | Terraform                      | 使う     |
| Workers custom domain (`cloudflare_workers_custom_domain`) | Terraform                      | 使う     |
| R2 バケット (Terraform state 用)                           | Terraform (`infra/bootstrap/`) | 使う     |
| Worker script + static assets                              | Wrangler                       | 使う     |
| deployment                                                 | Wrangler                       | 使う     |
| レスポンスヘッダ (`_headers`)                              | Wrangler (配信物の一部)        | 使う     |
| runtime secret                                             | Wrangler                       | 該当なし |
| binding (D1 / KV / R2)                                     | Wrangler (`wrangler.jsonc`)    | 該当なし |
| D1 / KV / R2 (データ本体)                                  | Terraform                      | 該当なし |

### 管轄が判断できない新規リソースの判定順序

1. **データを保持するか。
   保持するなら Terraform。** 消えると復旧できないリソースを、deploy のたびに動く経路から切り離す
2. deploy のたびに変わるか。
   変わるなら Wrangler
3. 変わらない場合、その変更が本番の可用性またはドメイン到達性に影響するか。
   影響するなら Terraform
4. どちらでもない場合、Terraform を既定とする (変更履歴と review を残せるため)

### `cloudflare_workers_script` を使わない

provider 5.11.0 以降は `assets = { directory = ... }` で静的アセットを Terraform から配れるが、**使うと deploy が Terraform 経由になり apply 権限が日常の CI へ降りる。**

### 値の受け渡し

Terraform が作ったリソースの識別子 (R2 のバケット名、D1 の database id) を Wrangler へ渡す必要がある。**現時点で該当するリソースは無い。** データを保持するリソースが 2 つ目になる前に、受け渡しの方法をこのファイルに定める。

## ディレクトリ構成

```text
infra/
├── README.md        # apply 手順 / bootstrap の順序 / 権限
├── bootstrap/       # state 置き場の R2 バケット。初回 1 回。state はローカルで commit しない
│   ├── provider.tf
│   ├── r2_state_bucket.tf
│   └── vars.tf
└── cloudflare/      # 本体
    ├── provider.tf  # terraform{} + backend (R2) + provider
    ├── vars.tf
    ├── dns.tf
    └── workers_domain.tf
```

- ファイル命名は `provider.tf` / `<subject>.tf` / `vars.tf` の 3 種に揃える (Cloudflare Terraform Best Practices)。
- **`modules/` を作らない。** 対象が 1 アカウント / 1 zone / 1 サイトで括り出す重複がない。
  同じ形が 2 箇所以上に実在するまで作らない。
- **環境をディレクトリで分けない。** staging を持たない。
- **`infra/` は workspace package ではない。** 実行は root script から行う。

## bootstrap 順序

`cloudflare_workers_custom_domain` は Worker の存在を前提とする。**順序を誤ると 3 が失敗する。**

1. `infra/bootstrap/` を apply — state 用 R2 バケットを作る (state はローカル。
   commit しない。
   失った場合は `terraform import` で回復する)
2. `wrangler deploy` — Worker script + assets を作る。**Pages と異なり事前の手動作成は不要である**
3. `infra/cloudflare/` を apply — custom domain + DNS を作る (state は R2 backend)

## state backend

R2 は S3 互換だが AWS ではない。`s3` backend は STS / IAM / metadata API を前提にする箇所があるため検証を切る。

```hcl
backend "s3" {
  bucket = "<state バケット名>"
  key    = "cloudflare/main/terraform.tfstate"
  region = "auto"
  endpoints = { s3 = "https://<ACCOUNT_ID>.r2.cloudflarestorage.com" }

  skip_credentials_validation = true # STS が無い
  skip_region_validation      = true # auto は AWS のリージョン名でない
  skip_requesting_account_id  = true # IAM / STS / metadata API が無い
  skip_s3_checksum            = true # R2 のチェックサム対応が限定的
  use_path_style              = true
  use_lockfile                = true # state ロックを S3 側のオブジェクトで取る
}
```

**state の key に scope を含める** (`cloudflare/main/terraform.tfstate`)。
後から兄弟の state を足すとき、既存 state のリネームを避けられる。

## Environment Strategy

**環境は本番 1 つのみ。** staging を持たない。

- Cloudflare アカウントは 1 つ、zone は 1 つ。
- preview deployment は Wrangler の機能として使えるが、Terraform の管轄には入れない。
- 環境をディレクトリで分ける構成 (`envs/staging/`) を採らない。
  Cloudflare Terraform Best Practices は環境分離を別アカウント + 別ドメインで行うよう定めており、同一アカウント内でのディレクトリ分割は意味を持たない。

## Security

### credential を 2 系統に分ける

| 経路            | 起動                                                                 | token の scope                                                     |
| --------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| deploy workflow | push で自動                                                          | deploy に必要な scope のみ。apply 権限と secret 投入権限を含めない |
| apply workflow  | `workflow_dispatch` の手動起動 + GitHub environment protection rules | Terraform apply 用                                                 |

**1 名体制で実際に効く分離は 2 つである。** apply が自動実行されず手動起動という明示的な行為を伴うこと、通常の CI が apply 用 credential を持たないこと。
レビューによる職務分離は成立しないため `CODEOWNERS` は設定しない。

### secret を Terraform state に載せない

- 値は `wrangler secret put` で投入する。
  日常の deploy workflow から行わない。
- Terraform は secret の**名前**のみを変数として扱い、値を扱わない。
- 認証情報 (R2 の access key 等) は Terraform 外で発行し、GitHub Actions の secret に登録する。

**現時点で runtime secret は存在しない。**

### 文書と commit に書かないもの

- secret / 認証情報 / トークンの実値
- 個人 PC の絶対パス (`$(ghq root)` 等で動的に解決する)
- Cloudflare の account ID / zone ID の実値 (`vars.tf` の変数として渡す)

## レスポンスヘッダ

`apps/web/public/_headers` に置き、build 成果物として `dist/` へ入る。
Workers Static Assets が解釈する。

**cross-origin isolation をサイト全体に掛けない。** 掛けると CORP を返さない第三者リソースが一律でブロックされる。
2026-08-26 に実測で確認した。

| リソース                            | `cross-origin-resource-policy` | `COEP: require-corp` 下 |
| ----------------------------------- | ------------------------------ | ----------------------- |
| `fonts.gstatic.com`                 | `cross-origin`                 | 読める                  |
| CORP を返さない第三者の埋め込み     | なし                           | **ブロックされる**      |

isolation は取り消しの効かない方向の制約である。
全体へ掛けると、第三者リソースを使いたくなるたびに、そのリソースが CORP を返すかどうかに実現可能性を握られる。

isolation が要るのは `/playground/*` だけである ([ADR-0006](../adr/0006-interactive-content-levels.md))。

```
# 該当する playground が実在してから記述する
/playground/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

## バックエンドを足す条件

**現時点でバックエンドを持たない。** Hono / D1 / KV / 認証を構成に含めない。
理由は [ADR-0008](../adr/0008-no-reader-identity.md)。

| 条件                                           | 想定される形                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| Contact form の送信受け口が要るとき            | 同一 Worker の `/api/contact` に POST 1 本                               |
| ビルド時に解決できない検索が要ると判明したとき | まず静的 embedding 索引 + クライアント検索を試し、それで足りないときのみ |

条件を満たさないうちは足さない。`/api/*` の URL 予約は維持する (予約のコストはゼロで、成立時に URL 設計をやり直さずに済む)。

**足すときに発生する infra の変更**: データを保持するリソース (D1 / KV / R2) が Terraform 管轄に加わり、binding が `wrangler.jsonc` に加わる。
値の受け渡しをこのファイルに定める。

## Operations / Observability

- **Worker のコード変更は通常の PR に含まれ、merge で自動 deploy される。** apply workflow のような明示的な行為を挟まない。
  repo をどう分けても解けない (コードが app 側にあるため)。
  緩和は PR レビューと自動テストに依存する。
- 現時点で Worker はハンドラを持たないため、この欠点の範囲は静的アセットの誤配信に限られる。
- アクセス解析が要る場合は Cloudflare Web Analytics を使う。
  自前のログ収集エンドポイントを作らない。

## 未確認事項

| #   | 内容                                                                                                                                           | 確認時期      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 1   | `cloudflare_workers_custom_domain` が Wrangler deploy 済みの Worker へ実際に紐付くか                                                           | 初回 apply 時 |
| 2   | R2 backend の `skip_s3_checksum` で state 書き込みが通るか。HashiCorp は S3 互換ストレージを best effort とし Amazon S3 でしかテストしていない | 初回 apply 時 |

1 は provider 5.24.0 で `environment` が Optional かつ Deprecated に変わり、schema 上の前提は解消済みである (cloudflare/terraform-provider-cloudflare#5618)。
実 apply が未実施のため未確認として残す。

## 参照

- [ADR-0005](../adr/0005-workers-terraform-wrangler-boundary.md): 管轄分担と Workers 採用の理由
- [ADR-0006](../adr/0006-interactive-content-levels.md): `/playground/*` の isolation
- [ADR-0008](../adr/0008-no-reader-identity.md): バックエンドを持たない決定
- [architecture.md](architecture.md): URL 規約と State Boundary
- [project.yml](project.yml): commands の固有値
- [Cloudflare Terraform Best Practices](https://developers.cloudflare.com/terraform/advanced-topics/best-practices/)
