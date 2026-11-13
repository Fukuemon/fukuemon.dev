# ADR-0044: AI のエージェントからの操作は、WebMCP の API で登録し、MCP-B の polyfill と relay でも呼べるようにする

## Status

提案

## Context

AI のエージェントが、プレイグラウンドのツール（実行環境、キャンバス、スライドのエディタ）を操作できるようにする。  
操作を公開する方式と、公開する操作の一覧を決める必要がある。

- どのツールも、トップレベルで開ける URL を持つ。isolation のヘッダは、Node の実行環境のパスにだけ返す。
  - ADR-0034: [cross-origin isolation のヘッダを、プレイグラウンドの Node の実行環境のパスと、それを埋め込む記事の URL にだけ返す](0034-playground-origin-and-embedding.md)
- 実行環境は、WebContainers である。画面は、実行環境をインターフェースを通して使う。
  - ADR-0033: [Node と npm の実行に WebContainers を採り、実行環境と画面の間をインターフェースで分ける](0033-webcontainers-for-node.md)
- キャンバスは、draw.io の Embed Mode と Excalidraw の 2 つのツールである。
  - ADR-0039: [キャンバスは、構成図を draw.io の Embed Mode で、手描きの図を Excalidraw で、別のパスのツールとして提供する](0039-canvas-drawio-and-excalidraw.md)
- スライドのエディタは、Marp で作る。
  - ADR-0041: [スライドのエディタは Marp で作り、テーマの CSS からトークンの CSS 変数を参照する](0041-slides-editor-with-marp.md)
