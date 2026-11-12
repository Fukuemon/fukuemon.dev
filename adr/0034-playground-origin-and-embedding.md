# ADR-0034: プレイグラウンドのツールを 1 つのサブドメインに置き、cross-origin isolation のヘッダを Node の実行環境のパスと、それを埋め込む記事の URL にだけ返す

## Status

提案

## Context

Node の実行環境を置く origin と、記事に出す形と、cross-origin isolation のヘッダを返す範囲を決める必要がある。

- Node と npm の実行に WebContainers を採る。WebContainers は、cross-origin isolation を求める。
  - ADR-0033: [Node と npm の実行に WebContainers を採り、実行環境と画面の間をインターフェースで分ける](0033-webcontainers-for-node.md)
- 訪問者が書いたコードを動かすものと、サイトと違うレスポンスヘッダが要るものは、サブドメインに分ける。実行環境を置く origin と、isolation を掛ける URL は、実行環境の方式を決める ADR が決める。
  - ADR-0031: [サブドメインに分ける規則を決め、1 つのアプリを 1 つの Worker とホスト名に割り当てる](0031-subdomains-and-workers.md)
- 実行環境の埋め込み方は、有効な決定が無い。プレイグラウンドの一覧は、fukuemon.dev の `/playground` に置く。
  - ADR-0030: [種別を記事の 1 つにし、構成を記事の形式で、シリーズをディレクトリで表す](0030-articles-format-and-series.md)
- レスポンスヘッダは、Workers Static Assets の `_headers` でパスごとに指定する。
  - ADR-0005: [Cloudflare Workers Static Assets を採用し、基盤を Terraform、deploy を Wrangler が管理する](0005-workers-terraform-wrangler-boundary.md)
- `COEP: require-corp` のページでは、CORP を返さない別の origin の画像がブロックされる。`COEP` を返さない別の origin のドキュメントは、iframe に読み込まれない。
- プレイグラウンドには、コードの実行環境のほかに、キャンバスとスライドのエディタを置く見込みがある。キャンバスの候補の draw.io Embed Mode（`embed.diagrams.net`）は、`COEP` と `CORP` を返さない。
- AI のエージェントがツールを操作する API（WebMCP）を、後で足す見込みがある。ツールを登録するドキュメントがトップレベルである必要があるかは、未確認である。

## Decision

### 1. origin

コードの実行環境と、後で追加するツールを、プレイグラウンドという 1 つのアプリとして、1 つのサブドメインに置く。  
ツールは、サブドメインの中のパスで分ける。

- 訪問者のコードと、訪問者が作ったファイルが、fukuemon.dev が保存した値に届かない。
- 訪問者が複数のツールで作ったファイルを、同じ origin の保存先にまとめられる。
- どのツールも、トップレベルで開ける URL を持つ。fukuemon.dev の `/playground` の一覧からリンクする。AI のエージェントが操作する API を追加するときに、トップレベルのドキュメントから登録できる。

### 2. サブドメインのヘッダ

