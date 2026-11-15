# apps/docs-site

設計の文書（PRD、Design Doc、ADR）を Zensical でビルドし、`docs.fukuemon.dev` の Worker（`fukuemon-dev-docs`）から配信する。
決めたことと理由は ADR-0032 にある。

- ADR-0032: [ドキュメントサイトを Zensical でビルドし、custom domain だけで配信する](../../docs/adr/0032-docs-site-zensical.md)

## 構成

| ファイル                                      | 持つもの                                                                                                                                                                                                                     |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `zensical.toml`（リポジトリのルート）         | サイトの名前、`docs/` の読み方、ナビゲーション、Markdown の拡張                                                                                                                                                              |
| `pyproject.toml` と `uv.lock`（ルート）       | Zensical と Markdown の拡張のバージョン                                                                                                                                                                                      |
| `apps/docs-site/wrangler.jsonc`               | Worker の名前と静的アセットの置き場。`workers_dev` と `preview_urls` は `false`                                                                                                                                              |
| `apps/docs-site/scripts/check-closed-urls.sh` | `workers_dev` と `preview_urls` が `false` であること、`route` と `routes` が無いこと、ほかに wrangler の設定ファイルが無いこと、`deploy` が `wrangler deploy` だけで `predeploy` と `postdeploy` が無いこと、noindex の確認 |
| `apps/docs-site/public/_headers`              | レスポンスヘッダ。ビルドの後に `dist/` へコピーする                                                                                                                                                                          |
| `infra/cloudflare/workers_domain.tf`          | custom domain の `docs.<zone>`                                                                                                                                                                                               |
| `.github/workflows/deploy-docs.yml`           | develop で check が通ったときの配信                                                                                                                                                                                          |

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
apply workflow の起動と `infra` environment の承認は、[infra/README.md](../../infra/README.md#ci-から-apply-する) の「CI から apply する」の手順で行う。

### 1. Worker を作る

deploy-docs workflow は、develop で check が通るたびに Worker を配信する。
Worker がまだ無いときは、deploy-docs workflow を `workflow_dispatch` で `develop` から起動する。
`workers_dev` と `preview_urls` が `false` なので、この時点では誰も開けない。

### 2. custom domain を作る

1. apply workflow を `mode=plan` で起動し、plan が `cloudflare_workers_custom_domain.docs` の追加の 1 つだけを表示することを確認する。
   ほかの差分が出たら、apply しない。
2. 確認したら、`mode=apply` で起動し直す。

### 3. 公開の範囲を確認する

1. `https://docs.fukuemon.dev` を開き、PRD、Design Doc、ADR のページと Mermaid の図が出ることを確認する。
2. `curl -sI https://fukuemon-dev-docs.<アカウントの workers.dev のサブドメイン>.workers.dev` を実行し、ドキュメントサイトの HTML が返らないことを確認する。返るステータスコードは未確認である。
3. バージョンごとの URL（`https://<バージョンの ID の先頭 8 文字>-fukuemon-dev-docs.<サブドメイン>.workers.dev`）にも、`curl -sI` を実行する。バージョンの ID は `wrangler deployments list` で出る。

- ADR-0032: [承認の条件](../../docs/adr/0032-docs-site-zensical.md#承認の条件)
