# ADR-0033: Node と npm の実行に WebContainers を採り、実行環境と画面の間をインターフェースで分ける

## Status

提案

## Context

訪問者が、ブラウザの中で npm のパッケージを入れ、複数の Node の HTTP サーバーを同時に動かす実行環境の方式を決める必要がある。  
最初に出す題材は認可コードフローで、ブラウザ、クライアント、認可サーバーの間のリダイレクトと Cookie が通ることが条件になる。

- 訪問者のコードは訪問者のブラウザの中だけで動かし、サイトのサーバーに送らない。
  - ADR-0008: [読者の identity を前提とする機能を作らず、バックエンドを持たない](0008-no-reader-identity.md)
- 実行環境の選び方は、有効な決定が無い。
  - ADR-0030: [種別を記事の 1 つにし、構成を記事の形式で、シリーズをディレクトリで表す](0030-articles-format-and-series.md)
- WebContainers の採用は保留している。保留の決定は、ライセンスが要るときに Sandpack（Apache-2.0）を採ると書いている。
  - ADR-0006: [手を動かす場所を 4 つに分け、cross-origin isolation を `/playground/*` に限定する](0006-interactive-content-levels.md)
- Sandpack が Node を動かす実行環境の本体（Nodebox）のライセンスは、Sustainable Use License 1.0 である。非営利と個人の利用を許している。
  - 出典: [nodebox-runtime LICENSE](https://github.com/Sandpack/nodebox-runtime/blob/main/LICENSE)
- WebContainers のライセンスについて、StackBlitz の 2 つのページの記述が食い違う。
  - 利用規約の 1.5(c) は、本番か商用での利用に、プランか書面のライセンスを求める。
    - 「Use in a production or commercial setting [...] requires an active plan or separate written license that includes it」
    - 出典: [StackBlitz Terms of Service](https://stackblitz.com/terms-of-service)
  - Commercial Usage のページは「Licensing is required for production usage of the API in a commercial, for-profit setting.」と書く。
    - 出典: [WebContainers: Commercial Usage](https://webcontainers.io/enterprise)
  - 紹介のページは「Always free for Open Source」と書く。fukuemon.dev のリポジトリは公開だが、`LICENSE` を持たない。
    - 出典: [WebContainers: Introduction](https://webcontainers.io/guides/introduction)
- WebContainers の実行環境の本体は、StackBlitz の CDN から読み込む。自分のサイトから配れない。
- WebContainers は、cross-origin isolation を求める。
  - 出典: [WebContainers: Configuring Headers](https://webcontainers.io/guides/configuring-headers)
- WebContainers の対応は、デスクトップの Chromium 系が正式で、Safari と Firefox はベータである。モバイルのブラウザは、対応の一覧に無い。
  - 出典: [WebContainers: Browser Support](https://webcontainers.io/guides/browser-support)

## Decision

### 1. 方式

Node と npm の実行に、WebContainers（`@webcontainer/api`）を採る。  
比べた 3 つの方式のうち、Cookie を含む認可コードフローが、コードを変えずに最後まで通ったのは WebContainers だけのためである。

### 2. ライセンスの扱い

StackBlitz に問い合わせずに、WebContainers を使う。

- 利用規約の 1.5(c) は「production or commercial」の利用にライセンスを求め、Commercial Usage のページは「commercial, for-profit」の production に限って求める。2 つの読みは食い違う。
- fukuemon.dev は、収益のない個人のサイトである。Commercial Usage のページの読みでは、ライセンスが要らない。利用規約の読みでは、本番で公開するサイトとして、ライセンスが要る。
- 運営者は、Commercial Usage のページの読みで使うと判断した。
- リポジトリのコードに、MIT のライセンスを付ける。紹介のページの「Always free for Open Source」に当たる見込みを上げるためである。当たるかは、StackBlitz に確認していない。

StackBlitz が API の利用を止めたときは、実行環境を差し替える。

- 差し替え先の候補は、almostnode（MIT）である。
- almostnode では、`Set-Cookie` がブラウザに届かず、サーバーの間の `fetch` が失敗する。Cookie を使う認可コードフローの記事（OIDC の記事）は、差し替えると動かなくなる。
- OIDC の記事を動かし直すには、almostnode に、Cookie、サーバーの間の通信、プロセスの分離の 3 つを追加する。作れることを確認したのは、Cookie だけである。
- SQL だけを動かす記事と、Go を動かす記事は、WebContainers を使わないので、止められても動く。

### 3. 実行環境と画面の間のインターフェース

WebContainers の API を呼ぶコードを、1 つのモジュールに閉じる。  
画面のコードは、WebContainers の API を直接呼ばない。  
実行環境と画面の間を、次の 5 つの操作を持つインターフェースで分ける。

- ファイルの読み書きと一覧
- プロセスの起動、入力、出力、終了
- 待ち受けたポートと、ブラウザから開ける URL の通知
- HTTP の記録の読み取り
- コンソールの記録の読み取り

実行環境を差し替えるときに、画面のコードを変えずに済ませるためである。

### 4. ブラウザから開ける URL

WebContainers は、サーバーごとに、実行のたびに変わる origin を割り当てる。  
記事のコードには、`redirect_uri` のような URL を固定の値で書かない。  
実行環境が、待ち受けたポートごとの URL をファイルに書き、訪問者のコードはそのファイルを読む。

## 承認の条件

- 本番の HTTPS のドメインで、API キーなしで `WebContainer.boot()` が動くこと。

## Verification

同じファイル（3001 番のモックの認可サーバー、3000 番のクライアント、`cookie` パッケージ）を 3 つの方式に置き、プレビューの iframe で認可コードフローを流した。  
端末は Apple M2、ブラウザは Playwright 1.65.0 の Chromium、WebKit、Firefox（headless）、配信は `localhost` である。  
実機の Safari と Firefox、モバイルの端末、本番の HTTPS のドメインは未確認である。

| 項目                           | WebContainers 1.6.4              | Nodebox 0.1.9                                            | almostnode 0.2.14              |
| ------------------------------ | -------------------------------- | -------------------------------------------------------- | ------------------------------ |
| 認可コードフロー               | 最後まで通る（Chromium、WebKit） | 止まる（3 つのブラウザ）                                 | 止まる（Chromium）             |
| `Set-Cookie` の保存と送信      | 通る                             | 届かない。`SameSite=None; Secure` も同じ                 | 届かない                       |
| サーバーの間の `fetch`         | 通る                             | 未確認                                                   | 実際のネットワークへ出て、失敗 |
| 2 つのサーバーの分離           | 別のプロセス                     | 別のシェル                                               | `process.env` と `http` を共有 |
| 起動（Chromium）               | 1 回目 3.6 秒、2 回目 1.2 秒     | 0.15 秒                                                  | 0.01 秒                        |
| `npm install`（`cookie` 1 つ） | 2.0 秒                           | サーバーの待ち受けまで 1.0 秒に含む                      | 1.9〜4.1 秒                    |
| フローの終わりまでの転送量     | 4.19 MB                          | 0.32 MB（iframe の中の本体は入っていない見込み。未確認） | 2.96 MB（非圧縮）              |

- Firefox では、WebContainers の `boot`、`npm install`、サーバーの待ち受けまで通ったが、プレビューの iframe にページが出なかった。
- WebContainers は、サーバーが返した Cookie をブラウザの Cookie の保存場所に入れず、次のリクエストに付けた。`SameSite`、`Secure`、`Domain` の属性の扱いは未確認である。
- StackBlitz の iframe が、`stackblitz.com` の Cookie を訪問者のブラウザに置いた。
- `localhost` では、API キーなしで `WebContainer.boot()` が動いた。

## Considered Options

| 選択肢                                                                                | 強み                                                                                             | 弱み                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **採用:** WebContainers を、StackBlitz に問い合わせずに採り、差し替えられる作りにする | Cookie を含む認可コードフローが、コードを変えずに通る。Node の API と npm が、手元の Node に近い | 利用規約の「production or commercial」と食い違う読みが残り、API を止められることがある。止められると、OIDC の記事が動かなくなる。本体を StackBlitz の CDN から読む。cross-origin isolation が要る。Firefox とモバイルで動かない見込みがある |
| almostnode に、Cookie、サーバーの間の通信、プロセスの分離を追加する                   | MIT で、自分のサイトから配れる。cross-origin isolation が要らない                                | 3 つの層を自分で作り、保守する。作れることを確認したのは Cookie だけである。訪問者のコードが、ホストのページのメインスレッドで動く                                                                                                          |
| Nodebox を採る                                                                        | cross-origin isolation が要らない。起動が速い                                                    | `Set-Cookie` がブラウザに届かず、認可コードフローが止まる。`crypto.randomUUID` が無い                                                                                                                                                       |
| StackBlitz に問い合わせ、返事を承認の条件にする                                       | 規約の 2 つの読みの食い違いを、StackBlitz の答えで決められる                                     | 返事を待つ。返事が無いことがある。「ライセンスが要る」と答えられると、使えなくなる                                                                                                                                                          |

## Consequences

### Positive

- 記事のコードを、手元の Node で動かすコードとほぼ同じ形で書ける。
- 実行環境を差し替えるときに変えるコードが、1 つのモジュールに閉じる。
- StackBlitz の返事を待たずに、実行環境を作り始められる。

### Negative

- 利用規約の読みでは、ライセンスなしの利用になる。StackBlitz が API の利用を止めることがある。
- API を止められると、almostnode に 3 つの層を追加するまで、OIDC の記事が動かない。追加できるかは、Cookie のほかは確認していない。
- 実行環境が動くかどうかが、StackBlitz の CDN と規約に依る。
- 訪問者のブラウザに、`stackblitz.com` の Cookie が置かれる。第三者の Cookie をブロックする設定では、プレビューが動かないことがある。
  - 出典: [WebContainers: Browser Configuration](https://webcontainers.io/guides/browser-config)
- Firefox とモバイルのブラウザの訪問者は、Node の実行環境を使えない見込みがある。
- ブラウザの DevTools の Application のタブで、実行環境の Cookie を見る説明を、記事に書けない。