- サイトは、AI のモデルを提供しない。利用者が、自分の AI のエージェントをつなぐ。サーバーで AI のエージェントを動かさない。
- WebMCP は、ページが、AI のエージェントが呼べる操作を登録する API である。API は `document.modelContext` にあり、`registerTool`、`getTools`、`executeTool` を持つ。
  - 出典: [Chrome: WebMCP Imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- WebMCP は、Chrome 149 から origin trial である。出荷するバージョンは書かれていない。手元では、フラグ `chrome://flags/#enable-webmcp-testing` で使える。
  - 「Join the WebMCP origin trial from Chrome 149.」
  - 出典: [Chrome: WebMCP](https://developer.chrome.com/docs/ai/webmcp)
  - 出典: [Chrome Status: WebMCP](https://chromestatus.com/feature/5117755740913664)
- Edge 150 は origin trial である。Firefox と Safari は、標準化への立場の issue だけがある。Claude が WebMCP の操作を直接呼べるという記述は、読んだ資料に無かった。
  - 出典: [WebMCP の implementation-status](https://github.com/webmachinelearning/webmcp/blob/56b8e7a74a312c4298858f8211388a536b835339/implementation-status.md)
- MCP-B の `@mcp-b/global` は、`document.modelContext` の polyfill である。`@mcp-b/webmcp-local-relay` は、利用者の端末で動く MCP のサーバーで、ページと `127.0.0.1` の WebSocket でつなぎ、ページが登録した操作を MCP のクライアントに見せる。どちらも MIT である。
  - 出典: [@mcp-b/global（npm）](https://www.npmjs.com/package/@mcp-b/global)
  - 出典: [@mcp-b/webmcp-local-relay（npm）](https://www.npmjs.com/package/@mcp-b/webmcp-local-relay)

## Decision

### 1. 登録する API

操作は、`document.modelContext.registerTool` で登録する。  
登録のコードは、ツールごとに 1 か所に置き、ページが持つ操作（Markdown の読み書き、Excalidraw の API、draw.io への `postMessage`、実行環境のインターフェース）を呼ぶ。  
WebMCP が使えるブラウザでは、登録した操作を、そのまま AI のエージェントが呼べる。

### 2. origin trial のトークン

本番に、origin trial のトークンを入れない。  
期限のあるトークンを更新する運用を持たないためである。

- WebMCP が出荷されたブラウザと、フラグを有効にしたブラウザでは、登録した操作を呼べる。
- そのほかのブラウザでは、polyfill と relay を通して呼ぶ。

### 3. polyfill と relay

MCP-B の polyfill と、relay につなぐスクリプトを、自分のサイトから配る。  
WebMCP の無いブラウザと、デスクトップの MCP のクライアントから呼べるようにするためである。

- 2 つのスクリプトは、利用者が AI からの操作を許可したときにだけ読み込む。
- 利用者は、自分の MCP のクライアントに relay を足す。ツールのページに、relay を起動するときに `--widget-origin https://play.fukuemon.dev` を渡すことを書く。

### 4. 公開する操作

最初に公開する操作は、次の 15 個にする。  
依存するツールができた順に、ツールごとに足す。

| ツール     | 操作                                     | 注釈                           |
| ---------- | ---------------------------------------- | ------------------------------ |
| スライド   | Markdown の全文、テーマ、枚数を返す      | 読み取りだけ、信頼できない内容 |
| スライド   | Markdown の全文を置き換える              | 無い                           |
| スライド   | テーマを変える                           | 無い                           |
| Excalidraw | 要素の一覧を返す                         | 読み取りだけ、信頼できない内容 |
| Excalidraw | 図形、文字、図形をつなぐ矢印を足す       | 無い                           |
| Excalidraw | 指定した要素の位置、大きさ、色を変える   | 無い                           |
| Excalidraw | 全ての要素を消す                         | 重大な操作                     |
| draw.io    | 図の XML を返す                          | 読み取りだけ、信頼できない内容 |
| draw.io    | 図に `mxCell` を足す                     | 無い                           |
| draw.io    | 図の全体を、渡した XML に置き換える      | 重大な操作                     |
| 実行環境   | ファイルの一覧を返す                     | 読み取りだけ                   |
| 実行環境   | ファイルの中身を返す                     | 読み取りだけ、信頼できない内容 |
| 実行環境   | ファイルを書く                           | 無い                           |
| 実行環境   | ファイルを消す                           | 重大な操作                     |
| 実行環境   | コマンドを実行し、終了コードと出力を返す | 重大な操作、信頼できない内容   |

「読み取りだけ」は `readOnlyHint`、「信頼できない内容」は `untrustedContentHint`、「重大な操作」は `consequentialHint` を指す。

### 5. 入力の検証と失敗の理由

操作は、受け取った入力を、操作の中で検証する。  
ブラウザの `executeTool` が、`inputSchema` に合わない値を、そのまま操作に渡すためである。

失敗の理由は、例外を投げずに、結果の文字列で返す。  
操作が例外を投げると、呼んだ側に、決まった文のエラーだけが届くためである。

## Verification

端末は Apple M2、配信は `localhost` である。  
ブラウザは、Google Chrome 156 と、Playwright 1.65.0 の Chromium 158、Firefox 159、WebKit 27.2 で、どれも headless である。  
Chrome 156 と Chromium 158 は、フラグ `enable-webmcp-testing` を有効にした。  
バージョンは、`@mcp-b/global` 6.2.0、`@mcp-b/webmcp-local-relay` 6.2.0、`@modelcontextprotocol/sdk` 1.32.2、`@webcontainer/api` 1.6.4 である。

| 呼び方                                          | 確認した環境                                       | 結果                                                     |
| ----------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------- |
| ページの中の API（`getTools` と `executeTool`） | Chrome 156 とフラグ                                | 15 個の全てを呼べた                                      |
| 拡張機能の content script                       | Chromium 158 とフラグ                              | スライドの操作を一覧にして、Markdown を置き換えられた    |
| MCP-B の relay と、MCP のクライアント（SDK）    | Chrome 156、Chromium 158、Firefox 159、WebKit 27.2 | スライドの Markdown の読み書きを、4 つのブラウザで呼べた |
| 実物の AI のエージェント                        | 無い                                               | 未確認                                                   |

- フラグの無い Chrome 156 と Chromium 158 には、`document.modelContext` が無かった。
- isolation のヘッダを返す実行環境のページでも、API を使えた。ファイルを書き、`node sum.js` を実行して出力と終了コードを受け取り、ファイルを消した。
- draw.io に図形を足す操作は、今の XML に `mxCell` を足して、`load` で読み込み直す形にした。全体を置き換える操作の後に図を読むと、渡した XML だけが返った。
- polyfill を読み込むと、Firefox と WebKit にも `document.modelContext` ができ、同じ `registerTool` のコードが動いた。
- relay を通して、スライドのテーマを変える操作を、Chrome 156 で呼べた。`enum` に無い値は、relay が検証して「Input validation error」を返した。
- polyfill は brotli で 71 KB、relay につなぐスクリプトは合わせて 9 KB だった。外部へのリクエストは、`127.0.0.1` への WebSocket だけだった。
- relay を、別の origin を渡した `--widget-origin` で起動すると、ページの接続は拒否された。relay のデフォルトは、どの origin のページも受け付ける。
- 別の origin の記事に埋め込んだ iframe は、`allow="tools"` が無いと、登録を拒否された。
- 実物の AI のエージェント（Claude Desktop、Claude Code、ChatGPT Desktop、Gemini in Chrome）からは、呼んでいない。
- 本番の HTTPS のドメインから `127.0.0.1` へ WebSocket を張るときの、Local Network Access の許可の出方は未確認である。
- origin trial の延長が承認されたかは、未確認である。

## Considered Options

| 選択肢                                                                                              | 強み                                                                                                                              | 弱み                                                                                                                                        |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **採用:** WebMCP の API で登録し、トークンを入れず、MCP-B の polyfill と relay でも呼べるようにする | 登録のコードが 1 つで済む。WebMCP の無いブラウザと、デスクトップの MCP のクライアントから呼べる。トークンを更新する運用が要らない | フラグを有効にしていない Chrome の、ブラウザに組み込まれたエージェントからは呼べない。MCP-B に依る。利用者が、自分の端末で relay を起動する |
| origin trial のトークンを、`play.fukuemon.dev` に入れる                                             | フラグなしの Chrome で、WebMCP の API が使える                                                                                    | 期限ごとにトークンを更新する。origin trial の間に API が変わると、訪問者に影響する                                                          |
| WebMCP だけにし、polyfill と relay を入れない                                                       | 第三者のライブラリに依らない                                                                                                      | Firefox と Safari の訪問者と、デスクトップの MCP のクライアントからは呼べない                                                               |
| MCP-B を使わず、ローカルの MCP のサーバーと WebSocket の橋渡しを自分で作る                          | 第三者のライブラリに依らない                                                                                                      | 作って保守する量が増える。試作していない                                                                                                    |
| WebMCP の出荷まで、AI からの操作を作らない                                                          | 作り直しが出ない                                                                                                                  | 出荷の時期は、資料に無い                                                                                                                    |
| 読み取りと、全体の置き換えだけを公開する                                                            | 操作の数が少ない                                                                                                                  | 図形を 1 つ足すときも、AI のエージェントが図の全体を書き直す                                                                                |
| draw.io とスライドに、1 つずつ変える操作と消す操作を足す                                            | AI のエージェントが、小さい変更を小さい操作で行える                                                                               | 操作の数が増える                                                                                                                            |

## Consequences

### Positive

- 利用者は、自分の AI のエージェントに頼んで、ファイルを書き、コードを実行し、図とスライドを編集できる。
- 操作の内容は、ブラウザの中か、利用者の端末の relay を通る。fukuemon.dev のサーバーには送られない。
- WebMCP が出荷されたときに、登録のコードを変えずに済む見込みである。

### Negative

- WebMCP は origin trial の段階で、API が変わることがある。変わったときに、登録のコードと polyfill のバージョンを直す。
- 利用者の AI のエージェントは、読み取った内容を、モデルの提供元に送ることがある。
- relay を通して呼ぶには、利用者が MCP のクライアントに relay を足す設定が要る。
- 実物の AI のエージェントから呼べることを、確認できていない。
- draw.io の図の一部だけを変える操作が無い。AI のエージェントは、全体を置き換える操作で変える。
