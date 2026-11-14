# apps/docs-site

設計の文書（PRD、Design Doc、ADR）を Zensical でビルドし、`docs.fukuemon.dev` の Worker（`fukuemon-dev-docs`）から配信する。
Cloudflare Access がオンの間は、許可したメールアドレスの人だけを通す。
Access は、運営者がダッシュボードで設定する。
決めたことと理由は ADR-0032 にある。

- ADR-0032: [ドキュメントサイトを Zensical でビルドし、Cloudflare Access を運営者がダッシュボードで設定する](../../docs/adr/0032-docs-site-behind-access.md)

## 構成

| ファイル                                      | 持つもの                                                                                                                                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `zensical.toml`（リポジトリのルート）         | サイトの名前、`docs/` の読み方、ナビゲーション、Markdown の拡張                                                                                                                               |
| `pyproject.toml` と `uv.lock`（ルート）       | Zensical と Markdown の拡張のバージョン                                                                                                                                                       |
| `apps/docs-site/wrangler.jsonc`               | Worker の名前と静的アセットの置き場。`workers_dev` と `preview_urls` は `false`                                                                                                               |
| `apps/docs-site/scripts/check-closed-urls.sh` | `workers_dev` と `preview_urls` が `false` であること、`route` と `routes` が無いこと、ほかに wrangler の設定ファイルが無いこと、`deploy` が `wrangler deploy` だけであること、noindex の確認 |
| `apps/docs-site/public/_headers`              | レスポンスヘッダ。ビルドの後に `dist/` へコピーする                                                                                                                                           |
| `infra/cloudflare/workers_domain.tf`          | custom domain の `docs.<zone>`                                                                                                                                                                |
| `.github/workflows/deploy-docs.yml`           | develop で check が通ったときの配信                                                                                                                                                           |

- `zensical.toml` はリポジトリのルートに置く。Zensical は、設定ファイルのディレクトリの外にある `docs_dir` を読まない。
- `pyproject.toml` と `uv.lock` もルートに置く。uv は、`zensical.toml` と同じディレクトリで依存を解決する。
- サイトに載せる文書は、`docs/` の下（ADR のテンプレートとトップの試作を除く）と、`docs/design/` のシンボリックリンクが指す Design Doc とデザインシステムの文書である。`context/` とカタログは載せない。
- ADR は、ナビゲーションに 1 本ずつ並べず、`docs/adr/index.md` からリンクで開く。
- Design Doc とデザインシステムの文書を足すときは、`zensical.toml` の `nav` に足す。`docs/` の外に置く文書は、`docs/design/` にシンボリックリンクを置き、`zensical.toml` の `watch` にも足す。

## ビルドする

```sh
pnpm --filter @fukuemon/docs-site run build
```

- 出力は `apps/docs-site/dist/` に出る。
- 手元で開くときは `pnpm --filter @fukuemon/docs-site run dev` を実行する。
- ビルドは警告を出すが、終了コードは 0 になる。警告は、次の 2 つのリンクがサイトの中で解決できないことを示す。
  - `context/` やコードのファイルへのリンク。サイトに載せないためである。
  - シンボリックリンクの先の文書に書いた相対リンク。リンクは元のファイルの場所から書いてあり、`docs/design/` の下からは別の場所を指す。
- Python は uv が用意する。`uv` のバージョンは `mise.toml` にある。

## 初めて公開する

