# ADR-0005: Cloudflare Workers Static Assets を採用し、基盤を Terraform、deploy を Wrangler が管理する

## 状態

承認

## 決定日

2026-08-26

## 背景

- 本サイトは完全静的で、実行時のサーバーコンポーネントを持たない。
  Worker はハンドラを持たず静的アセットの配信のみを行う。
- Cloudflare は Pages から Workers Static Assets への移行を推奨経路としている。`wrangler pages deploy` の失敗メッセージは "Workers are the recommended way to deploy all new projects" と Workers を勧める。
- kufu-apps は稼働中の Pages を継続し、Workers 移行を別 issue へ送った。**本プロジェクトは新規のためその分岐を経ずに始められる。**
  - kufu-apps `adr/0019-terraform-monorepo-consolidation.md` — infra code を monorepo へ集約する決定
  - kufu-apps `adr/0020-cloudflare-terraform-wrangler-boundary.md` — Terraform / Wrangler の管轄分担
- kufu-apps ADR-0001 は infra code を別リポジトリへ置くと決めたが、3 か月間 `.tf` が 1 つも書かれず、ADR-0019 が monorepo へ集約し直した。**分離は、そこへ変更を書き込む頻度と担当があって初めて機能する。**
- 運用者は 1 名で、レビューによる職務分離が成立しない。
- Terraform provider `cloudflare/cloudflare` の latest は 5.24.0 (2026-08-24 公開)。
  認証は `CLOUDFLARE_API_TOKEN`。
- provider 5.11.0 以降は `cloudflare_workers_script` の `assets = { directory = ... }` で静的アセットを Terraform から配れる。

## 決定

### 1. Cloudflare Workers Static Assets を採用する

Pages を採らない。**Workers を選ぶことで 2 つの問題が最初から消える。**

| Pages の問題                                                                                                                                          | Workers での状況                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `wrangler pages deploy` は project を自動作成せず、非対話では `UserError` で失敗する。初回に運用者の手動操作 (`wrangler pages project create`) が要る | `wrangler deploy` が Worker を作成する。手動の事前作成手順が不要になる |
| `cloudflare_pages_project` の `deployment_configs` が secret / binding を内包し、Terraform 管理と Wrangler の secret 投入が衝突する                   | Worker script を Terraform で管理しない方針のため衝突しない            |

将来 `/api/*` にハンドラを足すとき、**同一 Worker へのハンドラ追加だけで済む。** Pages では Pages Functions という別の仕組みを経由することになる。

### 2. infra code を本 repo に置く

`infra/` を repo ルート直下に置く。`packages/` に入れない (`packages/` は app から import される場所で、infra はどこからも import されない)。
実行は root script から行う。

```text
infra/
├── README.md        # apply 手順 / bootstrap の順序 / 権限
├── bootstrap/       # state 置き場の R2 バケット。初回 1 回。state はローカルで commit しない
└── cloudflare/      # 本体。provider.tf / vars.tf / <subject>.tf
```

- state の key に scope を含める (`cloudflare/main/terraform.tfstate`)。
  後から兄弟の state を足すとき既存 state のリネームを避けられる。
- **`modules/` を作らない。** Cloudflare Terraform Best Practices が「モジュールは避ける (使うとしても控えめに)」と定める。
  対象は 1 アカウント / 1 zone / 1 サイトで括り出す重複がない。
  同じ形が 2 箇所以上に実在するまで作らない。
- **環境をディレクトリで分けない。** staging を持たない。

### 3. Terraform と Wrangler で管轄を分ける

> **基盤設定を Terraform、アプリの deploy と runtime 設定を Wrangler が管理する。1 つのリソースを両方から管理しない。**

判断できない新規リソースは次の順で判定する。

1. **データを保持するか。
   保持するなら Terraform。** 消えると復旧できないリソースを、deploy のたびに動く経路から切り離す
2. deploy のたびに変わるか。
   変わるなら Wrangler
