# ADR-0046: プレイグラウンドを Vite の React のアプリにし、ツールごとに HTML のエントリーポイントとパスを分ける

## Status

提案

## Context

プレイグラウンドのアプリを何で作るかと、`play.fukuemon.dev` のパスの構成を決める必要がある。

- プレイグラウンドは 1 つのアプリで、全てのツールを 1 つのサブドメインに置く。ツールごとに、パスとページを分ける。
  - ADR-0031: [サブドメインに分ける規則を決め、1 つのアプリを 1 つの Worker とホスト名に割り当てる](0031-subdomains-and-workers.md)
- cross-origin isolation のヘッダは、Node の実行環境のパスにだけ返す。記事には、ツールのページを iframe で埋め込む。どのツールも、トップレベルで開ける URL を持ち、`fukuemon.dev` の `/playground` の一覧からリンクする。
  - ADR-0034: [cross-origin isolation のヘッダを、プレイグラウンドの Node の実行環境のパスと、それを埋め込む記事の URL にだけ返す](0034-playground-origin-and-embedding.md)
- AI のエージェントからの操作を公開するのは、トップレベルで開いたページだけにする。
  - ADR-0045: [AI のエージェントからの操作は、ツールごとに 7 日のあいだ保存するスイッチで許可し、消す操作と全体を置き換える操作はページが確認を出す](0045-ai-operations-permission-and-confirmation.md)
