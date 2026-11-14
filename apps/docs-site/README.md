# apps/docs-site

設計の文書（PRD、Design Doc、ADR）を Zensical でビルドし、`docs.fukuemon.dev` の Worker（`fukuemon-dev-docs`）から配信する。
Cloudflare Access が、許可したメールアドレスの人だけを通す。
決めたことと理由は ADR-0032 にある。

- ADR-0032: [ドキュメントサイトを Zensical でビルドし、Cloudflare Access を Terraform で設定する](../../docs/adr/0032-docs-site-behind-access.md)

## 構成

| ファイル                                      | 持つもの                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------- |
| `zensical.toml`（リポジトリのルート）         | サイトの名前、`docs/` の読み方、ナビゲーション、Markdown の拡張                 |
| `pyproject.toml` と `uv.lock`（ルート）       | Zensical のバージョン                                                           |
| `apps/docs-site/wrangler.jsonc`               | Worker の名前と静的アセットの置き場。`workers_dev` と `preview_urls` は `false` |
| `apps/docs-site/scripts/check-closed-urls.sh` | `workers_dev` と `preview_urls` が `false` であることと、noindex の確認         |
| `apps/docs-site/public/_headers`              | レスポンスヘッダ。ビルドの後に `dist/` へ写す                                   |
| `infra/cloudflare/access.tf`                  | Access のアプリケーションとポリシー                                             |
| `infra/cloudflare/workers_domain.tf`          | custom domain の `docs.<zone>`                                                  |
| `.github/workflows/deploy-docs.yml`           | develop で check が通ったときの配信                                             |

- `zensical.toml` はリポジトリのルートに置く。Zensical は、設定ファイルのディレクトリの外にある `docs_dir` を読まない。
- `pyproject.toml` と `uv.lock` もルートに置く。`zensical.toml` と同じ場所で uv が依存を解決し、buddy と配置がそろう。
- Design Doc を足すときは、`docs/design/` のシンボリックリンク、`zensical.toml` の `nav` と `watch` の 3 か所を直す。
- サイトに載せる文書は、`docs/` の下と、`docs/design/` のシンボリックリンクが指す Design Doc である。`context/` とカタログは載せない。
- ADR は、ナビゲーションに 1 本ずつ並べず、`docs/adr/index.md` から辿る。

## ビルドする

```sh
pnpm --filter @fukuemon/docs-site run build
```

- 出力は `apps/docs-site/dist/` に出る。
- 手元で開くときは `pnpm --filter @fukuemon/docs-site run dev` を流す。
- ビルドは警告を出すが、終了コードは 0 になる。警告は、次の 2 つのリンクがサイトの中で解決できないことを示す。
  - `context/` やコードのファイルへのリンク。サイトに載せないためである。
  - シンボリックリンクの先の Design Doc に書いた相対リンク。リンクは元のファイルの場所から書いてあり、`docs/design/` の下からは別の場所を指す。
- Python は uv が用意する。`uv` のバージョンは `mise.toml` にある。

## 初めて公開する

運用者が、次の順で行う。
custom domain の apply は、Worker があることを前提にする。

### 1. Zero Trust を有効にする

Zero Trust の組織は Terraform で作らず、最初の 1 回だけダッシュボードで作る。
組織を作る操作で、プランの選択（Free）と team の名前の決定を求められるためである。

1. Cloudflare のダッシュボードで Zero Trust を開き、team の名前を決める。
2. プランは Free を選ぶ。
3. 「Settings → Authentication」の Login methods に One-time PIN があることを確認する。無ければ足す。

Terraform の provider には組織のリソース（`cloudflare_zero_trust_organization`）があるが、組織を新しく作れるかは未確認である。

### 2. apply 用の token に権限を足す

`TF_CLOUDFLARE_API_TOKEN` に、`Account / Access: Apps and Policies / Edit` を足す。

- provider の schema は、`cloudflare_zero_trust_access_policy` に `Access: Apps and Policies Write` の権限を求めると書いている。ダッシュボードでの表示の名前は未確認である。
- deploy 用の `CLOUDFLARE_API_TOKEN` には足さない。

### 3. 許可するメールアドレスを登録する

GitHub の `infra` environment の secret に `DOCS_ALLOWED_EMAILS` を登録する。
値は `["a@example.com", "b@example.com"]` の形のリストを 1 行で書く。
この形は HCL のリストとしても JSON としても読める。
apply workflow は、値を JSON として読み、メールアドレスを 1 件ずつログで伏せる。
メールアドレスは、リポジトリ、issue、pull request に書かない。

手元で plan するときは、`infra/cloudflare/terraform.tfvars` に `docs_allowed_emails` を書く。

### 4. Worker を作る

deploy-docs workflow を `workflow_dispatch` で `develop` から起動する。
`workers_dev` と `preview_urls` が `false` なので、この時点では誰も開けない。

### 5. Access と custom domain を作る

apply workflow を `mode=plan` で起動し、plan が次の 3 つの追加だけを表示することを確認する。

- `cloudflare_zero_trust_access_policy.docs`
- `cloudflare_zero_trust_access_application.docs`
- `cloudflare_workers_custom_domain.docs`

確認したら、`mode=apply` で起動し直す。
custom domain は Access のアプリケーションに `depends_on` を持つので、Access の後に作られる。

`depends_on` が守るのは、作る順と消す順だけである。
後の apply で、plan が `cloudflare_zero_trust_access_application.docs` を `must be replaced` と表示したら、apply しない。
置き換えは Access を消してから作るので、custom domain が認証なしで開ける時間ができる。

### 6. 開けないことを確認する

ADR-0032 の承認の条件の 1 つ目（custom domain のほかの URL で開けないこと）は、公開の後にしか確認できない。

1. 認証していないブラウザで `https://docs.fukuemon.dev` を開き、Access の認証の画面が出ることを確認する。
2. `curl -sI https://fukuemon-dev-docs.<アカウントの workers.dev のサブドメイン>.workers.dev` が、ドキュメントサイトを返さないことを確認する。
3. バージョンごとの URL（`https://<バージョンの ID の先頭 8 文字>-fukuemon-dev-docs.<サブドメイン>.workers.dev`）にも、同じく `curl -sI` を流す。バージョンの ID は `wrangler deployments list` で出る。
4. 許可したメールアドレスで認証し、PRD、Design Doc、ADR のページと Mermaid の図が出ることを確認する。

## 許可するメールアドレスを変える

1. `infra` environment の secret `DOCS_ALLOWED_EMAILS` を書き換える。
2. apply workflow を `mode=plan`、`mode=apply` の順で起動する。

Access のポリシーの変更に apply が要るのは、ADR-0032 の Negative に書いたとおりである。