サブドメインでは、Node の実行環境のパスにだけ、次の 3 つを返す。

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Resource-Policy: cross-origin`

ほかのツールのパスには返さない。  
サブドメインの全体に返すと、`COEP` を返さない別の origin のドキュメントを使うツールが、同じサブドメインで動かないためである。

### 3. 記事への埋め込み

記事には、サブドメインのツールのページを iframe で埋め込む。

- fukuemon.dev は、Node の実行環境を埋め込む記事の URL にだけ、`COOP: same-origin` と `COEP: require-corp` を返す。親のページにヘッダが無いと、iframe の中の WebContainers が起動しないためである。
- ビルドのときに、Node の実行環境を埋め込む記事の URL を集め、`_headers` に書く。
- iframe に `allow="cross-origin-isolated"` を付ける。
- iframe は、訪問者がボタンを押してから作る。押すまで、実行環境の通信を出さない。
- isolation を求めないツールだけを埋め込む記事には、ヘッダを返さない。

Node の実行環境を埋め込む記事では、CORP を返さない外部の画像と、`COEP` を返さない外部の埋め込みを使えない。

## 承認の条件

- サブドメインに分ける規則の ADR が、プレイグラウンドを 1 つのアプリとして 1 つのホスト名に割り当て、Node の実行環境を埋め込む記事の URL に isolation のヘッダを返すことを認めること。
- サブドメインのホスト名を決めること。
- 記事に埋め込んだ iframe と、トップレベルで開いたページが、同じ保存先（IndexedDB）を読むこと。

## Verification

親のページに、別の origin で site が同じ実行環境のページを iframe で埋め込み、iframe の中の WebContainers の `boot` を記録した。  
端末は Apple M2、ブラウザは Playwright 1.65.0 の Chromium、WebKit、Firefox（headless）、配信は `localhost` である。  
iframe の側は、どの場合も `COOP: same-origin`、`COEP`、`CORP: cross-origin` を返した。

| 親のページのヘッダ                                             | Chromium   | WebKit     | Firefox    | 親のページの、CORP なしの外部の画像 |
| -------------------------------------------------------------- | ---------- | ---------- | ---------- | ----------------------------------- |
| なし                                                           | 起動しない | 起動しない | 起動しない | 読める                              |
| `COOP: same-origin` と `COEP: require-corp`                    | 起動する   | 起動する   | 起動する   | ブロックされる                      |
| `COOP: same-origin` と `COEP: credentialless`                  | 起動する   | 起動しない | 起動する   | 読める                              |
| `require-corp`。iframe に `allow="cross-origin-isolated"` なし | 起動しない | 起動しない | 起動する   | ブロックされる                      |

- 親が `require-corp` で iframe に `allow="cross-origin-isolated"` を付けた形で、iframe の中の認可コードフローが、Chromium と WebKit で最後まで通った。
- 記事の形のページで、ボタンを押してから iframe を作ると、開いた直後のリクエストは 1 つ、転送量は 2.9 KB で、実行環境なしのページと同じだった。押してから `boot` が終わるまでは 1.6 秒だった（Chromium）。
- 最初から iframe を作ると、転送量が 6.27 MB 増え、CLS が 0.027 になった（Lighthouse 13.6.0、mobile）。
- `COEP: require-corp` のページに、`COEP` を返さないドキュメントを iframe で入れた場合は、描画して確認していない。

## Considered Options

| 選択肢                                                                                                             | 強み                                                                                                                             | 弱み                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **採用:** ツールを 1 つのサブドメインに置き、ヘッダを Node の実行環境のパスと、それを埋め込む記事の URL にだけ返す | 記事の中で動かせる。埋め込まない記事と、ほかのツールのパスにヘッダが掛からない。訪問者のファイルが、サイトの保存した値と分かれる | Node の実行環境を埋め込む記事では、CORP を返さない外部の画像と埋め込みを使えない。ビルドのときに、埋め込む記事の URL を集める処理が要る。Worker が 1 つ増える |
| 記事にはリンクかボタンだけを置き、実行環境を別のページで開く                                                       | 記事のページにヘッダが要らない。外部の画像と埋め込みを、どの記事でも使える                                                       | 記事の中で動かせない。記事の文と実行環境を、並べて読めない                                                                                                    |
| isolation を求めない方式（Nodebox、almostnode）を埋め込む                                                          | 記事のページにヘッダが要らない                                                                                                   | Cookie を使うフローが通らない                                                                                                                                 |
| サブドメインの全体に isolation のヘッダを返す                                                                      | `_headers` をパスで書き分けない                                                                                                  | `COEP` を返さない別の origin のドキュメントを使うツールが、同じサブドメインで動かない                                                                         |
| ツールごとに、別のサブドメインに置く                                                                               | ツールごとに、ヘッダとデプロイのタイミングを分けられる                                                                           | 訪問者が作ったファイル、図、スライドの保存先が、origin ごとに分かれる。Worker と custom domain が、ツールの数だけ増える                                       |
| fukuemon.dev の `/playground/*` に置く                                                                             | Worker が増えない                                                                                                                | 訪問者のファイルと、サイトが保存する値が、同じ origin に入る                                                                                                  |

## Consequences

### Positive

- 訪問者は、記事を読みながら、同じページの中でコードを動かせる。
- 実行環境の読み込みが、記事の初回の表示を遅らせない。
- ツールを足すときに、Worker と custom domain を増やさずに、パスを足せる。

### Negative

- `_headers` で、fukuemon.dev の記事の URL と、サブドメインのパスの 2 か所のヘッダを管理する。誤って広く掛けると、外部の画像と埋め込みがブロックされる。
- 1 つの記事に、Node の実行環境と、draw.io Embed Mode のような `COEP` を返さない外部の埋め込みを並べられない見込みがある。
- `COOP: same-origin` を返す記事は、その記事から開いた別のウィンドウを参照できない。
- 1 つの Worker に、パスで複数のツールを載せるので、ツールごとにデプロイのタイミングを分けられない。
