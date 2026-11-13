# ADR-0058: スライドのテーマ、テンプレート、Marp の設定、ページを組み立てる関数を、`packages/slides` に置く

## Status

承認

## Context

スライドのテーマの CSS、テンプレート、Marp に渡す設定、ページ送りつきの HTML を組み立てる処理の、置き場を決める必要がある。

- スライドのエディタは、ブラウザの中で marp-core を動かす。テーマは、トークンの CSS 変数を参照する CSS である。テンプレートは、Markdown の断片である。
  - ADR-0041: [スライドのエディタは Marp で作り、テーマの CSS からトークンの CSS 変数を参照する](0041-slides-editor-with-marp.md)
- 公開するスライドは、`apps/web` のビルドが、Node で marp-core を動かして静的な HTML にする。ページ送りは、リンクと CSS の `:target` で作る。
  - ADR-0042: [公開するスライドは、ビルドのときに静的な HTML にして `/slides/<slug>` に置き、記事には iframe で埋め込む](0042-published-slides-as-static-pages.md)
- スライドのエディタは、`apps/playground` のツールである。
  - ADR-0046: [プレイグラウンドを Vite の React のアプリにし、ツールごとに HTML のエントリーポイントとパスを分ける](0046-playground-as-vite-react-app.md)
- `apps/playground` は、`apps/web` に依存しない。
  - 出典: [コードベースの構造](../../context/codebase.md)
- 実行環境の処理は、実行環境ごとの package に置く。package は、React と画面を持たない。
  - ADR-0048: [Node の実行環境のモジュールを package にし、記録を store で、ファイルの書き込みとプロセスの起動を関数で公開する](0048-node-runtime-interface-and-stores.md)
- `packages/ui` は、Base と Case の React のコンポーネントと、トークンを持つ。
  - ADR-0021: [packages/ui に Base と Case の React のコンポーネントを置き、packages/ui の Storybook をカタログにする](0021-ui-components-and-catalog.md)
- `packages/ui` は、workspace のどの package にも依存しない。
  - 出典: [コードベースの構造](../../context/codebase.md)
- エディタは、単独の HTML を書き出す。`apps/web` のビルドは、公開するスライドを HTML にする。どちらの HTML も、Marp の HTML と CSS に、トークンの CSS を入れたものである。

## Decision

`packages/slides`（`@fukuemon/slides`）を作り、エディタと `apps/web` のビルドが共有する処理を置く。

- package が持つものは、次のとおり。
  - テーマの CSS
  - テンプレートの Markdown と、新しいスライドのひな形
  - Marp のインスタンスを作る関数と、Markdown をスライドの HTML と CSS にする関数。数式、絵文字の画像、HTML のタグを無効にする設定を、package の中だけが持つ
  - Markdown の先頭の `theme:` を読む関数と、`theme:` を書き換える編集を返す関数
  - 行の番号から何枚目のスライドかを求める関数と、スライドの後ろに断片を足す編集を返す関数
  - Markdown とトークンの CSS から、ページ送りつきの 1 枚の HTML を組み立てる関数
- package は、`@marp-team/marp-core` に依存する。React、`@fukuemon/ui`、workspace のほかの package には依存しない。
- ページに入れる CSS は、色、フォーカスの輪、角、動きの時間を、トークンの CSS の変数で参照する。値を書かない。
- トークンの CSS は、呼ぶ側が文字列で渡す。package は、トークンのファイルを読まない。エディタと `apps/web` のビルドは、同じ `@fukuemon/ui` のトークンの CSS を渡す。
- `@fukuemon/slides` のエントリーポイントの関数は、ブラウザと Node の両方で動く。DOM の API を使わない。組み立てたページに入れるスクリプトは、package の中の別のディレクトリに置き、ブラウザのコードとして型を確認する。
- package は、Vite の plugin を、別のサブパス（`@fukuemon/slides/vite`）で export する。plugin は、テーマの CSS と、ページに入れる CSS とスクリプトを、文字列にする。plugin は、Node でだけ動く。
  - サブパスを分ける理由は、エディタの JavaScript に、plugin のコードを入れないためである。
  - 2 つのアプリのビルドの設定は、plugin を登録するだけにする。
- エディタの「単独の HTML」の書き出しと、`apps/web` のビルドは、同じ関数で HTML を組み立てる。単独の HTML にも、公開するスライドと同じページ送りが入る。

理由は、テーマと Marp の設定が 1 か所にあると、エディタのプレビューと、公開するスライドの見た目が食い違わないことである。

## Considered Options

| 選択肢                                                                     | 強み                                                                                                                | 弱み                                                                  |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **採用:** `packages/slides` を作り、テーマ、テンプレート、設定、関数を置く | テーマと設定が 1 か所にある。単独の HTML と公開するスライドが、同じ関数で作られる。React のコンポーネントを持たない | package が 1 つ増える                                                 |
| テーマの CSS だけを `packages/ui` に置き、Marp の設定は 2 つのアプリに書く | package が増えない。テーマが、トークンと同じ package にある                                                         | 設定が 2 か所になる。`packages/ui` に、Marp のクラスに依る CSS が入る |
| `apps/playground` に置き、`apps/web` が同じものをもう 1 つ持つ             | 依存の規約を変えない                                                                                                | テーマと設定が、2 つのアプリで食い違う                                |
| `apps/web` のビルドが、`apps/playground` のファイルを相対パスで読む        | 置き場が 1 つで済む                                                                                                 | アプリの間に、package の宣言に出ない依存ができる                      |

## Consequences

### Positive

- テーマを直すと、エディタのプレビュー、書き出した単独の HTML、公開するスライドの 3 つが、同じ見た目に変わる。
- 数式と絵文字の画像を無効にする設定が、1 か所にある。外部の CDN へのリクエストを出さない設定を、片方のアプリで書き忘れることがない。
- AI のエージェントからの操作でテーマを変える処理は、`theme:` を書き換える同じ関数を使える。

### Negative

- package が 1 つ増え、依存の規約に行が増える。
- `@fukuemon/ui` のトークンの CSS に、フォーカスの輪、角、動きの時間の変数を足す。今のトークンの CSS は、色と文字の値だけを持つためである。
- ページ送りの HTML と CSS は、`@fukuemon/ui` のコンポーネントを使わずに、package の中に書く。トークンの CSS の変数に無い見た目を `@fukuemon/ui` と合わせる作業は、手で行う。
- marp-core のバージョンを上げるときは、エディタと `apps/web` のビルドの両方が、同時に変わる。
