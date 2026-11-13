# ADR-0064: Yaegi で動かす Go のコードの HTTP のリクエストは、Web Worker と同じ origin へのものだけを通す

## Status

提案

## Context

Yaegi で動かす Go のコードが、`net/http` で送るリクエストの扱いを決める必要がある。

- Go を実行する操作とテストを実行する操作は、確認を出さない。前提は、Yaegi に渡す symbol を `stdlib.Symbols` だけにし、Yaegi で動かすコードが、ページの `localStorage` と IndexedDB を読み書きできないことである。
  - ADR-0063: [AI のエージェントからの操作を、SQL だけを動かすツールと Go を動かすツールにも公開し、PGlite と Yaegi を操作が呼ばれたときにも読み込む](0063-ai-operations-for-sql-and-go.md)
- ADR-0063 は、Yaegi で動かすコードが、ブラウザの中で `net/http` から外部へリクエストを送れるかを、実装のタスクで確認するとした。
- Go を実行する Web Worker は、`play.fukuemon.dev` のページが作る。Web Worker の origin は、ページと同じである。
  - ADR-0034: [cross-origin isolation のヘッダを、プレイグラウンドの Node の実行環境のパスと、それを埋め込む記事の URL にだけ返す](0034-playground-origin-and-embedding.md)
- `play.fukuemon.dev` は、読者の identity を前提にする機能を持たず、Cookie で認証しない。
  - ADR-0008: [読者の identity を前提とする機能を作らず、バックエンドを持たない](0008-no-reader-identity.md)
- Go の `net/http` は、`js/wasm` では、リクエストのたびに、実行している環境の `fetch` を呼ぶ。Go のコードは、リクエストのヘッダ `js.fetch:redirect` で、`fetch` の `redirect` を指定できる。
  - 出典: [net/http/roundtrip_js.go](https://github.com/golang/go/blob/go1.26.4/src/net/http/roundtrip_js.go)

## Decision

Yaegi で動かすコードの HTTP のリクエストは、Web Worker と同じ origin へのものだけを通し、ほかの origin へのものは送らずに失敗させる。

- `@fukuemon/go-runtime` の Web Worker は、Yaegi を起動する前に、Web Worker の `fetch` を差し替える。差し替えた `fetch` は、URL の origin が Web Worker と違うときに、リクエストを送らずに失敗を返す。
  - Yaegi で動かすコードが、訪問者のファイルの中身や、エージェントが書いた値を、ほかの origin のサーバーへ送れないようにするためである。
- 差し替えた `fetch` は、`redirect` を `error` にして送る。Go のコードが指定した `redirect` は上書きする。
  - 同じ origin のパスがリダイレクトを返したときに、ほかの origin に届かないようにするためである。
- 同じ origin へのリクエストは、通す。`play.fukuemon.dev` は、Cookie で認証せず、送られて困る値を持たないためである。
- `net/http/httptest` の `NewRecorder` のように、`fetch` を使わない処理は、そのまま使える。

## Verification

Yaegi 0.16.3 と Go 1.26.4 の WASM を、Playwright 1.64.1 の Chromium 156 と WebKit 27.2 の Web Worker の中で動かした。  
ページと、別の origin のサーバーは、どちらもローカルのサーバーである。

| Yaegi で動かしたコード                                               | `fetch` を差し替えないとき                                                                                      | `fetch` を差し替えたとき                                                      |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `http.Get` で同じ origin のパスを取得する                            | `status: 200`                                                                                                   | `status: 200`                                                                 |
| `http.Get` で別の origin のパスを取得する                            | 応答は読めなかった。別の origin のサーバーに `GET` が届いた                                                     | `fetch() failed` で失敗した。別の origin のサーバーに `GET` は届かなかった    |
| `http.Get` で、別の origin へ 302 を返す同じ origin のパスを取得する | リダイレクトをたどり、`Access-Control-Allow-Origin: *` を返す別の origin のサーバーから、`status: 200` を読めた | `fetch() failed` で失敗した。別の origin のサーバーにリクエストは届かなかった |

## Considered Options

| 選択肢                                                                           | 強み                                                                                                            | 弱み                                                                                     |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **採用:** Web Worker の `fetch` を差し替え、同じ origin へのリクエストだけを通す | 訪問者のファイルとエージェントの値が、ほかの origin へ出ない。`httptest` と、同じ origin へのリクエストは使える | 記事で、外部の API を呼ぶ HTTP のクライアントを題材にできない                            |
| 今のまま、全ての origin へのリクエストを通し、ADR に書く                         | 処理が要らない。HTTP のクライアントを題材にできる                                                               | Go を実行する操作で、訪問者が見ていない間に、ファイルの中身がほかの origin へ送られうる  |
| Go を実行する操作とテストを実行する操作に、ページが確認を出す                    | リクエストを止めずに、利用者が実行を見てから通せる                                                              | ADR-0063 の Decision 2 を変える。エージェントが 1 回実行するたびに、利用者がボタンを押す |
| `net/http` の symbol を Yaegi に渡さない                                         | リクエストを送る手段が無くなる                                                                                  | `httptest` と、`net/http` の型を使うコードも動かなくなる                                 |

## Consequences

### Positive

- Yaegi で動かすコードは、ほかの origin へ HTTP のリクエストを送れない。Go を実行する操作に確認を出さない前提に、ファイルの中身を外へ送れないことが加わる。
- `net/http/httptest` を使うコードと、同じ origin へのリクエストは、今までどおり動く。

### Negative

- 記事の Go のコードで、外部の API を呼ぶ処理は書けない。書くときは、この ADR を変える。
- `@fukuemon/go-runtime` の Web Worker の `fetch` を差し替える処理が、Go を実行する操作に確認を出さない前提の 1 つになる。差し替えを外すときは、確認を出すかを決め直す。
