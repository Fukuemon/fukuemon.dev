# ADR-0039: キャンバスは、構成図を draw.io の Embed Mode で、手描きの図を Excalidraw で、別のパスのツールとして提供する

## Status

提案

## Context

プレイグラウンドに、訪問者と運営者が図を描いて編集するキャンバスを追加する。  
キャンバスの方式と、エディタの配信元を決める必要がある。

- 運営者は、AWS と Google Cloud のアイコンを使う構成図と、手描きの図の両方を描きたい。
- プレイグラウンドの全てのツールを、1 つのサブドメインに置き、ツールごとにパスとページを分ける。訪問者が作った図は、訪問者のブラウザに保存する。
  - ADR-0031: [サブドメインに分ける規則を決め、1 つのアプリを 1 つの Worker とホスト名に割り当てる](0031-subdomains-and-workers.md)
- cross-origin isolation のヘッダは、Node の実行環境のパスにだけ返す。ヘッダを返すパスに置いた draw.io の Embed Mode の iframe は、初期化のメッセージを返さない。
  - ADR-0034: [cross-origin isolation のヘッダを、プレイグラウンドの Node の実行環境のパスと、それを埋め込む記事の URL にだけ返す](0034-playground-origin-and-embedding.md)
- draw.io の Embed Mode は、draw.io のエディタを iframe で読み込み、親のページと `postMessage` で図を受け渡す。公式は、Embed Mode を `embed.diagrams.net` でだけサポートする。
  - 「This mode is only supported on https://embed.diagrams.net.」
  - 出典: [draw.io: Embed mode](https://www.drawio.com/docs/reference/embed-mode/)
- draw.io は、PDF と画像への書き出しのような一部の機能で、図を draw.io のサーバーに送る。この文が `embed.diagrams.net` にも当てはまるかは、書かれていない。
  - 「Some functions send a diagram to a server to be processed: export to PDF or image, real-time collaboration, …」
  - 出典: [draw.io: Trust](https://www.drawio.com/trust/)
- draw.io のコードは Apache-2.0 である。アイコンとステンシルには、Atlassian の製品に組み込むことを禁じる条項がある。図として書き出したものは、条項の対象の外である。
  - 出典: [jgraph/drawio の README](https://github.com/jgraph/drawio/blob/c72c9a98b7a6ce392556ed04c05e0ff19f43f5c3/README.md)
- `@excalidraw/excalidraw` は MIT である。手描きの書体の Excalifont と、日本語の文字に使う Xiaolai は、OFL-1.1 である。
  - 出典: [excalidraw の LICENSE](https://github.com/excalidraw/excalidraw/blob/82d5847e57dcb6fb5982833ea9ec2137fe0b2bd5/LICENSE)
  - 出典: [Excalifont](https://plus.excalidraw.com/excalifont)
  - 出典: [lxgw/kose-font](https://github.com/lxgw/kose-font/tree/172d9dbe94ade82b5316e0989e3aa286b7041baf)
- tldraw の SDK は、本番でライセンスキーを求める。非商用の hobby license は、申請ごとに審査があり、透かしを表示する。
  - 「The tldraw SDK requires a license key to work in production.」
  - 出典: [tldraw: License key](https://tldraw.dev/sdk-features/license-key)

## Decision

### 1. 提供するツール

キャンバスは、2 つのツールにする。  
構成図は draw.io の Embed Mode で、手描きの図は Excalidraw で描く。

- 2 つのツールは、`play.fukuemon.dev` の別のパスに置く。
- どちらのパスにも、isolation のヘッダを返さない。draw.io の Embed Mode が、ヘッダを返すパスで動かないためである。

### 2. draw.io の配信元と、図の受け渡し

draw.io のエディタは、`embed.diagrams.net` を iframe で読み込む。  
公式がサポートする形が、これだけのためである。

- 親のページが、`postMessage` で図の XML を渡し、編集のたびに `autosave` のイベントで XML を受け取る。
- 図は、親のページの origin（`play.fukuemon.dev`）の IndexedDB に保存する。
- ツールのページに、次の 2 つを書く。
  - エディタを、draw.io のサーバーから読み込むこと。
  - PDF への書き出しが、draw.io のサーバーを通ること。

### 3. Excalidraw の配信元

Excalidraw は、`@excalidraw/excalidraw` をバンドルして、自分のページから配る。  
書体も、`window.EXCALIDRAW_ASSET_PATH` に自分のパスを渡して、自分で配る。  
デフォルトのままでは、書体を `esm.sh` から読み込むためである。

### 4. クラウドのアイコン

AWS と Google Cloud のアイコンは、draw.io の内蔵のライブラリを使う。  
iframe の URL に `libs=aws4;gcp2` を渡す。  
Excalidraw には、クラウドのアイコンを配らない。  
アイコンを自分で再配布する条件を、確認できていないためである。

## Verification

端末は Apple M2、ブラウザは Playwright 1.65.0 の Chromium 158、WebKit 27.2、Firefox 159（headless）、配信は `localhost` である。  
バージョンは、`@excalidraw/excalidraw` 0.18.1、React 19.3.1、draw.io 32.7.2 である。  
`/canvas/` のパスにはヘッダを返さず、`/code/` のパスにだけ isolation のヘッダを返した。  
本番の HTTPS のドメイン、実機のブラウザ、タッチでの操作は未確認である。

| 項目                             | draw.io の Embed Mode                                     | Excalidraw                         |
| -------------------------------- | --------------------------------------------------------- | ---------------------------------- |
| isolation のヘッダを返さないパス | 動く                                                      | 動く                               |
| isolation のヘッダを返すパス     | 動かない                                                  | 動く                               |
| IndexedDB への保存と再訪         | 編集した後の図が残った                                    | 図が残った                         |
| ファイルへの保存と読み込み       | `.drawio` と、元データ入りの SVG                          | `.excalidraw` と、scene 入りの SVG |
| ダークのエディタ                 | `dark=1` でダークになった                                 | `theme="dark"` でダークになった    |
| 自分のページのほかへのリクエスト | `embed.diagrams.net` に 68 件、`log.diagrams.net` に 1 件 | 0 件（書体を自分で配ったとき）     |

表の結果は、次の行を除いて、3 つのブラウザで同じだった。

- draw.io の「isolation のヘッダを返すパス」の行は、ADR-0034 の Verification の結果で、Chromium と WebKit で確認した。Firefox は未確認である。
- draw.io の「ダークのエディタ」の行は、Chromium だけで確認した。
- Excalidraw の scene 入りの SVG を開く操作は、Chromium だけで確認した。
- リクエストの数は、Chromium で数えた。

- draw.io は、試した操作（読み込み、編集、書き出し、再訪、ファイルを開く）の範囲で、図の中身を通信に出さなかった。リクエストは全て GET で、WebSocket は 0 件、Cookie は 0 件だった。図に入れた目印の文字列を含むリクエストは、3 つのブラウザで 0 件だった。
- `log.diagrams.net` へのリクエストは、draw.io のバージョンとホスト名だけを含んだ。
- `embed.diagrams.net` の origin に、`localStorage` の 2 つのキー、IndexedDB のデータベース 1 つ、Service Worker 1 つが置かれた。
- `libs=aws4;gcp2` を渡すと、図形の一覧に AWS と Google Cloud のライブラリが出た。EC2、S3、Compute Engine のアイコンを置いた図が描画された。
- draw.io の `merge` のアクションに `mxGraphModel` を渡すと、図形が足されず、図が渡した中身に置き換わった。
- Excalidraw の最初に読む JavaScript は、brotli で 362 KB だった。日本語の文字を描くと、デフォルトでは `esm.sh` に 18 件のリクエストが出た。
- Excalidraw の書体の Excalifont と Xiaolai のファイルは、ライセンスの文を中に持たない。npm のパッケージの `fonts/` にも、ライセンスのファイルは無い。
- draw.io の PDF への書き出しは試していない。Embed Mode のメニューから訪問者が選べるかと、メニューを隠せるかは未確認である。
- `embed.diagrams.net` を自分のサイトに埋め込むことへの利用条件は、読んだページに無かった。

## Considered Options

| 選択肢                                                                                | 強み                                                                       | 弱み                                                                                                     |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **採用:** draw.io の Embed Mode と Excalidraw を、別のパスのツールとして提供する      | 構成図と手描きの図の両方を描ける。クラウドのアイコンを、自分で配らずに済む | ツールが 2 つになり、保存と書き出しの処理を 2 つ持つ。draw.io のエディタを、第三者のサーバーから読み込む |
| draw.io の Embed Mode だけを提供する                                                  | ツールが 1 つで済む                                                        | 手描きの図を描けない                                                                                     |
| Excalidraw だけを提供する                                                             | 第三者のサーバーに依らない。isolation のヘッダを返すパスでも動く           | クラウドのアイコンを、自分で配ることになる。再配布の条件を確認できていない                               |
| tldraw を使う                                                                         | キャンバスの SDK として機能が多い                                          | 本番でライセンスキーが要る。hobby license は、審査があり、透かしを表示する                               |
| draw.io を、自分のサイトから配る                                                      | 第三者のサーバーに依らない                                                 | 公式は、Embed Mode を `embed.diagrams.net` でだけサポートする。動くかは未確認                            |
| `embed.diagrams.net` を使い、サーバーを通る書き出しのメニューを、エディタの設定で隠す | 図が第三者のサーバーに送られる操作を減らせる                               | 隠せるかは未確認                                                                                         |

## Consequences

### Positive

- 訪問者と運営者は、AWS と Google Cloud のアイコンを使う構成図と、手描きの図を、ブラウザの中で描ける。
- 訪問者が描いた図は、fukuemon.dev のサーバーに送られない。
- Excalidraw のツールは、自分のページのほかへリクエストを出さない。

### Negative

- draw.io のツールは、`embed.diagrams.net` が止まると使えない。
- draw.io のツールを開くと、訪問者のブラウザに、`embed.diagrams.net` の origin の保存と Service Worker が置かれる。`log.diagrams.net` に、draw.io のバージョンとホスト名が送られる。
- 訪問者が draw.io のメニューから PDF への書き出しを選ぶと、図が draw.io のサーバーに送られる見込みである。
- draw.io のツールは、Node の実行環境と同じページに並べられない。
- Excalidraw の書体のファイル（13.1 MB、234 ファイル）を、自分のサイトから配る。訪問者が読み込むのは、使う文字の分だけである。
- draw.io のバージョンは、`embed.diagrams.net` が配るものに従う。バージョンが上がったときに、`postMessage` の受け渡しが変わることがある。
