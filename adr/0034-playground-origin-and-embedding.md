# ADR-0034: cross-origin isolation のヘッダを、プレイグラウンドの Node の実行環境のパスと、それを埋め込む記事の URL にだけ返す

## Status

提案

## Context

プレイグラウンドのサブドメインの名前と、cross-origin isolation のヘッダを返す URL と、Node の実行環境を記事に表示する形を決める必要がある。

- Node と npm の実行に WebContainers を採る。WebContainers は、cross-origin isolation を求める。
  - ADR-0033: [Node と npm の実行に WebContainers を採り、実行環境と画面の間をインターフェースで分ける](0033-webcontainers-for-node.md)
- プレイグラウンドの全てのツールを、1 つのサブドメインの 1 つの Worker に置き、ツールごとにパスを分ける。isolation のヘッダは、isolation を求めるツールのパスにだけ返す。fukuemon.dev の全体には、isolation のヘッダを返さない。例外は、isolation を求める実行環境を埋め込む記事の URL である。サブドメインの名前と、ヘッダを返すパスと、どの記事の URL に返すかは、実行環境の方式を決める ADR が決める。
  - ADR-0031: [サブドメインに分ける規則を決め、1 つのアプリを 1 つの Worker とホスト名に割り当てる](0031-subdomains-and-workers.md)
- 実行環境の埋め込み方は、有効な決定が無い。プレイグラウンドの一覧は、fukuemon.dev の `/playground` に置く。
  - ADR-0030: [種別を記事の 1 つにし、構成を記事の形式で、シリーズをディレクトリで表す](0030-articles-format-and-series.md)
- レスポンスヘッダは、Workers Static Assets の `_headers` でパスごとに指定する。
  - ADR-0005: [Cloudflare Workers Static Assets を採用し、基盤を Terraform、deploy を Wrangler が管理する](0005-workers-terraform-wrangler-boundary.md)
- `COEP: require-corp` のページでは、CORP を返さない別の origin の画像がブロックされる。
- AI のエージェントがツールを操作する API（WebMCP）を、後で追加する見込みがある。ツールを登録するドキュメントがトップレベルである必要があるかは、未確認である。

## Decision

### 1. サブドメインの名前

プレイグラウンドのサブドメインは、`play.fukuemon.dev` にする。

### 2. プレイグラウンドでヘッダを返すパス

`play.fukuemon.dev` では、Node の実行環境のパスにだけ、次の 3 つを返す。

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Resource-Policy: cross-origin`

SQL だけを動かすツールと、Go を動かすツールのパスには返さない。  
どちらも、isolation を求めないためである。

### 3. 記事への埋め込み

記事には、`play.fukuemon.dev` のツールのページを iframe で埋め込む。

- fukuemon.dev は、Node の実行環境を埋め込む記事の URL にだけ、`COOP: same-origin` と `COEP: require-corp` を返す。親のページにヘッダが無いと、iframe の中の WebContainers が起動しないためである。
- ビルドのときに、Node の実行環境を埋め込む記事の URL を集め、`_headers` に書く。
- iframe に `allow="cross-origin-isolated"` を付ける。
- iframe は、訪問者がボタンを押してから作る。押すまで、実行環境の通信が発生しない。
- isolation を求めないツールだけを埋め込む記事には、ヘッダを返さない。

Node の実行環境を埋め込む記事では、CORP を返さない外部の画像と、`COEP` を返さない外部の埋め込みを使えない。

### 4. トップレベルの URL

どのツールも、トップレベルで開ける URL を持つ。  
fukuemon.dev の `/playground` の一覧からリンクする。  
AI のエージェントが操作する API を追加するときに、トップレベルのドキュメントから登録できる。

## 承認の条件

- 記事に埋め込んだ iframe と、トップレベルで開いたページが、同じ保存先（IndexedDB）を読むこと。

## Verification

端末は Apple M2、ブラウザは Playwright 1.65.0 の Chromium、WebKit、Firefox（headless）、配信は `localhost` である。  
本番の HTTPS のドメインと、実機のブラウザは未確認である。

親のページに、別の origin で site が同じ実行環境のページを iframe で埋め込み、iframe の中の WebContainers の `boot` を記録した。  
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

1 つの origin で、1 つのパスにだけ isolation のヘッダを返し、Chromium と WebKit で次のことを確認した。  
Firefox は、測定が時間内に終わらず、未確認である。

- ヘッダを返すパスで、WebContainers が起動した。
- ヘッダを返さないパスで、draw.io Embed Mode（`embed.diagrams.net`）の iframe が、初期化のメッセージを返した。
- ヘッダを返すパスに置いた draw.io Embed Mode の iframe は、初期化のメッセージを返さなかった。
- ヘッダを返さないパスで IndexedDB に書いた値を、ヘッダを返すパスで読めた。

WebContainers は、訪問者のコードを `webcontainer-api.io` の origin で動かした。  
訪問者の Node のコードは、`play.fukuemon.dev` に保存したデータに届かない。

## Considered Options

| 選択肢                                                                                              | 強み                                                                                | 弱み                                                                                                                                    |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **採用:** ヘッダを、Node の実行環境のパスと、それを埋め込む記事の URL にだけ返し、iframe で埋め込む | 記事の中で動かせる。埋め込まない記事と、ほかのツールのパスにヘッダが適用されない    | Node の実行環境を埋め込む記事では、CORP を返さない外部の画像と埋め込みを使えない。ビルドのときに、埋め込む記事の URL を集める処理が要る |
| 記事にはリンクかボタンだけを置き、実行環境を `play.fukuemon.dev` のページで開く                     | fukuemon.dev のページにヘッダが要らない。外部の画像と埋め込みを、どの記事でも使える | 記事の中で動かせない。記事の文と実行環境を、並べて読めない                                                                              |
| isolation を求めない方式（Nodebox、almostnode）を埋め込む                                           | fukuemon.dev のページにヘッダが要らない                                             | Cookie を使うフローが通らない                                                                                                           |
| 埋め込む記事に、`COEP: credentialless` を返す                                                       | 埋め込む記事でも、CORP を返さない外部の画像を読める                                 | WebKit が `credentialless` に対応せず、WebContainers が起動しない                                                                       |

## Consequences

### Positive

- 訪問者は、記事を読みながら、同じページの中でコードを動かせる。
- 実行環境の読み込みが、記事の初回の表示を遅らせない。
- SQL だけ、Go だけを動かす記事には、ヘッダの制約が及ばない。

### Negative

- `_headers` で、fukuemon.dev の記事の URL と、`play.fukuemon.dev` のパスの 2 か所のヘッダを管理する。誤って広く適用すると、外部の画像と埋め込みがブロックされる。
- 1 つの記事に、Node の実行環境と、draw.io Embed Mode のような `COEP` を返さない外部の埋め込みを並べられない。
- `COOP: same-origin` を返す記事は、その記事から開いた別のウィンドウを参照できない。
