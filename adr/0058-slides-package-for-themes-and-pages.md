# ADR-0058: スライドのテーマ、テンプレート、Marp の設定、ページを組み立てる関数を、`packages/slides` に置く

## Status

提案

## Context

スライドのテーマの CSS、テンプレート、Marp に渡す設定、ページ送りつきの HTML を組み立てる処理の、置き場を決める必要がある。

- スライドのエディタは、ブラウザの中で marp-core を動かす。テーマは、トークンの CSS 変数を参照する CSS である。テンプレートは、Markdown の断片である。単独の HTML には、Marp の HTML と CSS に加えて、トークンの CSS を埋め込む。
  - ADR-0041: [スライドのエディタは Marp で作り、テーマの CSS からトークンの CSS 変数を参照する](0041-slides-editor-with-marp.md)
- 公開するスライドは、`apps/web` のビルドが、Node で marp-core を動かして静的な HTML にする。ページ送りは、リンクと CSS の `:target` で作る。
  - ADR-0042: [公開するスライドは、ビルドのときに静的な HTML にして `/slides/<slug>` に置き、記事には iframe で埋め込む](0042-published-slides-as-static-pages.md)
- スライドのエディタは、`apps/playground` のツールである。`apps/playground` は、`apps/web` に依存しない。
  - ADR-0046: [プレイグラウンドを Vite の React のアプリにし、ツールごとに HTML のエントリーポイントとパスを分ける](0046-playground-as-vite-react-app.md)
- 実行環境の処理は、実行環境ごとの package に置く。package は、React と画面を持たない。
  - ADR-0048: [Node の実行環境のモジュールを package にし、記録を store で、ファイルの書き込みとプロセスの起動を関数で公開する](0048-node-runtime-interface-and-stores.md)
- `packages/ui` は、Base と Case の React のコンポーネントと、トークンを持つ。workspace のどの package にも依存しない。
  - ADR-0021: [packages/ui に Base と Case の React のコンポーネントを置き、packages/ui の Storybook をカタログにする](0021-ui-components-and-catalog.md)
- エディタの「単独の HTML」の書き出しと、`apps/web` のビルドは、どちらも、Marp の出力にトークンの CSS とページ送りを足して、1 枚の HTML にする。

## Decision

`packages/slides`（`@fukuemon/slides`）を作り、エディタと `apps/web` のビルドが共有する処理を置く。

- package が持つものは、次の 5 つ。
  - テーマの CSS
  - テンプレートの Markdown と、新しいスライドのひな形
  - Marp のインスタンスを作る関数。数式、絵文字の画像、HTML のタグを無効にする設定を、この関数だけが持つ
  - Markdown の先頭の `theme:` を読む関数と、書き換える関数
  - Markdown とトークンの CSS から、ページ送りつきの 1 枚の HTML を組み立てる関数
- package は、`@marp-team/marp-core` に依存する。React、`@fukuemon/ui`、workspace のほかの package には依存しない。
- トークンの CSS は、呼ぶ側が文字列で渡す。package は、トークンのファイルを読まない。
- package の関数は、ブラウザと Node の両方で動く。DOM の API を使わない。
- エディタの「単独の HTML」の書き出しと、`apps/web` のビルドは、同じ関数で HTML を組み立てる。

理由は、テーマと Marp の設定が 1 か所にあると、エディタのプレビューと、公開するスライドの見た目が食い違わないことである。

## Considered Options

| 選択肢                                                                     | 強み                                                                                                      | 弱み                                                                  |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **採用:** `packages/slides` を作り、テーマ、テンプレート、設定、関数を置く | テーマと設定が 1 か所にある。単独の HTML と公開するスライドが、同じ関数で作られる。React と画面を持たない | package が 1 つ増える                                                 |
| テーマの CSS だけを `packages/ui` に置き、Marp の設定は 2 つのアプリに書く | package が増えない。テーマが、トークンと同じ package にある                                               | 設定が 2 か所になる。`packages/ui` に、Marp のクラスに依る CSS が入る |
| `apps/playground` に置き、`apps/web` が同じものをもう 1 つ持つ             | 依存の規約を変えない                                                                                      | テーマと設定が、2 つのアプリで食い違う                                |
| `apps/web` のビルドが、`apps/playground` のファイルを相対パスで読む        | 置き場が 1 つで済む                                                                                       | アプリの間に、package の宣言に出ない依存ができる                      |

## Consequences

### Positive

- テーマを直すと、エディタのプレビュー、書き出した単独の HTML、公開するスライドの 3 つが、同じ見た目に変わる。
- 数式と絵文字の画像を無効にする設定が、1 か所にある。外部の CDN へのリクエストを出さない設定を、片方のアプリで書き忘れることがない。
- AI のエージェントからの操作でテーマを変える処理は、`theme:` を書き換える同じ関数を使える。

### Negative

- package が 1 つ増え、依存の規約に行が増える。
- ページ送りの HTML と CSS は、`@fukuemon/ui` のコンポーネントを使わずに、package の中に書く。見た目を `@fukuemon/ui` と合わせる作業は、手で行う。
- marp-core のバージョンを上げるときは、エディタと `apps/web` のビルドの両方が、同時に変わる。
