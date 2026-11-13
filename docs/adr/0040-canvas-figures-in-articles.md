# ADR-0040: 記事に埋め込むキャンバスの図は、元データ入りの SVG をリポジトリに置き、ビルドのときにインラインにする

## Status

承認

## Context

運営者がキャンバスで描いた図を、記事に埋め込む。  
図をリポジトリに保存する形、記事への置き方、訪問者が記事の図をキャンバスで開く方法、図に入る第三者のアイコンの扱いを決める必要がある。

- 埋め込むコンテンツは、種別にも形式にもしない。本文に置く機能として追加する。
  - ADR-0030: [種別を記事の 1 つにし、構成を記事の形式で、シリーズをディレクトリで表す](0030-articles-format-and-series.md)
- Mermaid の図は、ビルドのときに、ブラウザを使わずに SVG にする。ページに、図を描くための JavaScript を配らない。
  - ADR-0016: [mermaid の図を、ビルドでも島でも Pele で SVG にする](0016-render-mermaid-with-pele.md)
- キャンバスは、draw.io の Embed Mode と Excalidraw の 2 つのツールである。
  - ADR-0039: [キャンバスは、構成図を draw.io の Embed Mode で、手描きの図を Excalidraw で、別のパスのツールとして提供する](0039-canvas-drawio-and-excalidraw.md)
- draw.io は、図の XML を入れた SVG（`xmlsvg`）を書き出す。Excalidraw は、scene を入れた SVG を書き出す。どちらのエディタも、書き出した SVG をファイルとして開ける。
- サイトは、OS の設定でライトとダークを切り替える。サイトに、テーマを切り替える操作を置かない。`data-theme` の属性は、Storybook だけが使う。
  - 出典: [トークンの文書](../../packages/ui/design/tokens.md)
- プレイグラウンドでは、他人が用意したコードを、訪問者の操作なしに動かさない。運営者が用意した初期ファイルは、この条件の対象にしない。他人が用意したものを読み込む機能を追加するときは、決め直す。
  - ADR-0031: [サブドメインに分ける規則を決め、1 つのアプリを 1 つの Worker とホスト名に割り当てる](0031-subdomains-and-workers.md)