3. 変わらない場合、その変更が本番の可用性またはドメイン到達性に影響するか。
   影響するなら Terraform
4. どちらでもない場合、Terraform を既定とする

| リソース                                                   | 管轄                                        |
| ---------------------------------------------------------- | ------------------------------------------- |
| Zone / DNS record / TLS                                    | Terraform                                   |
| Workers custom domain (`cloudflare_workers_custom_domain`) | Terraform                                   |
| R2 バケット (Terraform state 用)                           | Terraform (`infra/bootstrap/`)              |
| Worker script + static assets                              | Wrangler                                    |
| deployment                                                 | Wrangler                                    |
| runtime secret                                             | Wrangler                                    |
| レスポンスヘッダ (`_headers`)                              | Wrangler (配信物の一部)                     |
| binding / データ本体 (D1 / KV / R2)                        | binding は Wrangler、データ本体は Terraform |

**`cloudflare_workers_script` を使わない。** 使うと deploy が Terraform 経由になり、apply 権限が日常の CI へ降りる。

### 4. runtime secret を Terraform state に載せない

値は `wrangler secret put` で投入し、手動起動の特権 workflow または運用者のローカル実行に限る。
Terraform は secret の**名前**のみを扱う。

### 5. credential を 2 系統に分ける

- 通常の deploy workflow: push を起点に自動実行。
  deploy scope に限定した token のみを持つ
- apply workflow: 手動起動 (`workflow_dispatch`) + GitHub environment protection rules。
  apply 用 token を持つ

**1 名体制でも効く分離は 2 つである。** apply が自動実行されず手動起動という明示的な行為を伴うこと、通常の CI が apply 用 credential を持たないこと。
レビューによる職務分離は成立しないため `CODEOWNERS` は設定しない。

### 6. bootstrap 順序

`cloudflare_workers_custom_domain` は Worker の存在を前提とする。

1. `infra/bootstrap/` apply — state 用 R2 バケット作成 (state はローカル)
2. `wrangler deploy` — Worker script + assets を作成
3. `infra/cloudflare/` apply — custom domain + DNS (state は R2 backend)

### 確認済み (2026-08-25 / 26)