- プレイグラウンドの画面は、全体が操作を前提にしていて、静的な HTML で読ませる中身が無い。
- Astro の island は、ページの中のほかの island と分かれて動く。island の間では、React の Context で状態を渡せない。
  - 出典: [Share state between islands（Astro Docs）](https://docs.astro.build/en/recipes/sharing-state-islands/)
- `packages/ui` の Storybook とテストは、Vite と `@vitejs/plugin-react` で動いている。

## Decision

### 1. アプリの構成

プレイグラウンドのアプリ（`apps/playground`）は、Vite の React のアプリにする。  
Astro のページに island を置く形にしない。

- ツールごとに、HTML のエントリーポイントを分ける。1 つのツールのページは、1 つの React のツリーになる。
- ビルドは、`vite build` で行う。Vite と `@vitejs/plugin-react` の設定は、`packages/ui` の Storybook とテストと同じものを使う。
- 画面は、`@fukuemon/ui` のコンポーネントとトークンで組む。

理由は、1 つのページが 1 つの React のツリーになり、ペインの間の状態を props と Context で渡せることである。

### 2. パス

ツールのパスは、ツールの名前を 1 階層に並べる。

| パス     | ツール                 | cross-origin isolation のヘッダ |
| -------- | ---------------------- | ------------------------------- |
| `/node/` | Node の実行環境        | 返す                            |
| `/sql/`  | SQL だけを動かすツール | 返さない                        |
| `/go/`   | Go を動かすツール      | 返さない                        |

- `play.fukuemon.dev/` は、`fukuemon.dev/playground` へリダイレクトする。
- キャンバスとスライドのエディタは、追加するときに、同じ階層に並べる。

### 3. 埋め込みとトップレベルの URL

記事に埋め込むページと、トップレベルで開くページは、同じ URL にする。

- ページは、`window.self !== window.top` で、埋め込みかどうかを判定する。
- 埋め込みのときは、ページのヘッダを出さず、AI のエージェントからの操作を登録しない。
- ペインの並べ方は、埋め込みかどうかでは変えず、ページの幅で変える。

## Verification

使い捨てのアプリを、workspace の中に作ってビルドした。ビルドは、Vite+ の `vp build` で実行した。`vite build` では、実行していない。  
Vite+ 1.4.0、`@vitejs/plugin-react` 6.3.0、`@tailwindcss/vite` 4.3.3、React 19.2.8 である。

- `build.rollupOptions.input` に、`node/index.html`、`sql/index.html`、`go/index.html` を渡した。ビルドは、`dist/node/index.html`、`dist/sql/index.html`、`dist/go/index.html` を出力した。
- `@fukuemon/ui` を `workspace:*` で依存に追加し、7 つのコンポーネントを import して、ビルドが通った。
  - import したのは、`FileTree`、`EditorFrame`、`TerminalFrame`、`PreviewFrame`、`HttpExchangeList`、`Button`、`Notice` である。
  - CSS は、`tailwindcss`、`@fukuemon/ui/fonts.css`、`@fukuemon/ui/theme.css` を `@import` し、`@source` で `packages/ui/src` を指した。
  - `ToolPane` は、`@fukuemon/ui` の `index.ts` が export していないので、import できなかった。
- 3 つのエントリーポイントが共有するコード（React と `@fukuemon/ui`）は、1 つのチャンク（213.76 kB、gzip で 67.54 kB）になった。エントリーポイントごとのチャンクは、0.34〜0.87 kB だった。
- CSS は 662.61 kB（gzip で 265.56 kB）で、`@font-face` を 632 個含む。フォントのファイルは 1236 個出力された。訪問者のブラウザが読み込むフォントのファイルの数は、測っていない。
- ブラウザで開いたときの表示は、確認していない。

## Considered Options

アプリの構成の選択肢は次のとおり。

| 選択肢                                                                   | 強み                                                                                                                         | 弱み                                                                                                           |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **採用:** Vite の React のアプリ。ツールごとにエントリーポイントを分ける | 1 つのページが 1 つの React のツリーになり、Context と `Suspense` をそのまま使える。`packages/ui` と同じ Vite の設定を使える | ビルドの仕組みが、Astro と Vite の 2 つになる。HTML の `head` を自分で書く                                     |
| Astro のページに、ツールごとに 1 つの island を置く                      | サイトと同じ仕組みで、設定と手順がそろう                                                                                     | 画面の全体が island なので、JavaScript を配らない利点が無い。island に渡す値は、シリアライズできる値に限られる |
| Astro のページに、ペインごとの island を置く                             | ペインごとに hydrate の時期を選べる                                                                                          | ペインの間の状態を Context で渡せず、共有の store が要る                                                       |

パスの選択肢は次のとおり。

| 選択肢                                | 強み                                             | 弱み                                                          |
| ------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| **採用:** `/node/`、`/sql/`、`/go/`   | URL が短い。ほかのツールも、同じ階層に並べられる | 実行環境のツールと、ほかのツールが、URL では区別できない      |
| `/run/node/`、`/run/sql/`、`/run/go/` | 実行環境のツールがまとまる                       | URL が 1 階層長い。`/run/` のページを作るかを決めることになる |
| `/sandbox/`、`/sql/`、`/go/`          | Node の実行環境を、役割の名前で呼べる            | Node 以外の言語のサーバーを追加するときに、名前が合わなくなる |

埋め込みとトップレベルの URL の選択肢は次のとおり。

| 選択肢                                    | 強み                                                                                                          | 弱み                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **採用:** 同じ URL にし、ページが判定する | エントリーポイントが、ツールごとに 1 つで済む。記事の「別のタブで開く」のリンクが、iframe の URL と同じになる | 埋め込みのときだけ出さない要素を、同じページの中で分岐する            |
| パスを分ける（`/node/embed/`）            | 埋め込みのページに、要らないコードを入れずに済む                                                              | エントリーポイントが 2 倍になる。isolation のヘッダを返すパスが増える |
| クエリで分ける（`?embed=1`）              | 記事の側で、表示を指定できる                                                                                  | トップレベルで `?embed=1` を開いたときの動きを決めることになる        |

## Consequences

### Positive

- ペインの間の状態を、props と Context で渡せる。
- `packages/ui` の Vite の設定と、同じ plugin でビルドできる。
- ツールを追加するときは、エントリーポイントとパスを 1 つ追加する。

### Negative

- ビルドの仕組みが、Astro（`apps/web`）と Vite（`apps/playground`）の 2 つになる。
- HTML の `head`（題、`meta`）を、ツールごとに自分で書く。
- 埋め込みかどうかの分岐が、ツールのページの中にある。