- リポジトリは公開で、コードと記事の本文を MIT License で公開している。
- Excalidraw が書き出す SVG には、使った文字の書体が入る。書体の Excalifont と Xiaolai は、OFL-1.1 である。
  - 出典: [Excalifont](https://plus.excalidraw.com/excalifont)
  - 出典: [lxgw/kose-font](https://github.com/lxgw/kose-font/tree/172d9dbe94ade82b5316e0989e3aa286b7041baf)
- AWS は、アイコンを構成図を作るために使うことを認めている。AWS のアイコンの再配布の条件と、Google Cloud のアイコンの利用条件は、読んだページに無かった。
  - 「We allow customers and partners to use these toolkits and assets to create architecture diagrams.」
  - 出典: [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/)
- draw.io の README は、図として書き出したものを、アイコンの条項の対象の外と書いている。
  - 「This restriction does not apply to end-user diagram output (such as exported images or documents) …」
  - 出典: [jgraph/drawio の README](https://github.com/jgraph/drawio/blob/c72c9a98b7a6ce392556ed04c05e0ff19f43f5c3/README.md)

## Decision

### 1. リポジトリに置く形

運営者は、キャンバスから書き出した元データ入りの SVG を、リポジトリに置く。  
図のファイルと SVG を別に持たず、SVG の 1 枚だけを置く。

- ビルドにブラウザが要らない。Mermaid の図と同じ理由である。
- 運営者は、置いた SVG をキャンバスで開いて、描き直せる。

### 2. 記事への置き方

ビルドのときに、SVG を記事の HTML にインラインで入れる。  
ページに、図を描くための JavaScript を配らない。

- draw.io の SVG は、ルートの `color-scheme` の指定を外し、背景と線の色の変数（`--ge-dark-color`、`--ge-light-color`）にトークンを渡す。
- Excalidraw の SVG は、線と文字のデフォルトの色（`#1e1e1e`）を、トークンに置き換える。
- 運営者が選んだ色は、置き換えない。

インラインにする理由は、図の背景と線の色が、ページのトークンと揃うことである。

### 3. 訪問者が記事の図をキャンバスで開く方法

記事の図に「キャンバスで開く」のリンクを置き、キャンバスに図の識別子を渡す。

- 識別子は、fukuemon.dev の図のパスである。キャンバスは、fukuemon.dev の図のパスだけを読み込む。任意の URL は読み込まない。
- 運営者が置いた図だけを開けるので、ADR-0031 の Decision 4 の「運営者が用意した初期ファイル」と同じ扱いにする。Decision 4 は決め直さない。
- fukuemon.dev は、図のパスに、`play.fukuemon.dev` を許す `Access-Control-Allow-Origin` を返す。

### 4. 第三者のアイコンと書体が入った図

図のファイルを置くディレクトリを 1 つ決める。  
`LICENSE` か README に、そのディレクトリの図に入っている第三者のアイコンを、MIT License の対象から外すと書く。  
アイコンの利用条件の原文は、運営者が確認する。

Excalidraw の SVG に入る書体（Excalifont、Xiaolai。OFL-1.1）も、同じ記述で、MIT License の対象から外す。

## Verification

端末、ブラウザ、バージョンは、ADR-0039 の Verification と同じである。  
エディタから書き出した SVG を、記事の形のページに 7 通りの置き方で並べ、JavaScript を無効にして、3 つのブラウザで見た。

| 置き方                                                                        | ライト | OS がダーク | `data-theme="dark"` |
| ----------------------------------------------------------------------------- | ------ | ----------- | ------------------- |
| draw.io を `<img>` で置く                                                     | 読める | 読める      | 読める              |
| draw.io をインラインで置く                                                    | 読める | 読める      | 読めない            |
| draw.io をインラインで置き、`color-scheme` の指定を外して、トークンを渡す     | 読める | 読める      | 読める              |
| Excalidraw を `<img>` で置く（ライトの 1 枚）                                 | 読める | 読めない    | 読めない            |
| Excalidraw を `<picture>` で置く（ライトとダークの 2 枚）                     | 読める | 読める      | 読めない            |
| Excalidraw をインラインで置き、線と文字のデフォルトの色をトークンに置き換える | 読める | 読める      | 読める              |
| Excalidraw をインラインで置き、ダークで色を反転する（CSS の `filter`）        | 読める | 読める      | 読める              |

- draw.io を `<img>` で置いた行の `data-theme="dark"` は、Chromium と Firefox で見た。WebKit の画面は見ていない。
- draw.io の SVG は、色を `light-dark()` で持ち、明暗の両方の色を持つ。大きさは 15.6 KB（図形 4 つ、線 3 本）で、アイコンはパスで入る。
- Excalidraw の SVG は、ライトの色だけを持つ。大きさは 26.2 KB（図形 3 つ、矢印 2 本、文字 1 つ）で、使った文字の書体が data URI で入る。
- 記事のページのリクエストは、ページと図の 3〜4 件だけで、キャンバスのコードは読み込まれなかった。
- キャンバスのページに `?src=<URL>` を渡し、別の origin に置いた元データ入りの SVG を `fetch` で読んで開いた。draw.io と Excalidraw の両方で、図が開いた（Chromium）。図を返す側に、`Access-Control-Allow-Origin` のヘッダが要った。
- draw.io で、`?src=` で開いただけでは、IndexedDB に保存してあった図は変わらなかった。開いた図を編集すると、保存してあった図が、開いた図に上書きされた（Chromium）。試作は、図を 1 つだけ保存する作りである。
- Excalidraw の scene から、Node だけで SVG を作る形は、1 回試して失敗した（`ERR_IMPORT_ATTRIBUTE_MISSING`）。動く条件は未確認である。

## Considered Options

| 選択肢                                                                                  | 強み                                                                                            | 弱み                                                                                                                     |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **採用:** 元データ入りの SVG を置き、ビルドのときにインラインにして、色をトークンに渡す | ビルドにブラウザが要らない。JavaScript なしで読める。図の背景と線の色が、ページのトークンと揃う | ビルドに、SVG の文字列を置き換える処理が要る。Excalidraw の、運営者が選んだ色は、ダークで変わらない                      |
| インラインにし、Excalidraw はダークで色を反転する                                       | Excalidraw の、運営者が選んだ色も、ダークで読める色になる                                       | 反転した色は、運営者が選んだ色と違う色になる                                                                             |
| `<img>` で置く。Excalidraw は `<picture>` で 2 枚置く                                   | ビルドの処理が要らない。HTML が小さい                                                           | 図の背景の色が、ページのトークンと揃わない。Excalidraw は、運営者がダークの SVG をもう 1 枚書き出す                      |
| 図のファイルを置き、ビルドのときに SVG にする                                           | リポジトリに置くファイルが、図の元データだけになる                                              | draw.io の図を、ブラウザを使わずに SVG にする手段を確認していない。Excalidraw は、Node だけで SVG を作る形が動かなかった |
| キャンバスが、任意の URL の図を読み込む                                                 | fukuemon.dev のほかに置いた図も開ける                                                           | 他人が用意した図を、URL を開かせるだけで訪問者のキャンバスに読み込める。ADR-0031 の Decision 4 を決め直すことになる      |
| 訪問者が記事の図を開く機能を、最初の公開に入れない                                      | 作るものが少ない                                                                                | 訪問者が、記事の図を描き変えて試せない                                                                                   |
| 第三者のアイコンが入った図を、何も書かずに置く                                          | 文書を直さない                                                                                  | アイコンが、MIT License の対象に見える                                                                                   |
| クラウドのアイコンを使う図を、記事に埋め込まない                                        | リポジトリに、第三者のアイコンが入らない                                                        | 構成図を記事で見せられない                                                                                               |

## Consequences

### Positive

- 運営者は、キャンバスで描いた図を、SVG の 1 枚を置くだけで記事に埋め込める。
- 訪問者は、JavaScript を無効にしても、記事の図を読める。図は、ライトとダークのどちらでも読める。
- キャンバスの読み込みが、記事の初回の表示を遅らせない。
- 訪問者は、記事の図をキャンバスで開いて、描き変えられる。

### Negative

- インラインにした SVG の分だけ、記事の HTML が大きくなる。
- ビルドの置き換えは、draw.io と Excalidraw が書き出す SVG の形に依る。エディタのバージョンが上がったときに、置き換えを確認し直す。
- Excalidraw の図で、運営者が選んだ色は、ダークでもライトの色のままである。運営者は、両方の背景で読める色を選ぶ。
- Excalidraw の SVG には、OFL-1.1 の書体の一部が入る。
- fukuemon.dev の図のパスに、`Access-Control-Allow-Origin` を返す設定が増える。
- 第三者のアイコンの利用条件を、運営者が確認するまで、アイコンの入った図を公開のリポジトリに置けるかが決まらない。