運用者が、次の順で行う。
Access のアプリケーションが無いまま custom domain を作ると、ドキュメントサイトを誰でも開ける。
このため、ダッシュボードで Access を作ってから、Terraform で custom domain を作る。
apply workflow の起動と `infra` environment の承認は、[infra/README.md](../../infra/README.md#ci-から-apply-する) の「CI から apply する」の手順で行う。

- ADR-0032: [アクセスの認証](../../docs/adr/0032-docs-site-behind-access.md#3-アクセスの認証)

### 1. Zero Trust を有効にする

Zero Trust の組織は、最初の 1 回だけダッシュボードで作る。

1. Cloudflare のダッシュボードで「Zero Trust」を開き、team の名前を決める。
2. プランは Free を選ぶ。Free でも、支払いの情報の入力を求められる。
3. Login methods に One-time PIN を足す。設定の画面の場所は未確認である。

- 出典: [Get started](https://developers.cloudflare.com/cloudflare-one/setup/)

### 2. Access のアプリケーションとポリシーを作る

1. 「Zero Trust → Access controls → Applications → Create new application」で「Self-hosted and private」を選ぶ。
2. 「Add public hostname」で、Domain に `docs.fukuemon.dev` を入れる。
3. 「Access policies」で、ポリシーを新しく作る。Action は「Allow」、Include の Selector は「Emails」にし、許可するメールアドレスを入れる。
4. 保存する。

- custom domain がまだ無いホスト名で、アプリケーションを作れるかは未確認である。作れないときは、ここで作業を止め、手順 4 で custom domain を作る前に Access を作る方法を決め直す。
- メールアドレスは、ダッシュボードのポリシーにだけ書く。リポジトリ、issue、pull request、GitHub の secret に書かない。
- 次の値を選ばない。誰でも通すか、広く通すポリシーになる。
  - Action の「Bypass」と「Service Auth」
  - Include の Selector の「Everyone」「Login Methods」「Emails ending in」
- Include は「Emails」の 1 行だけにする。
- 画面での Action と Selector の表示の名前は未確認である。
- 出典: [Publish a self-hosted application to the Internet](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-public-app/)
- 出典: [Access policies](https://developers.cloudflare.com/cloudflare-one/policies/access/)

### 3. Worker を作る

deploy-docs workflow は、develop で check が通るたびに Worker を配信する。
Worker がまだ無いときは、deploy-docs workflow を `workflow_dispatch` で `develop` から起動する。
`workers_dev` と `preview_urls` が `false` なので、この時点では誰も開けない。

### 4. custom domain を作る

手順 2 で Access のアプリケーションを作ってから行う。

1. apply workflow を `mode=plan` で起動し、plan が `cloudflare_workers_custom_domain.docs` の追加の 1 つだけを表示することを確認する。
   ほかの差分が出たら、apply しない。
2. 確認したら、`mode=apply` で起動し直す。

### 5. 公開の範囲を確認する

1. 認証していないブラウザで `https://docs.fukuemon.dev` を開き、Access の認証の画面が出ることを確認する。
   出なければ、ダッシュボードで、アプリケーションの Domain が `docs.fukuemon.dev` であることと、手順 2 のポリシーを確認する。
2. `curl -sI https://fukuemon-dev-docs.<アカウントの workers.dev のサブドメイン>.workers.dev` を実行し、ドキュメントサイトの HTML が返らないことを確認する。返るステータスコードは未確認である。
3. バージョンごとの URL（`https://<バージョンの ID の先頭 8 文字>-fukuemon-dev-docs.<サブドメイン>.workers.dev`）にも、`curl -sI` を実行する。バージョンの ID は `wrangler deployments list` で出る。
4. 許可したメールアドレスで認証し、PRD、Design Doc、ADR のページと Mermaid の図が出ることを確認する。

- ADR-0032: [承認の条件](../../docs/adr/0032-docs-site-behind-access.md#承認の条件)

## Access のオンとオフを切り替える

Access は、ダッシュボードで切り替える。
apply は要らない。

- オフにするときは、「初めて公開する」の手順 2 で作ったアプリケーションを消す。
- オンにするときは、「初めて公開する」の手順 2 をもう一度行い、手順 5 の 1 と 4 を確認する。
- **オフの間は、`https://docs.fukuemon.dev` を誰でも開ける。** noindex は返すが、検索の結果に載らないことは保証しない。

アプリケーションを消さずに無効にする設定があるかは、未確認である。

## 許可するメールアドレスを変える

ダッシュボードで、「初めて公開する」の手順 2 で作ったポリシーの Include のメールアドレスを書き換える。
外したメールアドレスで認証できないことを確認する。
apply は要らない。