- Terraform provider の latest は **5.24.0**。
- **`cloudflare_workers_custom_domain` の必須項目は `account_id` / `hostname` / `service` の 3 つである。`environment` は Optional かつ Deprecated に変わっている。** provider 5.4.0 で報告された「Wrangler で assets 付き Worker を deploy すると `environment` の不一致で 404 になる」問題 (cloudflare/terraform-provider-cloudflare#5618) は、この schema 変更により前提が解消されている。
- **`service` は Worker 名の文字列参照である。** Pages の `cloudflare_pages_domain.project_name` と同じ構造であり、script を Terraform 管理下に置かずに custom domain だけを管理できる。

### 未確認

- `cloudflare_workers_custom_domain` が Wrangler deploy 済みの Worker へ実際に紐付くか (schema 上は解消済みだが実 apply が未実施)
- R2 backend の `skip_s3_checksum` で state 書き込みが通るか。
  HashiCorp は S3 互換ストレージを best effort とし Amazon S3 でしかテストしていない

## 代替案

### 1. すべてを Terraform で管理する (`cloudflare_workers_script` を使う)

#### Pros

- 管理ツールが 1 つに揃う。
  すべての変更が `terraform plan` の差分に現れる。

#### Cons

- deploy のたびに Terraform を実行することになり、apply 権限が日常の CI に降りる。
  credential 分離の目的を損なう。
- Worker の binding / secret を Terraform が持つことになり、state が機密になる。
- provider 5.11.0 の assets 対応には既知の不具合報告がある。

### 2. すべてを Wrangler と Dashboard で管理する

#### Pros

- 初期セットアップが最速。
  Terraform の学習と state 運用が不要。

#### Cons

- DNS、custom domain がコード管理されない。
  変更履歴・review・再現性が失われる。
  成功条件 S6 を満たさない。

### 3. Cloudflare Pages を使う

#### Pros

- 静的サイトの標準的な選択肢で、情報が多い。

#### Cons

- 上記「決定 1」の 2 つの問題を最初から抱える。
- 将来 `/api/*` を足すとき Pages Functions という別の仕組みが要る。
- Cloudflare 自身が新規は Workers を勧めている。

### 4. infra code を別リポジトリへ分ける

#### Pros

- app 開発導線から apply 権限と credential を物理的に遠ざけられる。
- UI 変更と infra 変更のレビュー観点が混ざらない。

#### Cons

- kufu-apps で同じ判断をした結果、3 か月間 `.tf` が 1 つも書かれず、分離のコストだけを払って利益を受け取らない状態が続いた。
  運用者が 1 名で書き込み頻度が低い本プロジェクトでは同じ結末になる可能性が高い。
- 分離が守ろうとした「apply 権限を日常の CI から遠ざける」は、決定 5 の credential 2 系統で repo を分けずに達成できる。

## 外部依存の健全性

| 項目                                                | 採用候補 (Workers Static Assets)                  | 代替案 (Pages)                              |
| --------------------------------------------------- | ------------------------------------------------- | ------------------------------------------- |
| 最終公開日                                          | provider 5.24.0 (2026-08-24)                      | 同 provider                                 |
| 対象バージョンへの対応 (peer dependency / 動作要件) | Astro は Workers 上で GA。`wrangler.jsonc` を使う | Pages Functions は Secrets Store 非対応     |
| 後継・代替の有無                                    | Cloudflare の推奨経路                             | 廃止告知はないが新規は Workers を勧められる |

## 影響

### 良い影響

- 初回構築の手動手順が Pages より 1 つ少ない。
- `/api/*` の追加が同一 Worker へのハンドラ追加で済む。
- Terraform state に機密が入らないため、state backend の保護要件が下がる。
- 日常の deploy が Terraform を経由しないため、UI 変更の PR に infra 差分が混ざらない。

### 悪い影響 / トレードオフ

- 管理ツールが 2 つになり、「どちらが管轄か」を都度判断する必要がある。
  判定手順と管轄表を維持する運用コストがかかる。
- Worker の設定 (compatibility date、binding) が Terraform の差分に現れない。`wrangler.jsonc` が実質の正本となり、レビュー対象として扱う必要がある。
- 初回に Wrangler deploy → Terraform apply の順序制約がある。
- secret の投入が自動化されず、更新時に手動操作が要る。
- **将来 `/api/*` にハンドラを足したとき、その変更は通常の PR に含まれ merge で自動 deploy される。** apply workflow のような明示的な行為を挟まない。
  repo をどう分けても解けない (Worker のコードは app 側にあるため)。
  緩和は通常の PR レビューと自動テストに依存する。

### 影響範囲

- 対象モジュール / package: `infra/`、`apps/web` (`wrangler.jsonc` / `public/_headers`)

## 実装・運用への反映

- spec 更新要否: 要 (bootstrap 3 手順と、未確認 2 点の検証を Phase 1 の spec に含める)
- context / AI 向け設定更新要否: 要。
  [context/infrastructure.md](../context/infrastructure.md) に管轄表・bootstrap 手順・credential 2 系統・値の受け渡しを記載する

## 関連ドキュメント / チケット

- [context/infrastructure.md](../context/infrastructure.md): 管轄表と手順の正本
- [ADR-0006](0006-interactive-content-levels.md): `_headers` によるパス単位の cross-origin isolation
- kufu-apps `adr/0019` / `adr/0020`: 管轄分担と判定手順の参照元
- [Cloudflare: Migrate from Pages to Workers](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/)
- [Cloudflare Terraform Best Practices](https://developers.cloudflare.com/terraform/advanced-topics/best-practices/)
- [cloudflare/terraform-provider-cloudflare#5618](https://github.com/cloudflare/terraform-provider-cloudflare/issues/5618)
